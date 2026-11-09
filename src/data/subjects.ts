/**
 * Danh mục môn học dùng chung cho toàn bộ ứng dụng (nguồn sự thật duy nhất).
 *
 * Mọi dropdown chọn môn (tạo đề, sửa đề...) đều phải lấy từ đây — KHÔNG ghi
 * cứng danh sách môn ở từng component nữa.
 *
 * LƯU Ý TƯƠNG THÍCH: các chuỗi môn đã tồn tại trong dữ liệu cũ phải giữ
 * nguyên từng ký tự ("Công nghệ 12", "Công nghệ 10", "Sinh học 11",
 * "Sinh học 12", "Toán học 12", "Vật lí 12", "Hóa học 12") để đề/phiên thi
 * đã lưu vẫn khớp. Bộ đọc Word (wordExamParser) cũng chỉ được trả về các
 * chuỗi nằm trong SUBJECT_OPTIONS.
 */

export interface SubjectGroup {
  /** Tên môn (nhãn của <optgroup>) */
  label: string;
  /** Các giá trị môn theo khối lớp, VD "Toán học 10" */
  subjects: string[];
}

const gradesOf = (base: string): string[] => [`${base} 10`, `${base} 11`, `${base} 12`];

export const SUBJECT_GROUPS: SubjectGroup[] = [
  { label: 'Toán học', subjects: gradesOf('Toán học') },
  { label: 'Vật lí', subjects: gradesOf('Vật lí') },
  { label: 'Hóa học', subjects: gradesOf('Hóa học') },
  { label: 'Sinh học', subjects: gradesOf('Sinh học') },
  { label: 'Công nghệ', subjects: gradesOf('Công nghệ') },
  { label: 'Ngữ văn', subjects: gradesOf('Ngữ văn') },
  { label: 'Tiếng Anh', subjects: gradesOf('Tiếng Anh') },
  { label: 'Lịch sử', subjects: gradesOf('Lịch sử') },
  { label: 'Địa lí', subjects: gradesOf('Địa lí') },
  {
    label: 'Giáo dục kinh tế và pháp luật',
    subjects: gradesOf('Giáo dục kinh tế và pháp luật'),
  },
  { label: 'Tin học', subjects: gradesOf('Tin học') },
  { label: 'Khác', subjects: ['Khác'] },
];

/** Toàn bộ giá trị môn hợp lệ, phẳng, theo đúng thứ tự hiển thị. */
export const SUBJECT_OPTIONS: string[] = SUBJECT_GROUPS.flatMap((g) => g.subjects);

/** Môn mặc định khi không nhận diện được (giữ hành vi cũ của hệ thống). */
export const DEFAULT_SUBJECT = 'Công nghệ 12';

export function isKnownSubject(value: string | null | undefined): boolean {
  return !!value && SUBJECT_OPTIONS.includes(value);
}
