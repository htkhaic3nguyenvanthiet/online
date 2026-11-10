// ============================================================
// XOÁ SẠCH DỮ LIỆU TRANG TRỘN ĐỀ (riêng tư — máy tính dùng chung
// ở trường): khi giáo viên tải xong trọn bộ, mọi dữ liệu đã nạp
// trên trang phải biến mất không lưu vết.
//
// File này chỉ chứa logic THUẦN chọn đúng các đề trong Kho cần gỡ:
// đó là các đề biến thể đã lưu TỪ CHÍNH PHIÊN TRỘN NÀY (đã ghi lại
// id + sourceQuizId lúc bấm "Lưu vào Kho đề"), đối chiếu thêm
// shuffleMeta.sourceQuizId của bản trong kho cho chắc chắn.
// Không bao giờ chọn: đề gốc, đề lưu từ phiên khác, đề tạo tay,
// phiên thi hay bài nộp (các thứ đó không nằm trong danh sách này).
// ============================================================

import { Quiz } from '../types/quiz';

/** Một biến thể đã lưu vào kho trong phiên trộn hiện tại. */
export interface SavedVariantRef {
  id: string;
  sourceQuizId: string;
}

/**
 * Tính danh sách id trong Kho đề cần gỡ khi xoá sạch trang trộn đề:
 * đúng các biến thể đã lưu trong phiên này (khớp id VÀ khớp
 * shuffleMeta.sourceQuizId), không hơn không kém.
 */
export function planMixerWipe(library: Quiz[], saved: SavedVariantRef[]): string[] {
  if (!saved || saved.length === 0) return [];
  const byId = new Map((library || []).map((q) => [q.id, q]));
  const out: string[] = [];
  for (const ref of saved) {
    const q = byId.get(ref.id);
    if (q && q.shuffleMeta && q.shuffleMeta.sourceQuizId === ref.sourceQuizId) {
      out.push(q.id);
    }
  }
  return out;
}
