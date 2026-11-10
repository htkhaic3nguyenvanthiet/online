import { Quiz, Question } from '../types/quiz';
import { validatePart3Answer } from './wordExamParser';

// ============================================================
// CỔNG CHUẨN 100% CỦA MỤC TRỘN ĐỀ (chỉ đạo cứng của Thầy:
// "đảm bảo chuẩn 100% mới cho nhấn nút trộn đề" — không có
// nút bỏ qua). Nút TRỘN ĐỀ chỉ bật khi validateMixerSource
// trả về ok=true trên BẢN LÀM VIỆC (đề gốc sau khi sửa trong
// khung soạn). Mọi vấn đề đều chỉ rõ câu để Thầy bấm nhảy tới
// khung sửa và sửa tại đó.
//
// Quy tắc kiểm tra:
// CẤP ĐỀ: đã chọn đề gốc; đề có ít nhất 1 câu hỏi.
// TỪNG CÂU:
//  - Thân câu có nội dung: chữ HOẶC tài sản gắn kèm (hình ⟦img:⟧,
//    bảng ⟦table⟧, công thức \(...\) — đoạn chỉ có công thức/hình
//    vẫn tính là có nội dung, đúng bài học từ EduMix).
//  - Không còn cảnh báo đọc file (parseWarnings) chưa được giáo
//    viên mở câu ra kiểm tra và xác nhận trong khung sửa.
//  - Phần I: mọi phương án đều có nội dung (chữ hoặc hình/công
//    thức); có ĐÚNG MỘT đáp án đúng được xác định.
//  - Phần II: đủ đúng 4 ý; mỗi ý có nội dung và đã xác định rõ
//    Đúng/Sai (isCorrect là boolean).
//  - Phần III: có đáp án và đáp án tuân thủ quy tắc số của Thầy
//    (chỉ chữ số, dấu trừ đầu nếu âm, một dấu phẩy thập phân,
//    tổng tối đa 4 ký tự — validatePart3Answer).
//  - Câu không xác định được thuộc phần nào → không đạt.
// ============================================================

export interface MixerIssue {
  /** Chỉ số câu trong mảng questions của đề; -1 = vấn đề cấp đề. */
  questionIndex: number;
  /** Nhãn hiển thị kiểu "Câu 3" (đánh số trong từng phần như đề in). */
  questionLabel: string;
  message: string;
}

export interface MixerValidationResult {
  ok: boolean;
  issues: MixerIssue[];
}

function resolvePart(q: Question): string {
  if (q.partType) return q.partType;
  if (q.options?.length) return 'part1_choice';
  if (q.subItems?.length) return 'part2_true_false';
  if (q.shortAnswerCorrect !== undefined || typeof q.correctAnswer === 'string') {
    return 'part3_short_answer';
  }
  return '';
}

/** Văn bản thuần của một đoạn giàu: công thức giữ phần lõi, marker hình/bảng bỏ. */
function plainOf(text: string | undefined): string {
  return (text || '')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$1')
    .replace(/⟦(?:sub|sup):([^⟧]*)⟧/g, '$1')
    .replace(/⟦[^⟧]*⟧/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Có nội dung = có chữ sau khi gỡ marker, hoặc có hình/bảng/công thức gắn kèm. */
export function hasRichContent(text: string | undefined): boolean {
  const t = text || '';
  if (/⟦img:|⟦table⟧/.test(t)) return true;
  return plainOf(t) !== '';
}

export function validateMixerSource(quiz: Quiz | null): MixerValidationResult {
  const issues: MixerIssue[] = [];
  if (!quiz) {
    return {
      ok: false,
      issues: [{ questionIndex: -1, questionLabel: '', message: 'Chưa chọn đề gốc' }],
    };
  }
  const questions = quiz.questions || [];
  if (questions.length === 0) {
    issues.push({ questionIndex: -1, questionLabel: '', message: 'Đề chưa có câu hỏi nào' });
  }

  const counters: Record<string, number> = {};
  questions.forEach((q, idx) => {
    const part = resolvePart(q);
    const labelPart = part || 'part4_essay';
    counters[labelPart] = (counters[labelPart] || 0) + 1;
    const label = `Câu ${counters[labelPart]}`;
    const push = (message: string) => issues.push({ questionIndex: idx, questionLabel: label, message });

    if (!part) {
      push(`${label} chưa xác định được thuộc phần nào của đề`);
    }
    if (!hasRichContent(q.content)) {
      push(`${label} chưa có nội dung câu hỏi`);
    }
    const warns = q.parseWarnings || [];
    if (warns.length > 0) {
      push(
        `${label} còn ${warns.length} cảnh báo đọc file chưa xác nhận — mở câu này trong khung sửa, kiểm tra rồi bấm xác nhận từng cảnh báo`
      );
    }

    if (part === 'part1_choice') {
      const opts = q.options || [];
      if (opts.length === 0) push(`${label} chưa có phương án`);
      opts.forEach((o, i) => {
        if (!hasRichContent(o.text)) push(`${label} phương án ${o.key || 'ABCD'[i] || ''} trống`);
      });
      const nCorrect = opts.filter((o) => o.isCorrect).length;
      if (opts.length > 0 && nCorrect === 0) push(`${label} chưa có đáp án đúng`);
      if (nCorrect > 1) push(`${label} có nhiều hơn 1 đáp án đúng`);
    } else if (part === 'part2_true_false') {
      const subs = q.subItems || [];
      if (subs.length !== 4) push(`${label} phải có đủ 4 ý Đúng/Sai (hiện có ${subs.length})`);
      subs.forEach((s, i) => {
        if (!hasRichContent(s.content)) push(`${label} ý ${s.key || 'abcd'[i] || ''} trống`);
        if (typeof s.isCorrect !== 'boolean') {
          push(`${label} ý ${s.key || 'abcd'[i] || ''} chưa xác định Đúng/Sai`);
        }
      });
    } else if (part === 'part3_short_answer') {
      const ans = (q.shortAnswerCorrect ?? q.correctAnswer ?? '').toString().trim();
      if (!ans) {
        push(`${label} chưa có đáp án`);
      } else {
        const v = validatePart3Answer(ans);
        if (v) push(`${label}: ${v}`);
      }
    }
  });

  return { ok: issues.length === 0, issues };
}
