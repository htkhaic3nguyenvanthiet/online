export type OptionKey = 'A' | 'B' | 'C' | 'D';

export type PartType = 'part1_choice' | 'part2_true_false' | 'part3_short_answer' | 'part4_essay';

export interface SubQuestionItem {
  key: 'a' | 'b' | 'c' | 'd';
  content: string;
  isCorrect: boolean; // true = Đúng, false = Sai
}

export interface Question {
  id: string;
  order: number;
  content: string;
  partType?: PartType;
  // Phần I: 4 lựa chọn A, B, C, D
  options?: {
    key: OptionKey;
    text: string;
    isCorrect?: boolean;
  }[];
  correctAnswer?: OptionKey | string;
  // Phần II: 4 ý Đúng/Sai a), b), c), d)
  subItems?: SubQuestionItem[];
  // Phần III: Trả lời ngắn tối đa 4 ký tự (ví dụ A.1234 -> '1234')
  shortAnswerCorrect?: string;
  // Phần IV: Câu hỏi tự luận
  essayAnswerGuide?: string;
  explanation?: string;
  points: number;
  // --- Nội dung giàu (Phase B) — mọi trường đều tùy chọn, đề cũ không có vẫn chạy ---
  // Ảnh nhúng gắn cứng trong câu hỏi; marker ⟦img:N⟧ trong content/options/subItems
  // trỏ theo chỉ số của mảng này (data URI, đã nén khi import). Phần tử '' nghĩa là
  // hình không đọc được — giao diện hiện khung cảnh báo, không bịa hình thay thế.
  images?: string[];
  // Bảng dẫn liệu có cấu trúc (hàng x cột, hàng đầu là tiêu đề); marker ⟦table⟧
  // trong content đánh dấu vị trí hiển thị bảng.
  table?: string[][];
  // Bản văn bản phẳng của thân câu (công thức đã tuyến tính hóa, ví dụ (2x+1)/(x-1))
  // dùng cho tiêu đề, tìm kiếm và các ngữ cảnh không render được LaTeX.
  contentPlain?: string;
  // XML OMML gốc của các công thức trong câu — giữ lại để sau này xuất Word
  // trung thực (phát lại OMML gốc thay vì chuyển đổi vòng), như EduMix vẫn lưu.
  ommlXml?: string[];
  // Cảnh báo phát sinh khi import câu này (phương án rỗng, đáp án Phần III sai
  // quy tắc số thuần 1–4 ký tự, công thức chưa đọc được...). Chỉ để hiển thị.
  parseWarnings?: string[];
  // Các cảnh báo đọc file mà giáo viên ĐÃ mở câu ra kiểm tra và xác nhận ổn
  // ngay trong khung sửa đề gốc của mục Trộn đề (chuyển từ parseWarnings sang).
  acknowledgedParseWarnings?: string[];
}

export interface Quiz {
  id: string;
  title: string;
  fileName: string;
  subject: string;
  grade: string;
  createdAt: string;
  questionCount: number;
  breakdown: string; // e.g. "18-4-6-0" as seen in screenshot
  durationMinutes: number;
  totalPoints: number;
  folder?: string;
  isInteractive?: boolean;
  questions: Question[];
  // Siêu dữ liệu trộn đề (Phase C): chỉ có trên các đề là biến thể đã trộn.
  // seed để tái lập đúng biến thể này; distribution là phân bố đáp án đúng
  // Phần I (A/B/C/D) của biến thể.
  shuffleMeta?: {
    seed: number;
    baseCode: number;
    code: number;
    sourceQuizId: string;
    distribution: { A: number; B: number; C: number; D: number };
  };
  // Trọng số điểm từng phần đọc được từ chính file Word khi import (Phase B) —
  // dùng làm mặc định khi tạo phiên thi thay cho hằng số 0.25 ghi cứng.
  scoringHints?: {
    part1PointPerQuestion: number;
    part2PointPerQuestion: number;
    part3PointPerQuestion: number;
  };
}

export interface Student {
  id: string;
  fullName: string;
  studentCode: string;
  avatarUrl?: string;
  lastScore?: number;
  completedExams: number;
}

export interface Classroom {
  id: string;
  name: string;
  studentCount: number;
  academicYear: string;
  createdAt: string;
  code: string;
  teacherName: string;
  students: Student[];
}

