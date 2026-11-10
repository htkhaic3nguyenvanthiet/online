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

// ------------------------------------------------------------
// SVG -> PNG nét cao cho bản Word giấy.
// Công thức MathType (WMF->SVG) nếu nhúng dạng svgBlip thì Word
// <2019 và WPS KHÔNG hiển thị được. Vì vậy khi xuất đề giấy, mọi
// ảnh SVG được raster hoá thành PNG ở độ phân giải cao (≈300 dpi
// tại kích thước hiển thị, tối thiểu gấp 3 lần điểm ảnh hiển thị)
// — PNG thì mọi phiên bản Word đều đọc được. Chỉ khi raster hoá
// thất bại mới lùi về nhúng vector, và trường hợp đó được ĐẾM vào
// registry.svgRasterFailures để báo lên giao diện, không im lặng.
// Bản hiển thị trên web (RichText) không đổi: trình duyệt vẽ SVG.
// ------------------------------------------------------------

export type SvgRasterizer = (
  svgDataUrl: string,
  widthPx: number,
  heightPx: number
) => Promise<string | null>;

/** Rasterizer mặc định trên trình duyệt: vẽ SVG lên canvas. */
async function canvasRasterizeSvg(
  svgDataUrl: string,
  widthPx: number,
  heightPx: number
): Promise<string | null> {
  try {
    if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
    const bytes = dataUrlToUint8Array(svgDataUrl);
    const blob = new Blob([bytes as unknown as BlobPart], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Không nạp được SVG'));
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(widthPx));
      canvas.height = Math.max(1, Math.round(heightPx));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const png = canvas.toDataURL('image/png');
      return dataUrlMime(png).includes('png') ? png : null;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

let activeSvgRasterizer: SvgRasterizer = canvasRasterizeSvg;

/** Thay rasterizer (môi trường kiểm thử Node dùng resvg; để null để về mặc định canvas). */
export function setSvgRasterizer(fn: SvgRasterizer | null): void {
  activeSvgRasterizer = fn ?? canvasRasterizeSvg;
}

/** Kích thước điểm ảnh đích khi raster hoá một SVG hiển thị ở widthEmu x heightEmu. */
function svgRasterTargetPx(widthEmu: number, heightEmu: number): { w: number; h: number } {
  const px = (emu: number) => {
    const at300Dpi = (emu / 914400) * 300; // EMU/inch = 914400
    const tripleDisplay = (emu / 9525) * 3; // EMU/px ở 96dpi = 9525
    return Math.min(4096, Math.max(16, Math.round(Math.max(at300Dpi, tripleDisplay))));
  };
  return { w: px(widthEmu), h: px(heightEmu) };
}

/** Kích thước hiển thị (EMU) của một SVG: khai báo trong file, hoặc mặc định như register(). */
function svgDisplayEmu(svgText: string): { wEmu: number; hEmu: number } {
  const declared = svgDeclaredSize(svgText);
  if (declared) return declared;
  return { wEmu: Math.round(4 * EMU_PER_CM), hEmu: Math.round(1.2 * EMU_PER_CM) };
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
  /** svgDataUrl gốc -> PNG dataUrl đã raster hoá (chỉ dùng khi ảnh thật sự được vẽ). */
  private svgRasterCache = new Map<string, string>();
  private svgRasterAttempted = new Set<string>();
  /** Số ảnh SVG không raster hoá được -> register() lùi về nhúng vector svgBlip. */
  svgRasterFailures = 0;

  /**
   * Raster hoá trước một ảnh SVG của đề thành PNG nét cao. Gọi (await)
   * cho mọi SVG trong các câu hỏi TRƯỚC khi dựng thân file; register()
   * sau đó tự thay bản PNG khi ảnh được nhúng. Thất bại được đếm vào
   * svgRasterFailures và register() giữ đường vector làm phương án cuối.
   */
  async prepareSvgRaster(dataUrl: string): Promise<void> {
    if (!dataUrl || typeof dataUrl !== 'string') return;
    if (!dataUrlMime(dataUrl).includes('svg')) return;
    if (this.svgRasterAttempted.has(dataUrl)) return;
    this.svgRasterAttempted.add(dataUrl);
    let bytes: Uint8Array;
    try {
      bytes = dataUrlToUint8Array(dataUrl);
    } catch {
      this.svgRasterFailures += 1;
      return;
    }
    const headText = new TextDecoder().decode(bytes.slice(0, 2048));
    const { wEmu, hEmu } = svgDisplayEmu(headText);
    const target = svgRasterTargetPx(wEmu, hEmu);
    let png: string | null = null;
    try {
      png = await activeSvgRasterizer(dataUrl, target.w, target.h);
    } catch {
      png = null;
    }
    if (png && dataUrlMime(png).includes('png')) {
      this.svgRasterCache.set(dataUrl, png);
    } else {
      this.svgRasterFailures += 1;
    }
  }

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

    // SVG đã raster hoá sẵn (prepareSvgRaster) -> nhúng bản PNG nét cao
    // thay cho vector, để Word <2019/WPS cũng hiển thị được. Kích thước
    // hiển thị giữ nguyên theo khai báo của SVG.
    let outDataUrl = dataUrl;
    let outIsSvg = isSvg;
    let outMime = mime;
    if (isSvg) {
      const raster = this.svgRasterCache.get(dataUrl);
      if (raster) {
        outDataUrl = raster;
        outIsSvg = false;
        outMime = 'image/png';
      }
    }

    const ext = outIsSvg
      ? 'svg'
      : outMime.includes('png')
        ? 'png'
        : outMime.includes('gif')
          ? 'gif'
          : outMime.includes('webp')
            ? 'webp'
            : 'jpg';
    this.seq += 1;
    const img: EmbeddedImage = {
      relId: `rIdImg${this.seq}`,
      fileName: `image${this.seq}.${ext}`,
      dataUrl: outDataUrl,
      mime: outMime || (outIsSvg ? 'image/svg+xml' : 'image/jpeg'),
      isSvg: outIsSvg,
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

/** Ô thông tin thí sinh + ô MÃ ĐỀ (chỉ chữ đậm, KHÔNG mã QR trên tờ đề — QR chỉ nằm ở file đáp án). */
function infoAndCodeTableXml(codeLabel: string): string {
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

  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr><w:tr><w:tc><w:tcPr><w:tcW w:w="3300" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>${infoLines}</w:tc><w:tc><w:tcPr><w:tcW w:w="1700" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="EFF6FF"/><w:tcBorders><w:top w:val="single" w:sz="12" w:space="0" w:color="1E3A8A"/><w:left w:val="single" w:sz="12" w:space="0" w:color="1E3A8A"/><w:bottom w:val="single" w:sz="12" w:space="0" w:color="1E3A8A"/><w:right w:val="single" w:sz="12" w:space="0" w:color="1E3A8A"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>${codeParts.join('\n')}</w:tc></w:tr></w:tbl>`;
}

function partHeadingXml(text: string): string {
  return paragraphXml(textRunXml(text, { bold: true }), { spaceBefore: 200, spaceAfter: 100 });
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

// ------------------------------------------------------------
// Bố cục phương án PHẦN I theo Mẫu 2027 (1X4 / 2X2 / dọc bằng TAB
// ĐỘNG) — port trung thực thuật toán của bản mẫu chuẩn
// (series50/build_dethu_mau.py):
// - Mốc theo SỐ TỪ của phương án dài nhất: <=12 từ -> 1X4;
//   13-25 từ -> 2X2; >=26 từ -> xếp dọc.
// - Bề rộng từng phương án đo bằng metric Liberation Serif (tương
//   thích Times New Roman) ở 12pt, hệ số an toàn 1.015 — bảng bề
//   rộng ký tự (phần nghìn em) trích từ chính font đó.
// - Tab stop ĐỘNG: vị trí cộng dồn theo bề rộng thật của từng
//   phương án trong câu (+ đệm 0,35 cm ở 1X4, 0,45 cm ở 2X2).
// - Fit-fallback: dạng theo mốc mà không vừa bề rộng dòng khả
//   dụng thì lùi xuống dạng dưới — không bao giờ vỡ dòng/lệch cột.
// - Phương án KHÔNG bao giờ nằm trong bảng.
// ------------------------------------------------------------

/** Bề rộng ký tự Times New Roman 12pt (phần nghìn em, metric Liberation Serif). */
const TNR_ADV1000: Record<number, number> = {
  32:250, 33:333, 34:408, 35:500, 36:500, 37:833, 38:778, 39:180, 40:333, 41:333,
  42:500, 43:564, 44:250, 45:333, 46:250, 47:278, 48:500, 49:500, 50:500, 51:500,
  52:500, 53:500, 54:500, 55:500, 56:500, 57:500, 58:278, 59:278, 60:564, 61:564,
  62:564, 63:444, 64:921, 65:722, 66:667, 67:667, 68:722, 69:611, 70:556, 71:722,
  72:722, 73:333, 74:389, 75:722, 76:611, 77:889, 78:722, 79:722, 80:556, 81:722,
  82:667, 83:556, 84:611, 85:722, 86:722, 87:944, 88:722, 89:722, 90:611, 91:333,
  92:278, 93:333, 94:469, 95:500, 96:333, 97:444, 98:500, 99:444, 100:500, 101:444,
  102:333, 103:500, 104:500, 105:278, 106:278, 107:500, 108:278, 109:778, 110:500, 111:500,
  112:500, 113:500, 114:333, 115:389, 116:278, 117:500, 118:500, 119:722, 120:500, 121:500,
  122:444, 123:480, 124:200, 125:480, 126:541, 160:250, 161:333, 162:500, 163:500, 164:500,
  165:500, 166:200, 167:500, 168:333, 169:760, 170:276, 171:500, 172:564, 173:333, 174:760,
  175:500, 176:400, 177:549, 178:300, 179:300, 180:333, 181:576, 182:453, 183:333, 184:333,
  185:300, 186:310, 187:500, 188:750, 189:750, 190:750, 191:444, 192:722, 193:722, 194:722,
  195:722, 196:722, 197:722, 198:889, 199:667, 200:611, 201:611, 202:611, 203:611, 204:333,
  205:333, 206:333, 207:333, 208:722, 209:722, 210:722, 211:722, 212:722, 213:722, 214:722,
  215:564, 216:722, 217:722, 218:722, 219:722, 220:722, 221:722, 222:556, 223:500, 224:444,
  225:444, 226:444, 227:444, 228:444, 229:444, 230:667, 231:444, 232:444, 233:444, 234:444,
  235:444, 236:278, 237:278, 238:278, 239:278, 240:500, 241:500, 242:500, 243:500, 244:500,
  245:500, 246:500, 247:549, 248:500, 249:500, 250:500, 251:500, 252:500, 253:500, 254:500,
  255:500, 256:722, 257:444, 258:722, 259:444, 260:722, 261:444, 262:667, 263:444, 264:667,
  265:444, 266:667, 267:444, 268:667, 269:444, 270:722, 271:646, 272:722, 273:500, 274:611,
  275:444, 276:611, 277:444, 278:611, 279:444, 280:611, 281:444, 282:611, 283:444, 284:722,
  285:500, 286:722, 287:500, 288:722, 289:500, 290:722, 291:500, 292:722, 293:500, 294:722,
  295:500, 296:333, 297:278, 298:333, 299:278, 300:333, 301:278, 302:333, 303:278, 304:333,
  305:278, 306:708, 307:552, 308:389, 309:278, 310:722, 311:500, 312:500, 313:611, 314:278,
  315:611, 316:278, 317:611, 318:406, 319:611, 320:344, 321:611, 322:278, 323:722, 324:500,
  325:722, 326:500, 327:722, 328:500, 329:604, 330:702, 331:495, 332:722, 333:500, 334:722,
  335:500, 336:722, 337:500, 338:889, 339:722, 340:667, 341:333, 342:667, 343:333, 344:667,
  345:333, 346:556, 347:389, 348:556, 349:389, 350:556, 351:389, 352:556, 353:389, 354:611,
  355:278, 356:611, 357:427, 358:611, 359:278, 360:722, 361:500, 362:722, 363:500, 364:722,
  365:500, 366:722, 367:500, 368:722, 369:500, 370:722, 371:500, 372:944, 373:722, 374:722,
  375:500, 376:722, 377:611, 378:444, 379:611, 380:444, 381:611, 382:444, 383:278, 384:500,
  385:760, 386:574, 387:500, 388:574, 389:500, 390:667, 391:667, 392:444, 393:722, 394:815,
  395:574, 396:500, 397:471, 398:611, 399:722, 400:501, 401:556, 402:500, 403:722, 404:722,
  405:770, 406:253, 407:333, 408:722, 409:500, 410:278, 411:485, 412:816, 413:722, 414:500,
  415:722, 416:722, 417:529, 418:925, 419:691, 420:650, 421:500, 422:556, 423:556, 424:389,
  425:582, 426:344, 427:278, 428:611, 429:278, 430:611, 431:776, 432:542, 433:743, 434:722,
  435:781, 436:500, 437:611, 438:444, 439:539, 440:539, 441:444, 442:444, 443:500, 444:500,
  445:443, 446:422, 447:500, 448:200, 449:281, 450:249, 451:333, 452:1333, 453:1166, 454:944,
  455:1000, 456:889, 457:556, 458:1111, 459:1000, 460:778, 461:722, 462:444, 463:333, 464:278,
  465:722, 466:500, 467:722, 468:500, 469:722, 470:500, 471:722, 472:500, 473:722, 474:500,
  475:722, 476:500, 477:444, 478:722, 479:444, 480:722, 481:444, 482:889, 483:667, 484:722,
  485:500, 486:722, 487:500, 488:722, 489:500, 490:722, 491:500, 492:722, 493:500, 494:539,
  495:444, 496:278, 497:1333, 498:1166, 499:944, 500:722, 501:500, 502:950, 503:560, 504:722,
  505:500, 506:722, 507:444, 508:889, 509:667, 510:722, 511:500, 512:722, 513:444, 514:722,
  515:444, 516:611, 517:444, 518:611, 519:444, 520:333, 521:278, 522:333, 523:278, 524:722,
  525:500, 526:722, 527:500, 528:667, 529:333, 530:667, 531:333, 532:722, 533:500, 534:722,
  535:500, 536:556, 537:389, 538:611, 539:278, 540:563, 541:395, 542:722, 543:500, 544:650,
  545:500, 546:604, 547:500, 548:611, 549:444, 550:722, 551:444, 552:611, 553:444, 554:722,
  555:500, 556:722, 557:500, 558:722, 559:500, 560:722, 561:500, 562:722, 563:500, 564:278,
  565:500, 566:317, 567:278, 568:774, 569:772, 570:722, 571:667, 572:500, 573:611, 574:611,
  575:389, 576:444, 577:534, 578:397, 579:667, 580:722, 581:725, 582:611, 583:444, 584:389,
  585:278, 586:702, 587:500, 588:667, 589:333, 590:722, 591:500, 768:0, 769:0, 770:0,
  771:0, 772:0, 773:0, 774:0, 775:0, 776:0, 777:0, 778:0, 779:0, 780:0,
  781:0, 782:0, 783:0, 784:0, 785:0, 786:0, 787:0, 788:0, 789:0, 790:0,
  791:0, 792:0, 793:0, 794:0, 795:0, 796:0, 797:0, 798:0, 799:0, 800:0,
  801:0, 802:0, 803:0, 804:0, 805:0, 806:0, 807:0, 808:0, 809:0, 810:0,
  811:0, 812:0, 813:0, 814:0, 815:0, 816:0, 817:0, 818:0, 819:0, 820:0,
  821:0, 822:0, 823:0, 824:0, 825:0, 826:0, 827:0, 828:0, 829:0, 830:0,
  831:0, 832:0, 833:0, 834:0, 835:0, 836:0, 837:0, 838:0, 839:0, 840:0,
  841:0, 842:0, 843:0, 844:0, 845:0, 846:0, 847:0, 848:0, 849:0, 850:0,
  851:0, 852:0, 853:0, 854:0, 855:0, 856:0, 857:0, 858:0, 859:0, 860:0,
  861:0, 862:0, 863:0, 864:0, 865:0, 866:0, 867:0, 868:0, 869:0, 870:0,
  871:0, 872:0, 873:0, 874:0, 875:0, 876:0, 877:0, 878:0, 879:0, 884:333,
  885:333, 890:333, 891:444, 892:444, 893:444, 894:278, 900:333, 901:333, 902:722, 903:278,
  904:694, 905:808, 906:411, 908:722, 910:816, 911:743, 912:269, 913:722, 914:667, 915:578,
  916:643, 917:611, 918:611, 919:722, 920:722, 921:333, 922:722, 923:725, 924:889, 925:722,
  926:643, 927:722, 928:722, 929:556, 931:582, 932:611, 933:722, 934:731, 935:722, 936:738,
  937:743, 938:333, 939:722, 940:524, 941:420, 942:523, 943:269, 944:495, 945:524, 946:509,
  947:442, 948:471, 949:420, 950:414, 951:523, 952:479, 953:269, 954:504, 955:485, 956:536,
  957:452, 958:446, 959:500, 960:505, 961:499, 962:396, 963:539, 964:402, 965:495, 966:577,
  967:444, 968:626, 969:658, 970:269, 971:495, 972:500, 973:495, 974:658, 7680:722, 7681:444,
  7682:667, 7683:500, 7684:667, 7685:500, 7686:667, 7687:500, 7688:667, 7689:444, 7690:722, 7691:500,
  7692:722, 7693:500, 7694:722, 7695:500, 7696:722, 7697:500, 7698:722, 7699:500, 7700:611, 7701:444,
  7702:611, 7703:444, 7704:611, 7705:444, 7706:611, 7707:444, 7708:611, 7709:444, 7710:556, 7711:333,
  7712:722, 7713:500, 7714:722, 7715:500, 7716:722, 7717:500, 7718:722, 7719:500, 7720:722, 7721:500,
  7722:722, 7723:500, 7724:333, 7725:278, 7726:333, 7727:278, 7728:722, 7729:500, 7730:722, 7731:500,
  7732:722, 7733:500, 7734:611, 7735:278, 7736:611, 7737:278, 7738:611, 7739:278, 7740:611, 7741:278,
  7742:889, 7743:778, 7744:889, 7745:778, 7746:889, 7747:778, 7748:722, 7749:500, 7750:722, 7751:500,
  7752:722, 7753:500, 7754:722, 7755:500, 7756:722, 7757:500, 7758:722, 7759:500, 7760:722, 7761:500,
  7762:722, 7763:500, 7764:556, 7765:500, 7766:556, 7767:500, 7768:667, 7769:333, 7770:667, 7771:333,
  7772:667, 7773:333, 7774:667, 7775:333, 7776:556, 7777:389, 7778:556, 7779:389, 7780:556, 7781:389,
  7782:556, 7783:389, 7784:556, 7785:389, 7786:611, 7787:278, 7788:611, 7789:278, 7790:611, 7791:278,
  7792:611, 7793:278, 7794:722, 7795:500, 7796:722, 7797:500, 7798:722, 7799:500, 7800:722, 7801:500,
  7802:722, 7803:500, 7804:722, 7805:500, 7806:722, 7807:500, 7808:944, 7809:722, 7810:944, 7811:722,
  7812:944, 7813:722, 7814:944, 7815:722, 7816:944, 7817:722, 7818:722, 7819:500, 7820:722, 7821:500,
  7822:722, 7823:500, 7824:611, 7825:444, 7826:611, 7827:444, 7828:611, 7829:444, 7830:500, 7831:278,
  7832:722, 7833:500, 7834:444, 7835:278, 7838:713, 7840:722, 7841:444, 7842:722, 7843:444, 7844:722,
  7845:444, 7846:722, 7847:444, 7848:722, 7849:444, 7850:722, 7851:444, 7852:722, 7853:444, 7854:722,
  7855:444, 7856:722, 7857:444, 7858:722, 7859:444, 7860:722, 7861:444, 7862:722, 7863:444, 7864:611,
  7865:444, 7866:611, 7867:444, 7868:611, 7869:444, 7870:611, 7871:444, 7872:611, 7873:444, 7874:611,
  7875:444, 7876:611, 7877:444, 7878:611, 7879:444, 7880:333, 7881:278, 7882:333, 7883:278, 7884:722,
  7885:500, 7886:722, 7887:500, 7888:722, 7889:500, 7890:722, 7891:500, 7892:722, 7893:500, 7894:722,
  7895:500, 7896:722, 7897:500, 7898:722, 7899:529, 7900:722, 7901:529, 7902:722, 7903:529, 7904:722,
  7905:529, 7906:722, 7907:529, 7908:722, 7909:500, 7910:722, 7911:500, 7912:776, 7913:542, 7914:776,
  7915:542, 7916:776, 7917:542, 7918:776, 7919:542, 7920:776, 7921:542, 7922:722, 7923:500, 7924:722,
  7925:500, 7926:722, 7927:500, 7928:722, 7929:500, 8208:333, 8210:500, 8211:500, 8212:1000, 8213:1000,
  8214:281, 8215:500, 8216:333, 8217:333, 8218:333, 8219:333, 8220:444, 8221:444, 8222:444, 8223:444,
  8224:500, 8225:500, 8226:350, 8230:1000, 8240:1000, 8242:219, 8243:417, 8244:417, 8249:333, 8250:333,
  8260:167, 8308:349, 8309:349, 8310:349, 8311:349, 8312:349, 8313:349, 8320:349, 8321:349, 8322:349,
  8323:349, 8324:349, 8325:349, 8326:349, 8327:349, 8328:349, 8329:349, 8363:513, 8592:1000, 8593:500,
  8594:1000, 8595:500, 8596:1000, 8597:500, 8616:500, 8706:494, 8710:612, 8719:823, 8721:713, 8722:564,
  8725:167, 8729:250, 8730:549, 8734:713, 8735:979, 8745:722, 8747:274, 8776:549, 8800:549, 8801:564,
  8802:1000, 8804:549, 8805:549,
};

/** Đo bề rộng hiển thị (cm) của một chuỗi ở Times New Roman 12pt như bản mẫu. */
export function measureTextCm(text: string): number {
  let ems = 0;
  for (const ch of String(text || '')) {
    const cp = ch.codePointAt(0) || 0;
    const adv = TNR_ADV1000[cp];
    ems += (adv !== undefined ? adv : 500) / 1000;
  }
  // em -> point o 12pt -> cm, he so an toan 1.015 nhu build_dethu_mau.py
  return ems * 12 * (2.54 / 72) * 1.015;
}

const CM_TO_TWIPS = 566.929;
function cmToTwips(cm: number): number {
  return Math.round(cm * CM_TO_TWIPS);
}

/** Bề rộng dòng khả dụng của tờ đề (cm): trang A4 tru le, tru thut le 0,3 cm cua khoi phuong an. */
export const OPTION_AVAIL_CM = (11906 - 1134 - 1020) / CM_TO_TWIPS - 0.3;

export type OptionBand = '1X4' | '2X2' | 'DOC';

/**
 * Chọn dải trình bày + vị trí tab stop (cm, tuyệt đối từ lề trái vùng
 * chữ) đúng thuật toán mẫu: mốc số từ, kiểm tra vừa dòng, lùi dải.
 * segWidthsCm[i] là bề rộng của "nhãn + nội dung" phương án i.
 */
export function computeOptionBand(
  wordCounts: number[],
  segWidthsCm: number[],
  availCm: number = OPTION_AVAIL_CM
): { band: OptionBand; stopsCm: number[] } {
  const maxWords = Math.max(0, ...wordCounts);
  let band: OptionBand = maxWords <= 12 ? '1X4' : maxWords <= 25 ? '2X2' : 'DOC';
  const seg = (i: number) => segWidthsCm[i] || 0;
  if (band === '1X4' && segWidthsCm.reduce((a, b) => a + b, 0) + 3 * 0.35 > availCm) {
    band = '2X2';
  }
  if (band === '2X2') {
    const stopRel = Math.max(seg(0), seg(2)) + 0.45;
    if (stopRel + Math.max(seg(1), seg(3)) > availCm) {
      band = 'DOC';
    } else {
      return { band, stopsCm: [Math.round((0.3 + stopRel) * 100) / 100] };
    }
  }
  if (band === '1X4') {
    let x = 0.3;
    const stops: number[] = [];
    for (let i = 0; i < 3; i++) {
      x += seg(i) + 0.35;
      stops.push(Math.round(x * 100) / 100);
    }
    return { band, stopsCm: stops };
  }
  return { band: 'DOC', stopsCm: [] };
}

/** Đo một phương án: số từ, bề rộng hiển thị (cm) của "nhãn + nội dung", có tài sản khối (bảng/ảnh lớn) hay không. */
function measureOption(
  letter: string,
  o: { text: string },
  ctx: RichContext
): { words: number; widthCm: number; hasBlock: boolean } {
  let plain = '';
  let imgWidthCm = 0;
  let hasBlock = false;
  for (const seg of splitRichSegs(o.text || '')) {
    if (seg.type === 'text' || seg.type === 'sub' || seg.type === 'sup') {
      plain += seg.value;
    } else if (seg.type === 'math') {
      plain += ` ${seg.value} `;
    } else if (seg.type === 'table') {
      hasBlock = true;
    } else if (seg.type === 'image') {
      const dataUrl = ctx.q.images?.[seg.index];
      const img = dataUrl ? ctx.registry.register(dataUrl) : null;
      if (img) {
        imgWidthCm += img.widthEmu / EMU_PER_CM;
        if (img.isBlock) hasBlock = true;
      }
    }
  }
  const words = plain.split(/\s+/).filter(Boolean).length;
  return { words, widthCm: measureTextCm(`${letter}. ${plain}`) + imgWidthCm, hasBlock };
}

const OPTION_INDENT_TWIPS = cmToTwips(0.3);

/** Bố cục phương án Phần I — đúng Mẫu 2027: dải 1X4 / 2X2 / dọc theo số từ, tab stop động đo theo bề rộng thật. */
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

  const optionRuns = (o: (typeof opts)[number]) =>
    letterRun(o.key, correctKey !== undefined && o.key === correctKey);

  const measures = opts.map((o) => measureOption(o.key, o, ctx));
  const layout: { band: OptionBand; stopsCm: number[] } =
    opts.length === 4 && !measures.some((m) => m.hasBlock)
      ? computeOptionBand(
          measures.map((m) => m.words),
          measures.map((m) => m.widthCm)
        )
      : { band: 'DOC', stopsCm: [] };

  if (layout.band === '1X4') {
    // 4 phương án trên MỘT dòng, tab stop động sau từng phương án
    const runs: string[] = [];
    opts.forEach((o, i) => {
      if (i > 0) runs.push('<w:r><w:tab/></w:r>');
      runs.push(optionRuns(o));
      runs.push(...runsOfOptionInline(o, ctx));
    });
    return paragraphXml(runs.join(''), {
      tabsTwips: layout.stopsCm.map(cmToTwips),
      indentLeft: OPTION_INDENT_TWIPS,
      spaceAfter: 80,
    });
  }
  if (layout.band === '2X2') {
    // 2 phương án/dòng x 2 dòng, một tab stop động chung cho cả câu
    const rows: string[] = [];
    for (let r = 0; r < 2; r++) {
      const runs: string[] = [];
      [opts[r * 2], opts[r * 2 + 1]].forEach((o, i) => {
        if (!o) return;
        if (i > 0) runs.push('<w:r><w:tab/></w:r>');
        runs.push(optionRuns(o));
        runs.push(...runsOfOptionInline(o, ctx));
      });
      rows.push(
        paragraphXml(runs.join(''), {
          tabsTwips: layout.stopsCm.map(cmToTwips),
          indentLeft: OPTION_INDENT_TWIPS,
          spaceAfter: 40,
        })
      );
    }
    return rows.join('\n');
  }
  // Dọc: mỗi phương án một đoạn, thụt lề 0,6 cm như bản mẫu
  return opts
    .map((o) => {
      const prefix = optionRuns(o);
      return richBlocksXml(o.text, ctx, {
        prefixRunsXml: prefix,
        para: { indentLeft: cmToTwips(0.6), spaceAfter: 40 },
      });
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
  const parts: string[] = [headerTableXml(meta), infoAndCodeTableXml(codeLabel)];
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
  /** Được gọi khi có cảnh báo trong lúc xuất (vd vài ảnh SVG không raster hoá được sang PNG). */
  onExportWarning?: (message: string) => void;
}

/** Raster hoá trước mọi ảnh SVG trong các câu hỏi vào registry (để register() thay bản PNG). */
async function prepareQuestionSvgRasters(
  registry: DocxImageRegistry,
  questions: Question[]
): Promise<void> {
  const urls = new Set<string>();
  for (const q of questions) {
    for (const u of q.images || []) {
      if (u && dataUrlMime(u).includes('svg')) urls.add(u);
    }
  }
  for (const u of urls) {
    await registry.prepareSvgRaster(u);
  }
}

async function exportPaperDocx(
  questions: Question[],
  codeLabel: string,
  meta: PaperMeta,
  opts: VariantExportOptions
): Promise<Blob> {
  const registry = new DocxImageRegistry();
  await prepareQuestionSvgRasters(registry, questions);
  // Tờ đề KHÔNG chứa mã QR (chỉ đạo của Thầy): ô MÃ ĐỀ chỉ in chữ đậm.
  // QR chỉ nằm ở mục QR trong file Đáp án.docx và các file PNG tải riêng.
  const body = buildPaperBodyXml(questions, codeLabel, meta, opts, registry);
  const blob = await packDocx(body, registry, codeLabel);
  if (registry.svgRasterFailures > 0 && opts.onExportWarning) {
    try {
      opts.onExportWarning(
        `Có ${registry.svgRasterFailures} công thức/hình dạng vector không chuyển được sang ảnh PNG nét cao — trong file Word vừa xuất, các mục này được giữ dạng vector (chỉ Word 2019 trở lên mới hiển thị; Word cũ/WPS có thể không hiện).`
      );
    } catch {
      // Cảnh báo lỗi không được làm hỏng file đã xuất
    }
  }
  return blob;
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
    { ...opts, markAnswers: false }
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
    { ...opts, markAnswers: true }
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

function sectionTitleXml(text: string): string {
  return paragraphXml(textRunXml(text, { bold: true, color: '1E3A8A', sizeHalfPt: 26 }), {
    align: 'center',
    spaceBefore: 160,
    spaceAfter: 80,
  });
}

/** Bảng tổng hợp đáp án Câu x Mã (mọi mã, mọi phần) — Times New Roman 12pt, kẻ bảng gọn như đề chuẩn. */
function matrixTableXml(
  keys: MixerVariantKey[],
  rowCount: number,
  cellOf: (key: MixerVariantKey, rowIdx: number) => string
): string {
  if (keys.length === 0 || rowCount === 0) return '';
  const col1Pct = 900;
  const otherPct = Math.floor((5000 - col1Pct) / Math.max(1, keys.length));
  const headerCell = (text: string, pct: number, fill: string) =>
    `<w:tc><w:tcPr><w:tcW w:w="${pct}" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:vAlign w:val="center"/></w:tcPr>${paragraphXml(textRunXml(text, { bold: true, color: 'FFFFFF' }), { align: 'center', spaceBefore: 30, spaceAfter: 30 })}</w:tc>`;
  const headerRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headerCell('CÂU', col1Pct, '1E3A8A')}${keys
    .map((k) => headerCell(`MÃ ${escapeXmlText(k.examCode)}`, otherPct, '0284C7'))
    .join('')}</w:tr>`;
  const bodyRows: string[] = [];
  for (let r = 0; r < rowCount; r++) {
    const fill = r % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
    const cells = [
      `<w:tc><w:tcPr><w:tcW w:w="${col1Pct}" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/><w:vAlign w:val="center"/></w:tcPr>${paragraphXml(textRunXml(String(r + 1), { bold: true }), { align: 'center', spaceBefore: 30, spaceAfter: 30 })}</w:tc>`,
      ...keys.map(
        (k) =>
          `<w:tc><w:tcPr><w:tcW w:w="${otherPct}" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:vAlign w:val="center"/></w:tcPr>${paragraphXml(textRunXml(cellOf(k, r), { bold: true }), { align: 'center', spaceBefore: 30, spaceAfter: 30 })}</w:tc>`
      ),
    ];
    bodyRows.push(`<w:tr>${cells.join('')}</w:tr>`);
  }
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/></w:tblBorders></w:tblPr>${headerRow}${bodyRows.join('\n')}</w:tbl>`;
}

/** Tiêu đề chính của file đáp án — đậm, đen, 12pt, căn giữa như phần đáp án đề tốt nghiệp. */
function answerDocTitleXml(text: string): string {
  return paragraphXml(textRunXml(text, { bold: true }), {
    align: 'center',
    spaceBefore: 160,
    spaceAfter: 100,
  });
}

/** Tiêu đề nhỏ trong phần đáp án (MÃ ĐỀ / PHẦN I / PHẦN II / PHẦN III) — đậm, đen, 12pt. */
function answerHeadingXml(text: string): string {
  return paragraphXml(textRunXml(text, { bold: true }), { spaceBefore: 160, spaceAfter: 60 });
}

/**
 * File Đáp án.docx — tài liệu đáp án DUY NHẤT của một đợt trộn, gồm đúng
 * 3 thành phần (chỉ đạo của Thầy):
 * 1) Bảng tổng hợp các mã đề (Câu x Mã) cho cả 3 phần;
 * 2) Đề gốc CÓ ĐÁP ÁN — toàn bộ đề gốc chưa trộn, đánh dấu đáp án đúng
 *    theo chuẩn đề tốt nghiệp (chỉ chữ cái đầu của phương án/ý đúng:
 *    đậm + gạch chân + đỏ RGB(220,20,60));
 * 3) Bộ mã QR chấm thi tổng hợp của 4 phần mềm (QM 2025/TNMaker/Azota/UnT).
 */
export async function exportAnswerKeyDocx(
  keys: MixerVariantKey[],
  meta: PaperMeta,
  source: Quiz,
  opts: { onExportWarning?: (message: string) => void } = {}
): Promise<Blob> {
  const registry = new DocxImageRegistry();
  const sourceQuestions = source.questions || [];
  await prepareQuestionSvgRasters(registry, sourceQuestions);
  const blocks: string[] = [headerTableXml(meta)];
  blocks.push(
    answerDocTitleXml(`BẢNG ĐÁP ÁN CHÍNH THỨC (${keys.length} MÃ ĐỀ: ${keys.map((k) => k.examCode).join(', ')})`)
  );

  // 1) Bảng tổng hợp các mã đề
  blocks.push(answerHeadingXml('BẢNG TỔNG HỢP CÁC MÃ ĐỀ'));
  const maxP1 = Math.max(0, ...keys.map((k) => k.answerKey.part1.length));
  const maxP2 = Math.max(0, ...keys.map((k) => k.answerKey.part2.length));
  const maxP3 = Math.max(0, ...keys.map((k) => k.answerKey.part3.length));
  if (maxP1 > 0) {
    blocks.push(answerHeadingXml('PHẦN I'));
    blocks.push(matrixTableXml(keys, maxP1, (k, r) => k.answerKey.part1.find((x) => x.questionNumber === r + 1)?.answer || ''));
  }
  if (maxP2 > 0) {
    blocks.push(answerHeadingXml('PHẦN II'));
    blocks.push(matrixTableXml(keys, maxP2, (k, r) => k.answerKey.part2.find((x) => x.questionNumber === r + 1)?.dsString || ''));
  }
  if (maxP3 > 0) {
    blocks.push(answerHeadingXml('PHẦN III'));
    blocks.push(matrixTableXml(keys, maxP3, (k, r) => k.answerKey.part3.find((x) => x.questionNumber === r + 1)?.answer || ''));
  }

  // 2) Đề gốc có đáp án (ngắt trang trước cho gọn)
  blocks.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
  blocks.push(answerHeadingXml('ĐỀ GỐC CÓ ĐÁP ÁN'));
  if (source.title) {
    blocks.push(paragraphXml(textRunXml(source.title, { italic: true }), { spaceAfter: 80 }));
  }
  blocks.push(questionsBodyXml(sourceQuestions, registry, true));

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
  const blob = await packDocx(blocks.join('\n'), registry, codesLabel);
  if (registry.svgRasterFailures > 0 && opts.onExportWarning) {
    try {
      opts.onExportWarning(
        `Có ${registry.svgRasterFailures} công thức/hình dạng vector trong đề gốc không chuyển được sang ảnh PNG nét cao — trong file đáp án vừa xuất, các mục này được giữ dạng vector (chỉ Word 2019 trở lên mới hiển thị; Word cũ/WPS có thể không hiện).`
      );
    } catch {
      // Cảnh báo lỗi không được làm hỏng file đã xuất
    }
  }
  return blob;
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

/**
 * Đóng gói trọn bộ: Thư mục đề (đề gốc + đề từng mã + QR PNG + phiếu) và
 * Thư mục đáp án CHỈ chứa duy nhất Đáp án.docx (bảng tổng hợp + đề gốc có
 * đáp án + bộ QR 4 phần mềm) — theo chỉ đạo của Thầy, không thêm file đáp án nào khác.
 */
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
  }

  // Thư mục đáp án: CHỈ một file Đáp án.docx duy nhất.
  const answerDocx = await exportAnswerKeyDocx(keys, meta, source, {
    onExportWarning: opts.onExportWarning,
  });
  daFolder?.file('Đáp án.docx', answerDocx);

  // QR từng mã (định dạng chính đã chọn) — tải riêng ở phía ĐỀ.
  for (const key of keys) {
    try {
      const qrUrl = await makeVariantQrDataUrl(key, opts.qrFormat || 'QM2025');
      deFolder?.file(`Mã QR — Đề ${cleanFileSegment(key.examCode)}.png`, dataUrlToUint8Array(qrUrl));
    } catch {
      // QR lỗi không chặn cả gói — đáp án đầy đủ vẫn nằm trong Đáp án.docx
    }
  }

  // Bộ QR tổng hợp theo cụm 8 mã — cũng ở phía ĐỀ.
  const totalBatches = Math.ceil(keys.length / MAX_CODES_PER_SINGLE_QR);
  for (let b = 0; b < totalBatches; b++) {
    const batch = keys.slice(b * MAX_CODES_PER_SINGLE_QR, (b + 1) * MAX_CODES_PER_SINGLE_QR);
    const rangeLabel =
      batch.length === 1 ? batch[0].examCode : `${batch[0].examCode}-${batch[batch.length - 1].examCode}`;
    const suffix = totalBatches === 1 ? '' : ` (Cụm ${b + 1}: Đề ${rangeLabel})`;
    const triple = await generateTripleGradingQrSet(batch);
    if (triple.qm2025.qrDataUrl) deFolder?.file(`Mã QR QM 2025${suffix}.png`, dataUrlToUint8Array(triple.qm2025.qrDataUrl));
    if (triple.tnmaker.qrDataUrl) deFolder?.file(`Mã QR TNMaker${suffix}.png`, dataUrlToUint8Array(triple.tnmaker.qrDataUrl));
    if (triple.azota.qrDataUrl) deFolder?.file(`Mã QR Azota${suffix}.png`, dataUrlToUint8Array(triple.azota.qrDataUrl));
    if (triple.unt.qrDataUrl) deFolder?.file(`Mã QR UnT Dạy Học${suffix}.png`, dataUrlToUint8Array(triple.unt.qrDataUrl));
  }

  if (opts.phieuDataUrl) {
    deFolder?.file('Phiếu trả lời trắc nghiệm.jpg', dataUrlToUint8Array(opts.phieuDataUrl));
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
