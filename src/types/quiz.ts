export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface Question {
  id: string;
  order: number;
  content: string;
  options: {
    key: OptionKey;
    text: string;
    isCorrect?: boolean;
  }[];
  correctAnswer: OptionKey;
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

export interface Classroom {
  id: string;
  name: string;
  studentCount: number;
  academicYear: string;
  createdAt: string;
  code: string;
  teacherName: string;
  students: {
    id: string;
    fullName: string;
    studentCode: string;
    avatarUrl?: string;
    lastScore?: number;
    completedExams: number;
  }[];
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
  allowedAttempts: number;
  durationMinutes: number;
  totalSubmissions: number;
  maxSlots: number; // 500+ slots
  isArenaMode?: boolean;
}

export interface StudentSubmission {
  id: string;
  sessionId: string;
  studentName: string;
  studentInfo: string; // e.g. "12A5 - SBD: 01"
  score: number;
  totalPoints: number;
  correctAnswersCount: number;
  totalQuestions: number;
  submittedAt: string;
  durationSeconds: number;
  streakMax: number;
  answers: Record<string, OptionKey>;
  autoGraded: boolean;
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
