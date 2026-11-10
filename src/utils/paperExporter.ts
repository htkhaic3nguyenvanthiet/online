// ============================================================
// XUẤT ĐỀ GIẤY (Trộn đề) — bộ xuất bản Word .docx cho bộ đề in,
// port theo kiến trúc exporter của EduMix (tronde docxExporter:
// đóng gói OpenXML bằng JSZip, header quốc ngữ, phiếu QM nhúng
// trang 1, footer số trang) nhưng viết cho model câu hỏi của
// trang online (Question mang images[]/table/ommlXml + LaTeX).
//
// NGUYÊN TẮC BẤT BIẾN (lệnh Thầy — giữ trọn tài sản):
// - Mọi công thức đều thành OMML thật trong Word: ưu tiên phát
//   lại OMML GỐC đã lưu khi đọc file (khớp theo LaTeX đã chuẩn
//   hoá như cơ chế rawOmmlReuse của EduMix), không có thì chuyển
//   LaTeX -> OMML bằng pipeline của EduMix (latexToOmml.ts).
// - Mọi hình trong câu hỏi đều được nhúng thành media part của
//   chính câu đó; hình không đọc được thì hiện dấu hiệu rõ ràng
//   trong đề, TUYỆT ĐỐI không bịa hình/công thức thay thế.
// - Bản học sinh KHÔNG đánh dấu đáp án. Bản "có đáp án" cho giáo
//   viên đánh dấu đúng quy ước đề chuẩn (chỉ ký tự đầu của phương
//   án/ý đúng: đậm + gạch chân + đỏ RGB(220,20,60)).
// ============================================================

import JSZip from 'jszip';
import QRCode from 'qrcode';
import { Question, Quiz } from '../types/quiz';
import { ShuffledVariantResult } from './shuffleEngine';
import {
  buildOmmlElementFromLatex,
  normalizeLatexForOmmlMatch,
  unwrapRawOmmlXmlForInlineUse,
} from './latexToOmml';
import { ommlToLatex } from './omml';
import {
  buildQrPayloadString,
  generateTripleGradingQrSet,
  exportGradingExcelXlsx,
  MixerAnswerKey,
  QRAppFormat,
  MAX_CODES_PER_SINGLE_QR,
} from './mixerGrading';
import { PhieuQMInfo } from './phieuQm';

export interface PaperMeta {
  departmentName: string;
  schoolName: string;
  nationalHeader: string;
  nationalMotto: string;
  examTitle: string;
  examSubtitle: string;
  schoolYear: string;
  subjectName: string;
  durationMinutes: number;
  teacherName?: string;
}

export interface PaperOptions {
  /** true = bản giáo viên có đánh dấu đáp án; false = bản học sinh sạch. */
  markAnswers?: boolean;
  /** QR (PNG data URL) của chính mã đề này — nhúng vào ô mã đề ở đầu trang 1. */
  qrDataUrl?: string | null;
  /** Ảnh phiếu trả lời trắc nghiệm QM nhúng đầu trang 1 (như EduMix). */
  phieu?: { dataUrl: string; widthEmu: number; heightEmu: number } | null;
}

export const DEFAULT_PAPER_META: PaperMeta = {
  departmentName: 'SỞ GD&ĐT VĨNH LONG',
  schoolName: 'TRƯỜNG THPT MANG THÍT',
  nationalHeader: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
  nationalMotto: 'Độc lập - Tự do - Hạnh phúc',
  examTitle: 'KIỂM TRA',
  examSubtitle: '(Đề chính thức)',
  schoolYear: '2026 - 2027',
  subjectName: '',
  durationMinutes: 50,
  teacherName: 'Hồ Tấn Khải',
};

// ------------------------------------------------------------
// Tiện ích XML / dữ liệu
// ------------------------------------------------------------

export function escapeXmlText(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function encodeUtf8Xml(str: string): Uint8Array {
  return new TextEncoder().encode(str.normalize('NFC'));
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const isBase64 = comma >= 0 && /;base64$/i.test(dataUrl.slice(0, comma));
  if (isBase64) {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(payload, 'base64'));
    }
    const bin = atob(payload);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new TextEncoder().encode(decodeURIComponent(payload));
}

function dataUrlMime(dataUrl: string): string {
  const m = /^data:([^;,]+)/i.exec(dataUrl || '');
  return m ? m[1].toLowerCase() : '';
}

// ------------------------------------------------------------
// Kích thước ảnh: đọc từ chính byte ảnh (PNG/JPEG/GIF/SVG)
// ------------------------------------------------------------

const EMU_PER_CM = 360000;
const MAX_IMG_WIDTH_EMU = Math.round(15.5 * EMU_PER_CM);

function pngSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}

function jpegSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) };
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const len = (bytes[i + 2] << 8) + bytes[i + 3];
    if (!len) break;
    i += 2 + len;
  }
  return null;
}

function gifSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 10) return null;
  return { w: bytes[6] + (bytes[7] << 8), h: bytes[8] + (bytes[9] << 8) };
}

function svgDeclaredSize(svgText: string): { wEmu: number; hEmu: number } | null {
  const tag = /<svg\b[^>]*>/i.exec(svgText)?.[0];
  if (!tag) return null;
  const toEmu = (val: string): number | null => {
    const m = /^([\d.]+)\s*(px|pt|mm|cm|in)?$/i.exec(val.trim());
    if (!m) return null;
    const n = parseFloat(m[1]);
    const unit = (m[2] || 'px').toLowerCase();
    if (unit === 'pt') return Math.round(n * 12700);
    if (unit === 'mm') return Math.round(n * 36000);
    if (unit === 'cm') return Math.round(n * 360000);
    if (unit === 'in') return Math.round(n * 914400);
    return Math.round(n * 9525);
  };
  const wAttr = /\bwidth\s*=\s*"([^"]+)"/i.exec(tag)?.[1];
  const hAttr = /\bheight\s*=\s*"([^"]+)"/i.exec(tag)?.[1];
  let w = wAttr ? toEmu(wAttr) : null;
  let h = hAttr ? toEmu(hAttr) : null;
  if (w && h) return { wEmu: w, hEmu: h };
  const vb = /\bviewBox\s*=\s*"([\d.\s-]+)"/i.exec(tag)?.[1];
  if (vb) {
    const parts = vb.trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      if (w && !h) h = Math.round((w * parts[3]) / parts[2]);
      if (h && !w) w = Math.round((h * parts[2]) / parts[3]);
      if (!w && !h) {
        w = Math.round(parts[2] * 9525);
        h = Math.round(parts[3] * 9525);
      }
      if (w && h) return { wEmu: w, hEmu: h };
    }
  }
  return null;
}

export interface EmbeddedImage {
  relId: string;
  fileName: string;
  dataUrl: string;
  mime: string;
  isSvg: boolean;
  widthEmu: number;
  heightEmu: number;
  /** Ảnh lớn (hình vẽ/đồ thị) -> đoạn riêng; ảnh nhỏ -> nằm trong dòng. */
  isBlock: boolean;
}

/** Đăng ký mọi ảnh của bộ đề vào một registry dùng chung cho file .docx. */
export class DocxImageRegistry {
  private byDataUrl = new Map<string, EmbeddedImage>();
  private seq = 0;

