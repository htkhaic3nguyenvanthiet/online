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
  | 'online-sessions'
  | 'attendance-summary'
  | 'classes'
  | 'live-monitor'
  | 'account';
