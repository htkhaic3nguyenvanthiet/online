// ============================================================
// PHIẾU TRẢ LỜI TRẮC NGHIỆM QM 2025 — kho mẫu phiếu của EduMix.
// 4 mẫu phiếu chính thức (ảnh JPEG) được trích nguyên vẹn từ
// EduMix sang thư mục public/assets của trang online; module này
// giữ metadata + quy tắc chọn phiếu (AUTO theo môn như EduMix)
// và nạp ảnh phiếu thành data URL khi xuất đề giấy.
// ============================================================

export type PhieuQMCode = 'AUTO' | 'TOAN' | 'KHTN_DIA' | 'NGOAI_NGU' | 'KHXH_CN_TIN';

export interface PhieuQMInfo {
  groupCode: Exclude<PhieuQMCode, 'AUTO'>;
  groupName: string;
  subjectsLabel: string;
  structureDesc: string;
  standardFileName: string;
  /** Đường dẫn tương đối trong public/assets */
  assetPath: string;
  widthEmu: number;
  heightEmu: number;
}

export const PHIEU_QM_TEMPLATES: PhieuQMInfo[] = [
  {
    groupCode: 'TOAN',
    groupName: 'Môn Toán (Mặc định)',
    subjectsLabel: 'Toán học',
    structureDesc: 'Phần I: 12 câu | Phần II: 4 câu | Phần III: 6 câu',
    standardFileName: 'phieu_toan.jpg',
    assetPath: 'assets/phieu_toan.jpg',
    widthEmu: 5943600, // 16.5 cm — khít lề A4
    heightEmu: 2952750, // ~8.2 cm theo tỷ lệ gốc QM 2025
  },
  {
    groupCode: 'KHTN_DIA',
    groupName: 'Nhóm KHTN & Địa (Mặc định)',
    subjectsLabel: 'Sinh học, Vật lí, Hóa học, Địa lí',
    structureDesc: 'Phần I: 18 câu | Phần II: 4 câu | Phần III: 6 câu',
    standardFileName: 'phieu_khtn.jpg',
    assetPath: 'assets/phieu_khtn.jpg',
    widthEmu: 5943600,
    heightEmu: 2952750,
  },
  {
    groupCode: 'NGOAI_NGU',
    groupName: 'Môn Ngoại ngữ (Mặc định)',
    subjectsLabel: 'Tiếng Anh, Ngoại ngữ khác',
    structureDesc: 'Phần I: 40 câu trắc nghiệm 4 lựa chọn',
    standardFileName: 'phieu_ngoaingu.jpg',
    assetPath: 'assets/phieu_ngoaingu.jpg',
    widthEmu: 5943600,
    heightEmu: 2952750,
  },
  {
    groupCode: 'KHXH_CN_TIN',
    groupName: 'Nhóm KHXH, CN, Tin (Mặc định)',
    subjectsLabel: 'Lịch sử, Tin học, Công nghệ, GD Kinh tế & Pháp luật',
    structureDesc: 'Phần I: 24 câu | Phần II: 6 câu (Không có Phần III)',
    standardFileName: 'phieu_khxh.jpg',
    assetPath: 'assets/phieu_khxh.jpg',
    widthEmu: 5943600,
    heightEmu: 2952750,
  },
];

/** Chọn mẫu phiếu theo môn học — đúng quy tắc của EduMix. */
export function getPhieuQMInfoBySubject(subjectName: string): PhieuQMInfo {
  const sub = (subjectName || '').toLowerCase();
  if (sub.includes('toán') || sub.includes('toan')) return PHIEU_QM_TEMPLATES[0];
  if (
    sub.includes('sinh') ||
    sub.includes('lí') ||
    sub.includes('lý') ||
    sub.includes('ly') ||
    sub.includes('hóa') ||
    sub.includes('hoa') ||
    sub.includes('địa') ||
    sub.includes('dia')
  ) {
    return PHIEU_QM_TEMPLATES[1];
  }
  if (sub.includes('anh') || sub.includes('ngoại ngữ') || sub.includes('ngoai ngu')) {
    return PHIEU_QM_TEMPLATES[2];
  }
  return PHIEU_QM_TEMPLATES[3];
}

export function resolvePhieuQMInfo(code: PhieuQMCode, subjectName: string): PhieuQMInfo {
  if (code && code !== 'AUTO') {
    const found = PHIEU_QM_TEMPLATES.find((t) => t.groupCode === code);
    if (found) return found;
  }
  return getPhieuQMInfoBySubject(subjectName);
}

const dataUrlCache = new Map<string, string>();

/**
 * Nạp ảnh phiếu thành data URL (chỉ chạy trên trình duyệt — file
 * nằm cùng máy chủ tĩnh với trang). Trả null nếu nạp thất bại để
 * nơi gọi tự quyết định bỏ qua phiếu thay vì chặn cả bộ đề.
 */
export async function loadPhieuQMDataUrl(info: PhieuQMInfo): Promise<string | null> {
  const cached = dataUrlCache.get(info.assetPath);
  if (cached) return cached;
  try {
    const base = (import.meta as any)?.env?.BASE_URL || '/';
    const url = `${base}${info.assetPath}`.replace(/\/{2,}/g, '/');
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    if (dataUrl.startsWith('data:image')) {
      dataUrlCache.set(info.assetPath, dataUrl);
      return dataUrl;
    }
    return null;
  } catch {
    return null;
  }
}