  register(dataUrl: string): EmbeddedImage | null {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const existing = this.byDataUrl.get(dataUrl);
    if (existing) return existing;
    const mime = dataUrlMime(dataUrl);
    const isSvg = mime.includes('svg');
    let bytes: Uint8Array;
    try {
      bytes = dataUrlToUint8Array(dataUrl);
    } catch {
      return null;
    }
    if (!bytes || bytes.length === 0) return null;

    let widthEmu = Math.round(9 * EMU_PER_CM);
    let heightEmu = Math.round(6 * EMU_PER_CM);
    let isBlock = true;

    if (isSvg) {
      const text = new TextDecoder().decode(bytes.slice(0, 2048));
      const declared = svgDeclaredSize(text);
      if (declared) {
        widthEmu = declared.wEmu;
        heightEmu = declared.hEmu;
      } else {
        widthEmu = Math.round(4 * EMU_PER_CM);
        heightEmu = Math.round(1.2 * EMU_PER_CM);
      }
      isBlock = widthEmu >= Math.round(5 * EMU_PER_CM);
    } else {
      const px = pngSize(bytes) || jpegSize(bytes) || gifSize(bytes);
      if (px && px.w > 0 && px.h > 0) {
        if (px.w >= 480) {
          widthEmu = Math.min(px.w * 12700, MAX_IMG_WIDTH_EMU);
        } else {
          widthEmu = Math.min(px.w * 9525, MAX_IMG_WIDTH_EMU);
        }
        heightEmu = Math.round((widthEmu * px.h) / px.w);
        isBlock = px.w >= 480;
      }
    }

    const ext = isSvg
      ? 'svg'
      : mime.includes('png')
        ? 'png'
        : mime.includes('gif')
          ? 'gif'
          : mime.includes('webp')
            ? 'webp'
            : 'jpg';
    this.seq += 1;
    const img: EmbeddedImage = {
      relId: `rIdImg${this.seq}`,
      fileName: `image${this.seq}.${ext}`,
      dataUrl,
      mime: mime || (isSvg ? 'image/svg+xml' : 'image/jpeg'),
      isSvg,
      widthEmu,
      heightEmu,
      isBlock,
    };
    this.byDataUrl.set(dataUrl, img);
    return img;
  }

  get all(): EmbeddedImage[] {
    return [...this.byDataUrl.values()];
  }
}

let drawingSeq = 0;

export function buildDrawingXml(img: EmbeddedImage): string {
  drawingSeq += 1;
  const docPrId = 1000 + drawingSeq;
  const blipInner = img.isSvg
    ? `<a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D224A1A00E}"><asvg:svgBlip r:embed="${img.relId}"/></a:ext></a:extLst>`
    : '';
  return `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${img.widthEmu}" cy="${img.heightEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="${escapeXmlText(img.fileName)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${escapeXmlText(img.fileName)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${img.relId}">${blipInner}</a:blip><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${img.widthEmu}" cy="${img.heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
}

// ------------------------------------------------------------
// Rich text (marker ⟦img:⟧ / ⟦table⟧ / \(...\) / ⟦sub:⟧) -> XML
// ------------------------------------------------------------

const RICH_TOKEN_RE = /\\\(([\s\S]*?)\\\)|⟦img:(\d+)⟧|⟦table⟧|⟦sub:([\s\S]*?)⟧|⟦sup:([\s\S]*?)⟧/g;

type RichSeg =
  | { type: 'text'; value: string }
  | { type: 'math'; value: string }
  | { type: 'image'; index: number }
  | { type: 'table' }
  | { type: 'sub'; value: string }
  | { type: 'sup'; value: string };

function splitRichSegs(text: string): RichSeg[] {
  const segs: RichSeg[] = [];
  let last = 0;
  RICH_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  const src = text || '';
  while ((m = RICH_TOKEN_RE.exec(src)) !== null) {
    if (m.index > last) segs.push({ type: 'text', value: src.slice(last, m.index) });
    if (m[1] !== undefined) segs.push({ type: 'math', value: m[1] });
    else if (m[2] !== undefined) segs.push({ type: 'image', index: Number(m[2]) });
    else if (m[3] !== undefined) segs.push({ type: 'sub', value: m[3] });
    else if (m[4] !== undefined) segs.push({ type: 'sup', value: m[4] });
    else segs.push({ type: 'table' });
    last = m.index + m[0].length;
  }
  if (last < src.length) segs.push({ type: 'text', value: src.slice(last) });
  return segs;
}

/** Độ dài văn bản thuần gần đúng của một chuỗi rich (để chọn bố cục phương án). */
export function richPlainLength(text: string): number {
  return splitRichSegs(text).reduce((acc, s) => {
    if (s.type === 'text' || s.type === 'sub' || s.type === 'sup') return acc + s.value.length;
    if (s.type === 'math') return acc + s.value.length;
    return acc + 6;
  }, 0);
}

export interface RunStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  sizeHalfPt?: number;
  vertAlign?: 'subscript' | 'superscript';
  font?: string;
}

const MARK_COLOR = 'DC143C'; // Đỏ chuẩn đáp án RGB(220,20,60)

function runPropsXml(style: RunStyle): string {
  const font = style.font || 'Times New Roman';
  const parts = [
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>`,
  ];
  if (style.bold) parts.push('<w:b/><w:bCs/>');
  if (style.italic) parts.push('<w:i/><w:iCs/>');
  if (style.color) parts.push(`<w:color w:val="${style.color}"/>`);
  const sz = style.sizeHalfPt || 24;
  parts.push(`<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`);
  if (style.underline) parts.push('<w:u w:val="single"/>');
  if (style.vertAlign) parts.push(`<w:vertAlign w:val="${style.vertAlign}"/>`);
  return `<w:rPr>${parts.join('')}</w:rPr>`;
}

export function textRunXml(text: string, style: RunStyle = {}): string {
  if (!text) return '';
  const rPr = runPropsXml(style);
  const chunks = String(text).split('\n');
  const inner = chunks
    .map((chunk, i) => `${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXmlText(chunk)}</w:t>`)
    .join('');
  return `<w:r>${rPr}${inner}</w:r>`;
}

interface ParaOpts {
  align?: 'left' | 'center' | 'right' | 'justify';
  spaceBefore?: number;
  spaceAfter?: number;
  indentLeft?: number;
  tabsTwips?: number[];
  style?: RunStyle;
}

function paragraphXml(runsXml: string, opts: ParaOpts = {}): string {
  const pPr: string[] = [];
  const spacing: string[] = [];
  if (opts.spaceBefore !== undefined) spacing.push(`w:before="${opts.spaceBefore}"`);
  if (opts.spaceAfter !== undefined) spacing.push(`w:after="${opts.spaceAfter}"`);
  spacing.push('w:line="276" w:lineRule="auto"');
  pPr.push(`<w:spacing ${spacing.join(' ')}/>`);
  if (opts.tabsTwips && opts.tabsTwips.length > 0) {
    pPr.push(
      `<w:tabs>${opts.tabsTwips.map((t) => `<w:tab w:val="left" w:pos="${t}"/>`).join('')}</w:tabs>`
    );
  }
  if (opts.indentLeft) pPr.push(`<w:ind w:left="${opts.indentLeft}"/>`);
  if (opts.align) pPr.push(`<w:jc w:val="${opts.align}"/>`);
  return `<w:p><w:pPr>${pPr.join('')}</w:pPr>${runsXml}</w:p>`;
}

/** Tìm phần tử <m:oMath> đầu tiên trong cây DOM (mọi môi trường DOM). */
function findMathElement(node: any): any | null {
  if (!node) return null;
  const name = node.localName || (typeof node.tagName === 'string' ? node.tagName.split(':').pop() : '');
  if (String(name).toLowerCase() === 'omath') return node;
  const children = node.childNodes || [];
  for (let i = 0; i < children.length; i++) {
    const found = findMathElement(children[i]);
    if (found) return found;
  }
  return null;
}

/**
 * Kho OMML gốc của một câu hỏi: khớp công thức theo LaTeX đã chuẩn
 * hoá (cơ chế của EduMix), dự phòng theo thứ tự xuất hiện, cuối
 * cùng mới chuyển LaTeX -> OMML. Không bao giờ trả về rỗng khi
 * công thức còn nội dung: nếu mọi đường đều trượt, giữ chính
 * LaTeX dưới dạng math run để công thức vẫn hiện trong Word.
 */
