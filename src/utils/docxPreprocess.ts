/**
 * Docx pre-processing for the rich-content pipeline (Phase B).
 *
 * Mammoth drops every <m:oMath> formula and emits images as giant inline
 * data URIs in places the parser cannot control. So BEFORE mammoth runs we
 * open the .docx ourselves (JSZip), parse word/document.xml as a DOM, and:
 *   1. Replace every OMML formula with a text token  ⟦MATH{i}⟧  and record
 *      { latex, plain, ommlXml } in mathSegments[i] (converted via ./omml).
 *   2. Replace every drawing/pict/OLE-preview image with a token ⟦img:{i}⟧
 *      and record the (compressed) data URI in imageDataUris[i]. Images
 *      sitting inside OPTIONS are treated exactly like stem images — an
 *      image always stays attached to the question/option it belongs to.
 *   3. Count OLE objects without a readable preview (classic MathType) —
 *      they cannot be converted here, so we surface a warning and NEVER
 *      fabricate a replacement (hard rule ported from EduMix's post-mortem).
 *
 * The modified document is re-zipped and handed to mammoth, so the existing
 * parser keeps working on HTML that now carries our tokens as plain text.
 * If anything in here fails (no DOMParser, corrupt zip…), the caller falls
 * back to the legacy mammoth-only path.
 */
import JSZip from 'jszip';
import { ommlToLatex, ommlToPlainText } from './omml';

export interface MathSegment {
  latex: string;
  plain: string;
  ommlXml: string;
}

export interface DocxPreprocessResult {
  /** Docx (ArrayBuffer) whose document.xml now carries tokens instead of OMML/images. */
  arrayBuffer: ArrayBuffer;
  mathSegments: MathSegment[];
  /** Data URI per ⟦img:{i}⟧ token; '' when the image could not be read. */
  imageDataUris: string[];
  /** Human-readable import warnings (Vietnamese), never blocking. */
  warnings: string[];
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const ELEMENT_NODE = 1;

function localTag(node: any): string {
  if (!node) return '';
  const name = node.localName || (typeof node.tagName === 'string' ? node.tagName.split(':').pop() : '') || '';
  return String(name).toLowerCase();
}

function getDomConstructors(): { DOMParser: any; XMLSerializer: any } | null {
  const g = globalThis as any;
  if (typeof g.DOMParser !== 'undefined' && typeof g.XMLSerializer !== 'undefined') {
    return { DOMParser: g.DOMParser, XMLSerializer: g.XMLSerializer };
  }
  return null;
}

function resolveDomParser(xml: string, ctors: { DOMParser: any }): any | null {
  try {
    const doc = new ctors.DOMParser().parseFromString(xml, 'text/xml');
    // A parse failure yields a <parsererror> document in browsers.
    if (doc && doc.getElementsByTagName && doc.getElementsByTagName('parsererror').length > 0) {
      return null;
    }
    return doc;
  } catch {
    return null;
  }
}

function makeTokenRun(doc: any, token: string): any {
  const run = doc.createElementNS(W_NS, 'w:r');
  const t = doc.createElementNS(W_NS, 'w:t');
  try {
    t.setAttribute('xml:space', 'preserve');
  } catch {
    // ignore
  }
  t.textContent = ` ${token} `;
  run.appendChild(t);
  return run;
}

/** Replace `node` (or its mc:AlternateContent ancestor) with a token run. */
function replaceWithToken(doc: any, node: any, token: string): void {
  let target = node;
  let p = node.parentNode;
  while (p) {
    if (localTag(p) === 'alternatecontent') {
      target = p;
      break;
    }
    p = p.parentNode;
  }
  if (target.parentNode) {
    target.parentNode.replaceChild(makeTokenRun(doc, token), target);
  }
}

function findImageRelId(unit: any): string {
  // a:blip r:embed (DrawingML pictures) or v:imagedata r:id (VML / OLE preview)
  const all = unit.getElementsByTagName ? unit.getElementsByTagName('*') : [];
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const tag = localTag(el);
    if (tag === 'blip' || tag === 'imagedata') {
      const rid =
        el.getAttribute('r:embed') ||
        el.getAttribute('r:id') ||
        el.getAttribute('o:relid') ||
        el.getAttribute('id') ||
        '';
      if (rid) return rid;
    }
  }
  return '';
}

