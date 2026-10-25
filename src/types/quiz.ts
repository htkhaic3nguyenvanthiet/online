export type OptionKey = 'A' | 'B' | 'C' | 'D';

export type PartType = 'part1_choice' | 'part2_true_false' | 'part3_short_answer';

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
  antiCheatConfig?: AntiCheatConfig;
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
  | 'classes'
  | 'quizzes'
  | 'online-sessions'
  | 'paper-exam'
  | 'kids-quiz'
  | 'game-arena'
  | 'shared-store'
  | 'offline-exam'
  | 'live-monitor'
  | 'account';