class QuestionMathPool {
  private byLatex = new Map<string, string>();
  private queue: string[] = [];

  constructor(q: Question) {
    const stored = q.ommlXml || [];
    this.queue = [...stored];
    try {
      const DomParserCtor = (globalThis as any).DOMParser;
      if (typeof DomParserCtor !== 'undefined') {
        for (const xml of stored) {
          try {
            const doc = new DomParserCtor().parseFromString(xml, 'text/xml');
            const mathEl = findMathElement(doc);
            if (mathEl) {
              const latex = ommlToLatex(mathEl);
              if (latex) {
                const key = normalizeLatexForOmmlMatch(latex);
                if (key && !this.byLatex.has(key)) this.byLatex.set(key, xml);
              }
            }
          } catch {
            // bỏ qua mục không phân tích được — còn đường thứ tự/chuyển đổi
          }
        }
      }
    } catch {
      // không có DOM (rất hiếm) — dùng thứ tự + chuyển đổi
    }
  }

  ommlFor(latex: string): string {
    const key = normalizeLatexForOmmlMatch(latex || '');
    const matched = this.byLatex.get(key);
    if (matched) {
      this.byLatex.delete(key);
      const qi = this.queue.indexOf(matched);
      if (qi >= 0) this.queue.splice(qi, 1);
      return unwrapRawOmmlXmlForInlineUse(matched);
    }
    if (this.queue.length > 0) {
      const next = this.queue.shift() as string;
      return unwrapRawOmmlXmlForInlineUse(next);
    }
    const converted = buildOmmlElementFromLatex(latex);
    if (converted) return converted;
    // Đường cuối: giữ nguyên ký tự công thức trong một math run —
    // công thức vẫn xuất hiện trong Word, không biến mất.
    const safe = escapeXmlText(latex || '');
    return `<m:oMath><m:r><m:rPr><m:scr m:val="roman"/><m:sty m:val="p"/><m:nor/></m:rPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><m:t xml:space="preserve">${safe}</m:t></m:r></m:oMath>`;
  }
}

export interface RichContext {
  q: Question;
  registry: DocxImageRegistry;
  pool: QuestionMathPool;
}

export function makeRichContext(q: Question, registry: DocxImageRegistry): RichContext {
  return { q, registry, pool: new QuestionMathPool(q) };
}

const MISSING_IMAGE_RUN = textRunXml(' ⚠ [Hình ảnh không đọc được từ đề gốc] ', {
  italic: true,
  color: 'B45309',
});

/**
 * Chuyển một chuỗi rich thành các khối XML (đoạn văn / bảng / ảnh
 * khối). Đoạn đầu tiên nhận prefixRunsXml (ví dụ "Câu 1. ").
 */
export function richBlocksXml(
  text: string,
  ctx: RichContext,
  opts: { para?: ParaOpts; prefixRunsXml?: string } = {}
): string {
  const segs = splitRichSegs(text || '');
  const blocks: string[] = [];
  let runs: string[] = opts.prefixRunsXml ? [opts.prefixRunsXml] : [];
  let firstParaPending = true;

  const flush = () => {
    if (runs.length > 0) {
      blocks.push(paragraphXml(runs.join(''), opts.para || {}));
      runs = [];
      firstParaPending = false;
    }
  };

  for (const seg of segs) {
    switch (seg.type) {
      case 'text':
        if (seg.value) runs.push(textRunXml(seg.value, opts.para?.style || {}));
        break;
      case 'math':
        runs.push(ctx.pool.ommlFor(seg.value));
        break;
      case 'sub':
        runs.push(textRunXml(seg.value, { ...(opts.para?.style || {}), vertAlign: 'subscript' }));
        break;
      case 'sup':
        runs.push(textRunXml(seg.value, { ...(opts.para?.style || {}), vertAlign: 'superscript' }));
        break;
      case 'image': {
        const dataUrl = ctx.q.images?.[seg.index];
        const img = dataUrl ? ctx.registry.register(dataUrl) : null;
        if (!img) {
          runs.push(MISSING_IMAGE_RUN);
          break;
        }
        if (img.isBlock) {
          flush();
          blocks.push(paragraphXml(`<w:r>${buildDrawingXml(img)}</w:r>`, { spaceBefore: 60, spaceAfter: 60 }));
        } else {
          runs.push(`<w:r>${buildDrawingXml(img)}</w:r>`);
        }
        break;
      }
      case 'table': {
        flush();
        const tbl = ctx.q.table;
        if (tbl && tbl.length > 0) {
          blocks.push(tableXml(tbl, ctx));
        } else {
          blocks.push(
            paragraphXml(textRunXml('[Bảng số liệu không đọc được từ đề gốc]', { italic: true, color: 'B45309' }), {})
          );
        }
        break;
      }
    }
  }
  flush();
  if (blocks.length === 0 && opts.prefixRunsXml) {
    blocks.push(paragraphXml(opts.prefixRunsXml, opts.para || {}));
  }
  void firstParaPending;
  return blocks.join('\n');
}

/** Bảng dữ liệu của câu hỏi -> <w:tbl> có viền, hàng đầu là tiêu đề. */
export function tableXml(table: string[][], ctx: RichContext): string {
  const colCount = Math.max(1, ...table.map((r) => r.length));
  const colPct = Math.floor(5000 / colCount);
  const rows = table
    .map((row, ri) => {
      const cells: string[] = [];
      for (let c = 0; c < colCount; c++) {
        const cellText = row[c] ?? '';
        const isHeader = ri === 0;
        const cellRuns = splitRichSegs(cellText)
          .map((seg) => {
            if (seg.type === 'text') return textRunXml(seg.value, { bold: isHeader });
            if (seg.type === 'math') return ctx.pool.ommlFor(seg.value);
            if (seg.type === 'sub') return textRunXml(seg.value, { vertAlign: 'subscript' });
            if (seg.type === 'sup') return textRunXml(seg.value, { vertAlign: 'superscript' });
            if (seg.type === 'image') {
              const dataUrl = ctx.q.images?.[seg.index];
              const img = dataUrl ? ctx.registry.register(dataUrl) : null;
              return img ? `<w:r>${buildDrawingXml(img)}</w:r>` : MISSING_IMAGE_RUN;
            }
            return '';
          })
          .join('');
        cells.push(
          `<w:tc><w:tcPr><w:tcW w:w="${colPct}" w:type="pct"/>${isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="D9E2F3"/>' : ''}<w:vAlign w:val="center"/></w:tcPr>${paragraphXml(cellRuns, { align: isHeader ? 'center' : 'left', spaceAfter: 20 })}</w:tc>`
        );
      }
      return `<w:tr>${cells.join('')}</w:tr>`;
    })
    .join('\n');
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="808080"/><w:left w:val="single" w:sz="6" w:space="0" w:color="808080"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="808080"/><w:right w:val="single" w:sz="6" w:space="0" w:color="808080"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/></w:tblBorders></w:tblPr>${rows}</w:tbl>`;
}

// ------------------------------------------------------------
// Thân đề giấy
// ------------------------------------------------------------

function centeredRun(text: string, style: RunStyle = {}): string {
  return paragraphXml(textRunXml(text, style), { align: 'center', spaceAfter: 40 });
}

/** Bảng header quốc ngữ 2 cột không viền — đúng bố cục đề thi Việt Nam. */
function headerTableXml(meta: PaperMeta): string {
  const left = [
    centeredRun(meta.departmentName.toUpperCase(), {}),
    centeredRun(meta.schoolName.toUpperCase(), { bold: true }),
    centeredRun(meta.examSubtitle || '', { italic: true }),
  ].join('\n');
  const right = [
    centeredRun(meta.nationalHeader.toUpperCase(), { bold: true }),
    centeredRun(meta.nationalMotto, { bold: true }),
    centeredRun(`${meta.examTitle.toUpperCase()} — NĂM HỌC ${meta.schoolYear}`, {}),
    centeredRun(
      `Môn: ${meta.subjectName.toUpperCase()} — Thời gian làm bài: ${meta.durationMinutes} phút`,
      { italic: true }
    ),
  ].join('\n');
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr><w:tr><w:tc><w:tcPr><w:tcW w:w="2100" w:type="pct"/><w:vAlign w:val="top"/></w:tcPr>${left}</w:tc><w:tc><w:tcPr><w:tcW w:w="2900" w:type="pct"/><w:vAlign w:val="top"/></w:tcPr>${right}</w:tc></w:tr></w:tbl>`;
}