function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'bmp': return 'image/bmp';
    case 'svg': return 'image/svg+xml';
    case 'webp': return 'image/webp';
    default: return ''; // emf/wmf/tiff… — not renderable in a browser <img>
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Compress an image for in-app storage/transport (browser only): cap the
 * largest dimension at 1100px and re-encode as JPEG q0.75 — except PNGs with
 * real transparency, which stay PNG. Small PNGs (<= 30 KB) are kept as-is.
 * Outside a browser (Node harness) the original data URI is returned.
 */
async function compressImageDataUri(bytes: Uint8Array, mime: string): Promise<string> {
  const original = `data:${mime};base64,${bytesToBase64(bytes)}`;
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined') {
    return original;
  }
  if (mime === 'image/png' && bytes.length <= 30_000) {
    return original;
  }
  if (!/^image\/(png|jpeg|gif|bmp|webp)$/.test(mime)) {
    return original;
  }
  try {
    const blob = new Blob([bytes as any], { type: mime });
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error('image decode failed'));
        im.src = url;
      });
      const maxDim = 1100;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return original;

      let hasAlpha = false;
      if (mime === 'image/png') {
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const stepX = Math.max(1, Math.floor(w / 24));
          const stepY = Math.max(1, Math.floor(h / 24));
          const data = ctx.getImageData(0, 0, w, h).data;
          outer: for (let y = 0; y < h; y += stepY) {
            for (let x = 0; x < w; x += stepX) {
              if (data[(y * w + x) * 4 + 3] < 250) {
                hasAlpha = true;
                break outer;
              }
            }
          }
        } catch {
          hasAlpha = false;
        }
      } else {
        // JPEG output needs an opaque background for transparent sources
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
      }

      const out = hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.75);
      return out && out.length > 0 ? (out.length < original.length || scale < 1 ? out : original) : original;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return original;
  }
}