export interface AntiCheatConfig {
  maxTabSwitches: number; // e.g. 3
  autoSubmitOnExceed: boolean;
  requireFullscreen: boolean;
  preventCopyPaste: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  blockAIInExam: boolean; // strictly block AI tutor during live exam
}

export interface ExamScoringConfig {
  totalPoints: number; // Mặc định 10.0đ (Thông tư 22)
  durationMinutes: number; // Thời gian làm bài
  // Điểm số mỗi câu ở từng phần:
  part1PointPerQuestion: number; // Điểm mỗi câu Phần I (Mặc định 0.25đ)
  part2PointPerQuestion: number; // Điểm tối đa mỗi câu Phần II (Mặc định 1.0đ)
  part2SubItemPoints?: { 1: number; 2: number; 3: number; 4: number }; // Thang điểm lũy tiến 1, 2, 3, 4 ý đúng ở Phần II
  part3PointPerQuestion: number; // Điểm mỗi câu Phần III (Mặc định 0.25đ)
  part4PointPerQuestion?: number; // Điểm mỗi câu Tự luận Phần IV (Mặc định 0.5đ / 1.0đ)
  // Tùy chọn xem đáp án & điều kiện đủ điểm
  allowViewAnswerKey: boolean; // Cho phép xem đáp án sau khi nộp (true / false)
  viewAnswerMinScore: number; // Đủ bao nhiêu điểm mới mở đáp án đúng (Mặc định: 4.0 điểm)
  allowAiTutorExplanation: boolean; // Mở Gia sư AI giải thích sau khi thi
}

export interface ExamSession {
  id: string;
  title: string;
  quizId: string;
  classId?: string;
  className?: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'upcoming' | 'completed';
  shareUrl: string;
  qrCodeUrl?: string;
  allowedAttempts: number; // 1, 2, 3, or 0 = unlimited
  durationMinutes: number;
  totalSubmissions: number;
  maxSlots: number; // 500+ slots
  isArenaMode?: boolean;
  questionCount?: number;
  questions?: Question[]; // Exact 100% teacher-authored question collection
  antiCheatConfig?: AntiCheatConfig;
  scoringConfig?: ExamScoringConfig;
  // --- Kho đề trực tuyến (Google Apps Script) ---
  // Mã đề ngắn trên Kho (8 ký tự) và URL Web App của Kho. Khi có hai trường
  // này, link thi rút gọn chỉ mang mã đề (?exam=<storeExamId>#s=<kho>) và
  // kết quả học sinh nộp bài được gửi về Sheet của giáo viên.
  storeExamId?: string;
  storeUrl?: string;
}

export interface CheatLog {
  timestamp: string;
  event: string;
  type: 'tab_switch' | 'fullscreen_exit' | 'copy_attempt' | 'window_blur';
}

export interface StudentSubmission {
  id: string;
  sessionId: string;
  studentName: string;
  studentInfo: string; // e.g. "12A5 - SBD: 01"
  score: number;
  totalPoints: number;
  correctAnswersCount: number;
  wrongAnswersCount?: number;
  unansweredCount?: number;
  totalQuestions: number;
  submittedAt: string;
  durationSeconds: number;
  streakMax: number;
  answers: Record<string, any>;
  autoGraded: boolean;
  tabSwitchCount?: number;
  cheatLogs?: CheatLog[];
  attemptNumber?: number;
  isDisqualified?: boolean;
  disqualificationReason?: string;
}

export interface ConcurrentSystemMetrics {
  totalConnectedStudents: number; // up to 500
  throughputReqPerSec: number;
  networkLatencyMs: number;
  packetLossRate: number;
  cpuLoadPercentage: number;
  memoryBufferMb: number;
  systemStatus: 'optimal' | 'stable' | 'heavy' | 'overload';
  is500SimulationActive: boolean;
  currentActiveQuestionId: string;
  liveAnswerDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    totalAnswers: number;
  };
}

export type ActiveTab =
  | 'dashboard'
  | 'quizzes'
  | 'exam-mixer'
  | 'online-sessions'
  | 'attendance-summary'
  | 'classes'
  | 'live-monitor'
  | 'account';