/** Ô thông tin thí sinh + ô MÃ ĐỀ (kèm QR của mã đề) ngay dưới header. */
function infoAndCodeTableXml(codeLabel: string, qrImg: EmbeddedImage | null): string {
  const infoLines = [
    paragraphXml(
      textRunXml('Họ và tên thí sinh: ', { bold: true }) +
        textRunXml('......................................................................'),
      { spaceAfter: 60 }
    ),
    paragraphXml(
      textRunXml('Lớp: ', { bold: true }) +
        textRunXml('..........................') +
        textRunXml('   Số báo danh: ', { bold: true }) +
        textRunXml('..........................'),
      { spaceAfter: 20 }
    ),
  ].join('\n');

  const codeParts: string[] = [
    paragraphXml(textRunXml('MÃ ĐỀ THI', { bold: true, sizeHalfPt: 22, color: '1E3A8A' }), {
      align: 'center',
      spaceAfter: 20,
    }),
    paragraphXml(textRunXml(codeLabel, { bold: true, sizeHalfPt: 44, color: '1E3A8A' }), {
      align: 'center',
      spaceAfter: 40,
    }),
  ];
  if (qrImg) {
    codeParts.push(
      paragraphXml(`<w:r>${buildDrawingXml(qrImg)}</w:r>`, { align: 'center', spaceAfter: 20 })
    );
    codeParts.push(
      paragraphXml(textRunXml('(Mã QR đáp án của mã đề này)', { italic: true, sizeHalfPt: 18, color: '64748B' }), {
        align: 'center',
        spaceAfter: 20,
      })
    );
  }

  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr><w:tr><w:tc><w:tcPr><w:tcW w:w="3300" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>${infoLines}</w:tc><w:tc><w:tcPr><w:tcW w:w="1700" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="EFF6FF"/><w:tcBorders><w:top w:val="single" w:sz="12" w:space="0" w:color="1E3A8A"/><w:left w:val="single" w:sz="12" w:space="0" w:color="1E3A8A"/><w:bottom w:val="single" w:sz="12" w:space="0" w:color="1E3A8A"/><w:right w:val="single" w:sz="12" w:space="0" w:color="1E3A8A"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>${codeParts.join('\n')}</w:tc></w:tr></w:tbl>`;
}

function partHeadingXml(text: string): string {
  return paragraphXml(textRunXml(text, { bold: true }), { spaceBefore: 200, spaceAfter: 100 });
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Bố cục phương án Phần I — cùng triết lý Mẫu 2027: 1 hàng / 2x2 / dọc theo độ dài. */
function optionsXml(q: Question, ctx: RichContext, markAnswers: boolean): string {
  const opts = q.options || [];
  if (opts.length === 0) return '';
  const correctKey = markAnswers
    ? (opts.find((o) => o.isCorrect)?.key ?? (typeof q.correctAnswer === 'string' ? q.correctAnswer : undefined))
    : undefined;

  const letterRun = (letter: string, isCorrect: boolean) =>
    textRunXml(`${letter}. `, {
      bold: true,
      underline: isCorrect,
      color: isCorrect ? MARK_COLOR : undefined,
    });

  const hasBlockAsset = opts.some((o) =>
    splitRichSegs(o.text).some((s) => {
      if (s.type === 'table') return true;
      if (s.type === 'image') {
        const img = ctx.q.images?.[s.index] ? ctx.registry.register(ctx.q.images[s.index]) : null;
        return img ? img.isBlock : false;
      }
      return false;
    })
  );
  const lens = opts.map((o) => richPlainLength(o.text));
  const maxLen = Math.max(0, ...lens);

  const optionRuns = (o: (typeof opts)[number]) => {
    const isCorrect = correctKey !== undefined && o.key === correctKey;
    return letterRun(o.key, isCorrect);
  };

  if (!hasBlockAsset && opts.length === 4 && maxLen <= 20) {
    // 1 hàng 4 phương án, tab stops tại 1/4 - 2/4 - 3/4 bề rộng trang
    const runs: string[] = [];
    opts.forEach((o, i) => {
      if (i > 0) runs.push('<w:r><w:tab/></w:r>');
      runs.push(optionRuns(o));
      runs.push(...runsOfOptionInline(o, ctx));
    });
    return paragraphXml(runs.join(''), { tabsTwips: [2438, 4876, 7314], spaceAfter: 80 });
  }
  if (!hasBlockAsset && opts.length === 4 && maxLen <= 46) {
    const rows: string[] = [];
    for (let r = 0; r < 2; r++) {
      const runs: string[] = [];
      [opts[r * 2], opts[r * 2 + 1]].forEach((o, i) => {
        if (!o) return;
        if (i > 0) runs.push('<w:r><w:tab/></w:r>');
        runs.push(optionRuns(o));
        runs.push(...runsOfOptionInline(o, ctx));
      });
      rows.push(paragraphXml(runs.join(''), { tabsTwips: [4876], spaceAfter: 40 }));
    }
    return rows.join('\n');
  }
  // Dọc: mỗi phương án một đoạn
  return opts
    .map((o) => {
      const prefix = optionRuns(o);
      return richBlocksXml(o.text, ctx, { prefixRunsXml: prefix, para: { indentLeft: 420, spaceAfter: 40 } });
    })
    .join('\n');
}

/** Runs nội tuyến của một phương án (dùng cho bố cục hàng ngang — không chứa khối). */
function runsOfOptionInline(o: { text: string }, ctx: RichContext): string[] {
  const runs: string[] = [];
  for (const seg of splitRichSegs(o.text)) {
    if (seg.type === 'text') runs.push(textRunXml(seg.value));
    else if (seg.type === 'math') runs.push(ctx.pool.ommlFor(seg.value));
    else if (seg.type === 'sub') runs.push(textRunXml(seg.value, { vertAlign: 'subscript' }));
    else if (seg.type === 'sup') runs.push(textRunXml(seg.value, { vertAlign: 'superscript' }));
    else if (seg.type === 'image') {
      const dataUrl = ctx.q.images?.[seg.index];
      const img = dataUrl ? ctx.registry.register(dataUrl) : null;
      runs.push(img ? `<w:r>${buildDrawingXml(img)}</w:r>` : MISSING_IMAGE_RUN);
    }
  }
  return runs;
}

function questionStemXml(q: Question, displayNum: number, ctx: RichContext): string {
  const prefix = textRunXml(`Câu ${displayNum}. `, { bold: true });
  return richBlocksXml(q.content, ctx, {
    prefixRunsXml: prefix,
    para: { spaceBefore: 120, spaceAfter: 60 },
  });
}

function questionsBodyXml(questions: Question[], registry: DocxImageRegistry, markAnswers: boolean): string {
  const effectivePart = (q: Question): string =>
    q.partType ?? (q.options && q.options.length > 0 ? 'part1_choice' : 'other');
  const byPart = {
    part1_choice: questions.filter((q) => effectivePart(q) === 'part1_choice'),
    part2_true_false: questions.filter((q) => effectivePart(q) === 'part2_true_false'),
    part3_short_answer: questions.filter((q) => effectivePart(q) === 'part3_short_answer'),
    part4_essay: questions.filter((q) => effectivePart(q) === 'part4_essay'),
    other: questions.filter(
      (q) => !['part1_choice', 'part2_true_false', 'part3_short_answer', 'part4_essay'].includes(effectivePart(q))
    ),
  };
  const blocks: string[] = [];

  if (byPart.part1_choice.length > 0) {
    blocks.push(
      partHeadingXml(
        `PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu ${byPart.part1_choice.length}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.`
      )
    );
    byPart.part1_choice.forEach((q, i) => {
      const ctx = makeRichContext(q, registry);
      blocks.push(questionStemXml(q, i + 1, ctx));
      blocks.push(optionsXml(q, ctx, markAnswers));
    });
  }

  if (byPart.part2_true_false.length > 0) {
    blocks.push(
      partHeadingXml(
        `PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu ${byPart.part2_true_false.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.`
      )
    );
    byPart.part2_true_false.forEach((q, i) => {
      const ctx = makeRichContext(q, registry);
      blocks.push(questionStemXml(q, i + 1, ctx));
      for (const si of q.subItems || []) {
        const marked = markAnswers && si.isCorrect;
        const prefix = textRunXml(`${si.key}) `, {
          bold: true,
          underline: marked,
          color: marked ? MARK_COLOR : undefined,
        });
        blocks.push(
          richBlocksXml(si.content, ctx, { prefixRunsXml: prefix, para: { indentLeft: 420, spaceAfter: 40 } })
        );
      }
    });
  }

  if (byPart.part3_short_answer.length > 0) {
    blocks.push(
      partHeadingXml(
        `PHẦN III. Câu trắc nghiệm trả lời ngắn. Thí sinh trả lời từ câu 1 đến câu ${byPart.part3_short_answer.length}.`
      )
    );
    byPart.part3_short_answer.forEach((q, i) => {
      const ctx = makeRichContext(q, registry);
      blocks.push(questionStemXml(q, i + 1, ctx));
      if (markAnswers && (q.shortAnswerCorrect || '').toString().trim() !== '') {
        blocks.push(
          paragraphXml(
            textRunXml('Đáp số: ', { bold: true }) + textRunXml(String(q.shortAnswerCorrect), { bold: true }),
            { indentLeft: 420, spaceAfter: 60 }
          )
        );
      }
    });
  }

  if (byPart.part4_essay.length > 0) {
    blocks.push(partHeadingXml('PHẦN IV. Tự luận.'));
    byPart.part4_essay.forEach((q, i) => {
      const ctx = makeRichContext(q, registry);
      blocks.push(questionStemXml(q, i + 1, ctx));
      if (markAnswers && q.essayAnswerGuide) {
        blocks.push(
          paragraphXml(textRunXml('Hướng dẫn chấm: ', { bold: true, italic: true }) + textRunXml(q.essayAnswerGuide, { italic: true }), {
            indentLeft: 420,
            spaceAfter: 60,
          })
        );
      }
    });
  }

  if (byPart.other.length > 0) {
    // Câu thuộc phần hiếm gặp (không rõ kiểu): vẫn in đầy đủ nội dung, không bỏ sót.
    byPart.other.forEach((q, i) => {
      const ctx = makeRichContext(q, registry);
      blocks.push(questionStemXml(q, i + 1, ctx));
      if (q.options && q.options.length > 0) blocks.push(optionsXml(q, ctx, markAnswers));
      if (markAnswers && (q.shortAnswerCorrect || '').toString().trim() !== '') {
        blocks.push(
          paragraphXml(
            textRunXml('Đáp số: ', { bold: true }) + textRunXml(String(q.shortAnswerCorrect), { bold: true }),
            { indentLeft: 420, spaceAfter: 60 }
          )
        );
      }
    });
  }

  blocks.push(
    paragraphXml(textRunXml('-------------------- HẾT --------------------', {}), {
      align: 'center',
      spaceBefore: 160,
      spaceAfter: 80,
    })
  );
  blocks.push(
    paragraphXml(textRunXml('(Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm)', { italic: true }), {
      align: 'center',
      spaceAfter: 160,
    })
  );
  return blocks.join('\n');
}

// ------------------------------------------------------------
// Đóng gói .docx (OpenXML tối thiểu, tương thích Word/LibreOffice)
// ------------------------------------------------------------

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="24"/><w:szCs w:val="24"/>
        <w:lang w:val="vi-VN" w:eastAsia="vi-VN"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="60" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;

const SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
  <w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
  <m:mathPr>
    <m:mathFont m:val="Cambria Math"/>
    <m:brkBin m:val="before"/>
    <m:smallFrac m:val="0"/>
    <m:dispDef/>
    <m:lMargin m:val="0"/>
    <m:rMargin m:val="0"/>
    <m:defJc m:val="centerGroup"/>
    <m:intLim m:val="subSup"/>
    <m:naryLim m:val="undOvr"/>
  </m:mathPr>
</w:settings>`;

const FONT_TABLE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:font w:name="Times New Roman"><w:charset w:val="00"/><w:family w:val="roman"/><w:pitch w:val="variable"/></w:font>
  <w:font w:name="Cambria Math"><w:charset w:val="00"/><w:family w:val="roman"/><w:pitch w:val="variable"/></w:font>
</w:fonts>`;

function footerXml(codeLabel: string): string {
  const field = (instr: string) =>
    `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">— Mã đề ${escapeXmlText(codeLabel)} — Trang </w:t></w:r>${field('PAGE')}<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">/</w:t></w:r>${field('NUMPAGES')}</w:p></w:ftr>`;
}

async function packDocx(bodyInnerXml: string, registry: DocxImageRegistry, codeLabel: string): Promise<Blob> {
  const zip = new JSZip();
  const images = registry.all;
  const hasSvg = images.some((i) => i.isSvg);

  zip.file(
    '[Content_Types].xml',
    encodeUtf8Xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="gif" ContentType="image/gif"/>
  ${hasSvg ? '<Default Extension="svg" ContentType="image/svg+xml"/>' : ''}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`)
  );
  zip.file(
    '_rels/.rels',
    encodeUtf8Xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)
  );

  const rels: string[] = [
    '<Relationship Id="rIdStyles1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rIdSettings1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>',
    '<Relationship Id="rIdFontTable1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>',
    '<Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>',
  ];
  for (const img of images) {
    zip.file(`word/media/${img.fileName}`, dataUrlToUint8Array(img.dataUrl));
    rels.push(
      `<Relationship Id="${img.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.fileName}"/>`
    );
  }
  zip.file(
    'word/_rels/document.xml.rels',
    encodeUtf8Xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels.join('\n  ')}