export async function preprocessDocx(arrayBuffer: ArrayBuffer): Promise<DocxPreprocessResult | null> {
  const ctors = getDomConstructors();
  if (!ctors) return null;

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch {
    return null;
  }

  const docFile = zip.file('word/document.xml');
  if (!docFile) return null;
  const documentXml = await docFile.async('string');
  const doc = resolveDomParser(documentXml, ctors);
  if (!doc) return null;

  // --- relationship map: rId -> zip path ----------------------------------
  const relTargets = new Map<string, string>();
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    const relsXml = await relsFile.async('string');
    const relsDoc = resolveDomParser(relsXml, ctors);
    if (relsDoc) {
      const rels = relsDoc.getElementsByTagName('Relationship');
      for (let i = 0; i < rels.length; i++) {
        const id = rels[i].getAttribute('Id') || '';
        const target = rels[i].getAttribute('Target') || '';
        const type = rels[i].getAttribute('Type') || '';
        if (!id || !target || /external/i.test(rels[i].getAttribute('TargetMode') || '')) continue;
        if (!type.includes('image') && !/\.(png|jpe?g|gif|bmp|svg|webp|emf|wmf)$/i.test(target)) continue;
        const path = target.startsWith('/') ? target.slice(1) : `word/${target.replace(/^\.\//, '')}`;
        relTargets.set(id, path.replace(/\/\.\.\//g, '/'));
      }
    }
  }

  const warnings: string[] = [];
  const mathSegments: MathSegment[] = [];
  const imageDataUris: string[] = [];

  const serializer = new ctors.XMLSerializer();

  // --- 1. OMML formulas → ⟦MATH{i}⟧ tokens --------------------------------
  const oMathList: any[] = [];
  const oMathNodes = doc.getElementsByTagName('m:oMath');
  for (let i = 0; i < oMathNodes.length; i++) oMathList.push(oMathNodes[i]);

  let unreadableMath = 0;
  for (const oMath of oMathList) {
    if (!oMath.parentNode) continue; // already consumed with an ancestor
    let latex = '';
    let plain = '';
    let ommlXml = '';
    try {
      ommlXml = serializer.serializeToString(oMath);
      latex = ommlToLatex(oMath);
      plain = ommlToPlainText(oMath);
    } catch {
      latex = '';
      plain = '';
    }
    const idx = mathSegments.length;
    mathSegments.push({ latex, plain, ommlXml });
    if (!latex) unreadableMath++;
    // A display formula lives in <m:oMathPara> inside the paragraph — swap
    // the wrapper so the token run sits at paragraph level.
    const target = localTag(oMath.parentNode) === 'omathpara' ? oMath.parentNode : oMath;
    replaceWithToken(doc, target, `⟦MATH${idx}⟧`);
  }
  if (unreadableMath > 0) {
    warnings.push(
      `Có ${unreadableMath} công thức toán không chuyển được sang LaTeX — vị trí công thức sẽ hiện dấu hiệu "chưa đọc được" và XML gốc vẫn được lưu kèm câu hỏi.`
    );
  }

  // --- 2. Images (stem + options + sub-items đều như nhau) → ⟦img:{i}⟧ ----
  const allElements = doc.getElementsByTagName('*');
  const units: any[] = [];
  for (let i = 0; i < allElements.length; i++) {
    const tag = localTag(allElements[i]);
    if (tag === 'drawing' || tag === 'pict' || tag === 'object') {
      units.push(allElements[i]);
    }
  }

  const isConsumed = (el: any, consumedRoots: Set<any>): boolean => {
    let p = el;
    while (p) {
      if (consumedRoots.has(p)) return true;
      p = p.parentNode;
    }
    return false;
  };
  const consumedRoots = new Set<any>();
  let unreadableImages = 0;
  let oleWithoutPreview = 0;

  for (const unit of units) {
    if (isConsumed(unit, consumedRoots)) continue;
    if (!unit.parentNode && localTag(unit) !== 'object') continue;

    const relId = findImageRelId(unit);
    const mediaPath = relId ? relTargets.get(relId) : undefined;
    const mime = mediaPath ? mimeFromPath(mediaPath) : '';

    if (localTag(unit) === 'object' && !mediaPath) {
      // Classic MathType/OLE without even a preview image: nothing truthful
      // can be shown — count it for the warning and leave the node alone.
      oleWithoutPreview++;
      consumedRoots.add(unit);
      continue;
    }

    let dataUri = '';
    if (mediaPath && mime) {
      const mediaFile = zip.file(mediaPath);
      if (mediaFile) {
        const bytes = await mediaFile.async('uint8array');
        dataUri = await compressImageDataUri(bytes, mime);
      }
    }
    if (!dataUri) unreadableImages++;

    const idx = imageDataUris.length;
    imageDataUris.push(dataUri);
    consumedRoots.add(unit);
    replaceWithToken(doc, unit, `⟦img:${idx}⟧`);
  }
  if (unreadableImages > 0) {
    warnings.push(
      `Có ${unreadableImages} hình ảnh không đọc được từ file Word (định dạng ảnh lạ hoặc thiếu dữ liệu) — vị trí hình sẽ hiện khung cảnh báo trong đề.`
    );
  }
  if (oleWithoutPreview > 0) {
    warnings.push(
      `File có ${oleWithoutPreview} đối tượng OLE (thường là công thức MathType) không có hình xem trước — hệ thống chưa đọc được dạng này, vị trí đó sẽ bị trống trong đề.`
    );
  }

  // --- 3. Re-zip with the tokenised document.xml ---------------------------
  const newXml = serializer.serializeToString(doc);
  zip.file('word/document.xml', newXml);
  const outBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });

  return { arrayBuffer: outBuffer, mathSegments, imageDataUris, warnings };
}