</Relationships>`)
  );
  zip.file('word/styles.xml', encodeUtf8Xml(STYLES_XML));
  zip.file('word/settings.xml', encodeUtf8Xml(SETTINGS_XML));
  zip.file('word/fontTable.xml', encodeUtf8Xml(FONT_TABLE_XML));
  zip.file('word/footer1.xml', encodeUtf8Xml(footerXml(codeLabel)));

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main">
  <w:body>
    ${bodyInnerXml}
    <w:sectPr>
      <w:footerReference w:type="default" r:id="rIdFooter1"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="850" w:right="1020" w:bottom="850" w:left="1134" w:header="425" w:footer="425" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  zip.file('word/document.xml', encodeUtf8Xml(documentXml));

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/** Dựng thân đầy đủ của một tờ đề (header + ô mã đề + phiếu + câu hỏi). */
function buildPaperBodyXml(
  questions: Question[],
  codeLabel: string,
  meta: PaperMeta,
  opts: PaperOptions,
  registry: DocxImageRegistry
): string {
  const qrImg = opts.qrDataUrl ? registry.register(opts.qrDataUrl) : null;
  if (qrImg) {
    // QR trong ô mã đề: cố định 2.3cm vuông cho cân đối với ô.
    qrImg.widthEmu = Math.round(2.3 * EMU_PER_CM);
    qrImg.heightEmu = Math.round(2.3 * EMU_PER_CM);
    qrImg.isBlock = false;
  }
  const parts: string[] = [headerTableXml(meta), infoAndCodeTableXml(codeLabel, qrImg)];
  if (opts.phieu?.dataUrl) {
    const phieuImg = registry.register(opts.phieu.dataUrl);
    if (phieuImg) {
      phieuImg.widthEmu = opts.phieu.widthEmu;
      phieuImg.heightEmu = opts.phieu.heightEmu;
      parts.push(
        paragraphXml(`<w:r>${buildDrawingXml(phieuImg)}</w:r>`, { align: 'center', spaceBefore: 80, spaceAfter: 40 })
      );
    }
  }
  parts.push(questionsBodyXml(questions, registry, Boolean(opts.markAnswers)));
  return parts.join('\n');
}

// ------------------------------------------------------------
// Bảng đáp án của một biến thể (định dạng EduMix ShuffledVariant)
// ------------------------------------------------------------

export interface MixerVariantKey {
  examCode: string;
  answerKey: MixerAnswerKey;
}

/** Dựng bảng đáp án chuẩn từ chính các câu hỏi của biến thể đã trộn. */
export function buildMixerAnswerKey(result: ShuffledVariantResult): MixerVariantKey {
  const qs = result.quiz.questions || [];
  const p1 = qs.filter((q) => (q.partType || 'part1_choice') === 'part1_choice');
  const p2 = qs.filter((q) => q.partType === 'part2_true_false');
  const p3 = qs.filter((q) => q.partType === 'part3_short_answer');
  const answerKey: MixerAnswerKey = {
    part1: p1.map((q, i) => {
      const letter =
        (typeof q.correctAnswer === 'string' && q.correctAnswer) ||
        q.options?.find((o) => o.isCorrect)?.key ||
        'A';
      return { questionNumber: i + 1, answer: (letter as 'A' | 'B' | 'C' | 'D') || 'A' };
    }),
    part2: p2.map((q, i) => {
      const answers = (q.subItems || []).map((si) => (si.isCorrect ? 'Đ' : 'S')) as ('Đ' | 'S')[];
      return {
        questionNumber: i + 1,
        answers,
        tfString: (q.subItems || []).map((si) => (si.isCorrect ? 'T' : 'F')).join(''),
        dsString: answers.join(''),
      };
    }),
    part3: p3.map((q, i) => ({
      questionNumber: i + 1,
      answer: (q.shortAnswerCorrect ?? '').toString(),
    })),
  };
  return { examCode: String(result.code), answerKey };
}

/** QR PNG (data URL) của riêng một mã đề theo định dạng app chấm đã chọn. */
export async function makeVariantQrDataUrl(
  variantKey: MixerVariantKey,
  format: QRAppFormat = 'QM2025'
): Promise<string> {
  const payload = buildQrPayloadString(variantKey.examCode, variantKey.answerKey, format);
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'L',
    margin: 2,
    width: 380,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

// ------------------------------------------------------------
// Xuất từng tờ đề
// ------------------------------------------------------------

export interface VariantExportOptions extends PaperOptions {
  qrFormat?: QRAppFormat;
  /** Nhúng QR đáp án của mã đề vào ô mã đề (mặc định bật như cấu hình EduMix). */
  embedQrInPaper?: boolean;
}

async function exportPaperDocx(
  questions: Question[],
  codeLabel: string,
  meta: PaperMeta,
  opts: VariantExportOptions,
  variantKey?: MixerVariantKey
): Promise<Blob> {
  const registry = new DocxImageRegistry();
  let qrDataUrl = opts.qrDataUrl ?? null;
  if (!qrDataUrl && opts.embedQrInPaper !== false && variantKey) {
    try {
      qrDataUrl = await makeVariantQrDataUrl(variantKey, opts.qrFormat || 'QM2025');
    } catch {
      qrDataUrl = null;
    }
  }
  const body = buildPaperBodyXml(questions, codeLabel, meta, { ...opts, qrDataUrl }, registry);
  return packDocx(body, registry, codeLabel);
}

/** Tờ đề học sinh (sạch, không đánh dấu đáp án) của một mã đề đã trộn. */
export async function exportVariantPaperDocx(
  result: ShuffledVariantResult,
  meta: PaperMeta,
  opts: VariantExportOptions = {}
): Promise<Blob> {
  return exportPaperDocx(
    result.quiz.questions || [],
    String(result.code),
    meta,
    { ...opts, markAnswers: false },
    buildMixerAnswerKey(result)
  );
}

/** Bản giáo viên có đánh dấu đáp án của một mã đề đã trộn. */
export async function exportVariantSolutionsDocx(
  result: ShuffledVariantResult,
  meta: PaperMeta,
  opts: VariantExportOptions = {}
): Promise<Blob> {
  return exportPaperDocx(
    result.quiz.questions || [],
    String(result.code),
    meta,
    { ...opts, markAnswers: true, embedQrInPaper: false },
    buildMixerAnswerKey(result)
  );
}

/** Tờ đề gốc (chưa trộn) — tương đương "Đề gốc.docx" trong gói của EduMix. */
export async function exportSourcePaperDocx(
  source: Quiz,
  codeLabel: string,
  meta: PaperMeta,
  opts: VariantExportOptions = {}
): Promise<Blob> {
  return exportPaperDocx(source.questions || [], codeLabel, meta, { ...opts, markAnswers: false });
}

// ------------------------------------------------------------
// File Đáp án.docx tổng hợp (kiểu exportMasterAnswerSheetDocx)
// ------------------------------------------------------------

function matrixTableXml(
  keys: MixerVariantKey[],
  rowCount: number,
  cellOf: (key: MixerVariantKey, rowIdx: number) => string
): string {
  if (keys.length === 0 || rowCount === 0) return '';
  const numCols = keys.length + 1;
  const col1Pct = 900;
  const otherPct = Math.floor((5000 - col1Pct) / Math.max(1, keys.length));
  const headerCell = (text: string, pct: number, fill: string) =>
    `<w:tc><w:tcPr><w:tcW w:w="${pct}" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:vAlign w:val="center"/></w:tcPr>${paragraphXml(textRunXml(text, { bold: true, color: 'FFFFFF', sizeHalfPt: 22 }), { align: 'center', spaceBefore: 30, spaceAfter: 30 })}</w:tc>`;
  const headerRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headerCell('CÂU', col1Pct, '1E3A8A')}${keys
    .map((k) => headerCell(`MÃ ${escapeXmlText(k.examCode)}`, otherPct, '0284C7'))
    .join('')}</w:tr>`;
  const bodyRows: string[] = [];
  for (let r = 0; r < rowCount; r++) {
    const fill = r % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
    const cells = [
      `<w:tc><w:tcPr><w:tcW w:w="${col1Pct}" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/><w:vAlign w:val="center"/></w:tcPr>${paragraphXml(textRunXml(String(r + 1), { bold: true, sizeHalfPt: 22 }), { align: 'center', spaceBefore: 30, spaceAfter: 30 })}</w:tc>`,
      ...keys.map(
        (k) =>
          `<w:tc><w:tcPr><w:tcW w:w="${otherPct}" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:vAlign w:val="center"/></w:tcPr>${paragraphXml(textRunXml(cellOf(k, r), { bold: true, sizeHalfPt: 22 }), { align: 'center', spaceBefore: 30, spaceAfter: 30 })}</w:tc>`
      ),
    ];
    bodyRows.push(`<w:tr>${cells.join('')}</w:tr>`);
  }
  void numCols;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/></w:tblBorders></w:tblPr>${headerRow}${bodyRows.join('\n')}</w:tbl>`;
}

function sectionTitleXml(text: string): string {
  return paragraphXml(textRunXml(text, { bold: true, color: '1E3A8A', sizeHalfPt: 26 }), {
    align: 'center',
    spaceBefore: 160,
    spaceAfter: 80,
  });
}

/** Thẻ đáp án 3 cột của một mã đề (port buildVariant3ColumnAnswerCardXml). */
function answerCardXml(key: MixerVariantKey): string {
  const blocks: string[] = [
    paragraphXml(textRunXml(`ĐÁP ÁN MÃ ${key.examCode}`, { bold: true, color: '1E3A8A', sizeHalfPt: 26 }), {
      spaceBefore: 200,
      spaceAfter: 60,
    }),
  ];
  const p1 = key.answerKey.part1;
  if (p1.length > 0) {
    const rows: string[] = [];
    for (let i = 0; i < p1.length; i += 3) {
      const cells: string[] = [];
      for (let c = 0; c < 3; c++) {
        const item = p1[i + c];
        if (item) {
          cells.push(
            `<w:tc><w:tcPr><w:tcW w:w="1666" w:type="pct"/><w:tcBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="BFDBFE"/><w:left w:val="single" w:sz="6" w:space="0" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="BFDBFE"/><w:right w:val="single" w:sz="6" w:space="0" w:color="BFDBFE"/></w:tcBorders></w:tcPr>${paragraphXml(
              textRunXml(`${item.questionNumber}. `, { bold: true, sizeHalfPt: 24 }) +
                textRunXml(item.answer, { bold: true, color: MARK_COLOR, sizeHalfPt: 24 }),
              { align: 'center', spaceBefore: 40, spaceAfter: 40 }
            )}</w:tc>`
          );
        } else {
          cells.push('<w:tc><w:tcPr><w:tcW w:w="1666" w:type="pct"/></w:tcPr><w:p/></w:tc>');
        }
      }
      rows.push(`<w:tr>${cells.join('')}</w:tr>`);
    }
    blocks.push(
      paragraphXml(textRunXml('Phần I — Trắc nghiệm nhiều phương án lựa chọn:', { bold: true, italic: true }), { spaceAfter: 40 })
    );
    blocks.push(`<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr>${rows.join('\n')}</w:tbl>`);
  }
  if (key.answerKey.part2.length > 0) {
    blocks.push(
      paragraphXml(textRunXml('Phần II — Đúng/Sai:', { bold: true, italic: true }), { spaceBefore: 80, spaceAfter: 40 })
    );
    for (const item of key.answerKey.part2) {
      blocks.push(
        paragraphXml(
          textRunXml(`Câu ${item.questionNumber}: `, { bold: true }) +
            textRunXml(`${item.dsString} (${item.tfString})`, {}),
          { indentLeft: 360, spaceAfter: 20 }
        )
      );
    }
  }
  if (key.answerKey.part3.length > 0) {
    blocks.push(
      paragraphXml(textRunXml('Phần III — Trả lời ngắn:', { bold: true, italic: true }), { spaceBefore: 80, spaceAfter: 40 })
    );
    for (const item of key.answerKey.part3) {
      blocks.push(
        paragraphXml(
          textRunXml(`Câu ${item.questionNumber}: `, { bold: true }) + textRunXml(item.answer, { bold: true }),
          { indentLeft: 360, spaceAfter: 20 }
        )
      );
    }
  }
  return blocks.join('\n');
}

/** File Đáp án.docx tổng hợp mọi mã đề: ma trận đối chiếu + thẻ từng mã + bộ 4 QR tổng. */
export async function exportAnswerKeyDocx(keys: MixerVariantKey[], meta: PaperMeta): Promise<Blob> {
  const registry = new DocxImageRegistry();
  const blocks: string[] = [headerTableXml(meta)];
  blocks.push(
    sectionTitleXml(`BẢNG ĐÁP ÁN CHÍNH THỨC (${keys.length} MÃ ĐỀ: ${keys.map((k) => k.examCode).join(', ')})`)
  );

  const maxP1 = Math.max(0, ...keys.map((k) => k.answerKey.part1.length));
  const maxP2 = Math.max(0, ...keys.map((k) => k.answerKey.part2.length));
  const maxP3 = Math.max(0, ...keys.map((k) => k.answerKey.part3.length));
  if (maxP1 > 0) {
    blocks.push(sectionTitleXml('MA TRẬN ĐỐI CHIẾU — PHẦN I'));
    blocks.push(matrixTableXml(keys, maxP1, (k, r) => k.answerKey.part1.find((x) => x.questionNumber === r + 1)?.answer || ''));
  }
  if (maxP2 > 0) {
    blocks.push(sectionTitleXml('MA TRẬN ĐỐI CHIẾU — PHẦN II (Đ/S từng câu)'));
    blocks.push(matrixTableXml(keys, maxP2, (k, r) => k.answerKey.part2.find((x) => x.questionNumber === r + 1)?.dsString || ''));
  }
  if (maxP3 > 0) {
    blocks.push(sectionTitleXml('MA TRẬN ĐỐI CHIẾU — PHẦN III'));
    blocks.push(matrixTableXml(keys, maxP3, (k, r) => k.answerKey.part3.find((x) => x.questionNumber === r + 1)?.answer || ''));
  }

  for (const key of keys) {
    blocks.push(answerCardXml(key));
  }

  // Bộ QR tổng hợp theo cụm tối đa 8 mã/QR như EduMix.
  const totalBatches = Math.ceil(keys.length / MAX_CODES_PER_SINGLE_QR);
  for (let b = 0; b < totalBatches; b++) {
    const batch = keys.slice(b * MAX_CODES_PER_SINGLE_QR, (b + 1) * MAX_CODES_PER_SINGLE_QR);
    const rangeLabel =
      batch.length === 1 ? batch[0].examCode : `${batch[0].examCode} – ${batch[batch.length - 1].examCode}`;
    const triple = await generateTripleGradingQrSet(batch);
    const items = [
      { label: '1. QM 2025', item: triple.qm2025, color: '92400E' },
      { label: '2. TNMAKER', item: triple.tnmaker, color: '1E40AF' },
      { label: '3. AZOTA', item: triple.azota, color: '065F46' },
      { label: '4. UNT DẠY HỌC', item: triple.unt, color: '7E22CE' },
    ].filter((x) => x.item.qrDataUrl);
    if (items.length === 0) continue;
    blocks.push(sectionTitleXml(`BỘ MÃ QR CHẤM THI TỔNG HỢP — ĐỀ ${rangeLabel} (QUÉT 1 LẦN NẠP ĐỦ KEY)`));
    const cells = items
      .map((x) => {
        const img = registry.register(x.item.qrDataUrl);
        if (!img) return '';
        img.widthEmu = Math.round(3.4 * EMU_PER_CM);
        img.heightEmu = Math.round(3.4 * EMU_PER_CM);
        img.isBlock = false;
        return `<w:tc><w:tcPr><w:tcW w:w="1250" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>${paragraphXml(textRunXml(x.label, { bold: true, sizeHalfPt: 18, color: x.color }), { align: 'center', spaceAfter: 20 })}${paragraphXml(`<w:r>${buildDrawingXml(img)}</w:r>`, { align: 'center', spaceAfter: 20 })}</w:tc>`;
      })
      .join('');
    blocks.push(
      `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/></w:tblBorders></w:tblPr><w:tr>${cells}</w:tr></w:tbl>`
    );
  }

  if (meta.teacherName) {
    blocks.push(
      paragraphXml(textRunXml(`Giáo viên ra đề: ${meta.teacherName}`, { italic: true }), {
        align: 'right',
        spaceBefore: 200,
      })
    );
  }

  const codesLabel = keys.length > 0 ? `${keys[0].examCode}–${keys[keys.length - 1].examCode}` : 'ĐÁP ÁN';
  return packDocx(blocks.join('\n'), registry, codesLabel);
}

// ------------------------------------------------------------
// Gói ZIP trọn bộ — cấu trúc 2 thư mục như EduMix
// ------------------------------------------------------------

function cleanFileSegment(name: string): string {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();
}

export interface BundleOptions extends VariantExportOptions {
  phieuInfo?: PhieuQMInfo | null;
  phieuDataUrl?: string | null;
}

/** Đóng gói trọn bộ: Thư mục đề + Thư mục đáp án (đề từng mã, đáp án, QR, Excel, CSV, phiếu). */
export async function exportMixerBundleZip(
  source: Quiz,
  sourceCodeLabel: string,
  results: ShuffledVariantResult[],
  meta: PaperMeta,
  opts: BundleOptions = {}
): Promise<Blob> {
  const zip = new JSZip();
  const deFolder = zip.folder('Thư mục đề');
  const daFolder = zip.folder('Thư mục đáp án');
  const keys = results.map((r) => buildMixerAnswerKey(r));
  const phieu = opts.phieuDataUrl
    ? {
        dataUrl: opts.phieuDataUrl,
        widthEmu: opts.phieuInfo?.widthEmu ?? 5943600,
        heightEmu: opts.phieuInfo?.heightEmu ?? 2952750,
      }
    : null;

  const sourceBlob = await exportSourcePaperDocx(source, sourceCodeLabel, meta, { ...opts, phieu });
  deFolder?.file('Đề gốc.docx', sourceBlob);

  for (const r of results) {
    const paper = await exportVariantPaperDocx(r, meta, { ...opts, phieu });
    deFolder?.file(`Đề ${cleanFileSegment(String(r.code))}.docx`, paper);
    const solutions = await exportVariantSolutionsDocx(r, meta, { ...opts });
    daFolder?.file(`Đề ${cleanFileSegment(String(r.code))} — Có đáp án.docx`, solutions);
  }

  const answerDocx = await exportAnswerKeyDocx(keys, meta);
  daFolder?.file('Đáp án.docx', answerDocx);

  // QR từng mã (định dạng chính đã chọn) + payload văn bản
  const payloadLines: string[] = [];
  for (const key of keys) {
    try {
      const qrUrl = await makeVariantQrDataUrl(key, opts.qrFormat || 'QM2025');
      daFolder?.file(`Mã QR — Đề ${cleanFileSegment(key.examCode)}.png`, dataUrlToUint8Array(qrUrl));
    } catch {
      // QR lỗi không chặn cả gói — payload vẫn có trong file văn bản bên dưới
    }
    payloadLines.push(
      `=== MÃ ${key.examCode} — QM 2025 ===\n${buildQrPayloadString(key.examCode, key.answerKey, 'QM2025')}\n` +
        `=== MÃ ${key.examCode} — TNMAKER ===\n${buildQrPayloadString(key.examCode, key.answerKey, 'TNMAKER')}\n` +
        `=== MÃ ${key.examCode} — AZOTA ===\n${buildQrPayloadString(key.examCode, key.answerKey, 'AZOTA')}\n` +
        `=== MÃ ${key.examCode} — UNT ===\n${buildQrPayloadString(key.examCode, key.answerKey, 'UNT')}\n`
    );
  }

  // Bộ QR tổng hợp theo cụm 8 mã + 4 file Excel chấm
  const totalBatches = Math.ceil(keys.length / MAX_CODES_PER_SINGLE_QR);
  for (let b = 0; b < totalBatches; b++) {
    const batch = keys.slice(b * MAX_CODES_PER_SINGLE_QR, (b + 1) * MAX_CODES_PER_SINGLE_QR);
    const rangeLabel =
      batch.length === 1 ? batch[0].examCode : `${batch[0].examCode}-${batch[batch.length - 1].examCode}`;
    const suffix = totalBatches === 1 ? '' : ` (Cụm ${b + 1}: Đề ${rangeLabel})`;
    const triple = await generateTripleGradingQrSet(batch);
    if (triple.qm2025.qrDataUrl) daFolder?.file(`Mã QR QM 2025${suffix}.png`, dataUrlToUint8Array(triple.qm2025.qrDataUrl));
    if (triple.tnmaker.qrDataUrl) daFolder?.file(`Mã QR TNMaker${suffix}.png`, dataUrlToUint8Array(triple.tnmaker.qrDataUrl));
    if (triple.azota.qrDataUrl) daFolder?.file(`Mã QR Azota${suffix}.png`, dataUrlToUint8Array(triple.azota.qrDataUrl));
    if (triple.unt.qrDataUrl) daFolder?.file(`Mã QR UnT Dạy Học${suffix}.png`, dataUrlToUint8Array(triple.unt.qrDataUrl));
  }
  const [xlsxQm, xlsxTn, xlsxAz, xlsxUnt] = await Promise.all([
    exportGradingExcelXlsx(keys, 'QM2025'),
    exportGradingExcelXlsx(keys, 'TNMAKER'),
    exportGradingExcelXlsx(keys, 'AZOTA'),
    exportGradingExcelXlsx(keys, 'UNT'),
  ]);
  daFolder?.file('Excel QM 2025.xlsx', xlsxQm);
  daFolder?.file('Excel TNMaker.xlsx', xlsxTn);
  daFolder?.file('Excel Azota.xlsx', xlsxAz);
  daFolder?.file('Excel UnT Dạy Học.xlsx', xlsxUnt);

  if (payloadLines.length > 0) {
    daFolder?.file('Mã QR Payload.txt', new TextEncoder().encode(payloadLines.join('\n').normalize('NFC')));
  }

  const csvLines: string[] = [
    'Ma_De,Phan_I_ABCD,Phan_II_DungSai,Phan_III_TraLoiNgan,Nguoi_Ra_De,QR_Payload_QM2025,QR_Payload_TNMaker,QR_Payload_Azota,QR_Payload_UnT',
  ];
  const teacherStr = (meta.teacherName || '').replace(/"/g, '""');
  for (const key of keys) {
    const p1 = key.answerKey.part1.map((x) => `${x.questionNumber}${x.answer}`).join(' ');
    const p2 = key.answerKey.part2.map((x) => `${x.questionNumber}:${x.dsString}(${x.tfString})`).join(' ');
    const p3 = key.answerKey.part3.map((x) => `${x.questionNumber}=${x.answer}`).join(' ');
    const esc = (s: string) => s.replace(/"/g, '""');
    csvLines.push(
      `"${key.examCode}","${p1}","${p2}","${p3}","${teacherStr}","${esc(buildQrPayloadString(key.examCode, key.answerKey, 'QM2025'))}","${esc(buildQrPayloadString(key.examCode, key.answerKey, 'TNMAKER'))}","${esc(buildQrPayloadString(key.examCode, key.answerKey, 'AZOTA'))}","${esc(buildQrPayloadString(key.examCode, key.answerKey, 'UNT'))}"`
    );
  }
  daFolder?.file('Đáp án tổng hợp.csv', new TextEncoder().encode(('\uFEFF' + csvLines.join('\n')).normalize('NFC')));

  if (opts.phieuDataUrl) {
    daFolder?.file('Phiếu trả lời trắc nghiệm.jpg', dataUrlToUint8Array(opts.phieuDataUrl));
  }

  return zip.generateAsync({ type: 'blob' });
}

/** Kích hoạt tải xuống trên trình duyệt. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 400);
}
