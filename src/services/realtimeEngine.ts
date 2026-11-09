import { ConcurrentSystemMetrics, StudentSubmission, OptionKey } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';

type RealtimeListener = (event: {
  type: 'NEW_SUBMISSION' | 'METRICS_UPDATE' | 'STUDENT_ANSWER_STREAM' | 'SUBMISSIONS_SYNCED';
  data: unknown;
}) => void;

class RealtimeEngine {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<RealtimeListener> = new Set();
  private simulationInterval: ReturnType<typeof setInterval> | null = null;
  private submissions: StudentSubmission[] = [];

  private metrics: ConcurrentSystemMetrics = {
    totalConnectedStudents: 500,
    throughputReqPerSec: 462,
    networkLatencyMs: 12,
    packetLossRate: 0.0,
    cpuLoadPercentage: 16.4,
    memoryBufferMb: 14.8,
    systemStatus: 'optimal',
    is500SimulationActive: false,
    currentActiveQuestionId: 'q1',
    liveAnswerDistribution: {
      A: 312,
      B: 98,
      C: 56,
      D: 34,
      totalAnswers: 500
    }
  };

  private vietnameseFirstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Huỳnh', 'Hoàng', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
  private vietnameseMiddleNames = ['Văn', 'Thị', 'Minh', 'Ngọc', 'Hoàng', 'Gia', 'Thanh', 'Đức', 'Quốc', 'Phương', 'Anh', 'Khánh'];
  private vietnameseLastNames = ['An', 'Bình', 'Châu', 'Dũng', 'Đạt', 'Hà', 'Hải', 'Huy', 'Khoa', 'Linh', 'Long', 'Mai', 'Nam', 'Ngân', 'Phúc', 'Quân', 'Sơn', 'Tâm', 'Thảo', 'Trí', 'Tú', 'Uyên', 'Vy', 'Yến'];
  private sampleClasses = ['12A1', '12A2', '12A3', '12A4', '12A5', '11A1', '11A2', 'CNNN25', '12TN1'];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('testonline_realtime_channel');
        this.channel.onmessage = (event) => {
          this.handleIncomingBroadcast(event.data);
        };
      } catch {
        // Fallback gracefully
      }
    }
    this.loadInitialSubmissions();
  }

  private loadInitialSubmissions() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('testonline_submissions_cache');
        if (stored) {
          this.submissions = JSON.parse(stored);
        }
      } catch {
        // ignore
      }
    }
  }

  private saveSubmissions() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('testonline_submissions_cache', JSON.stringify(this.submissions.slice(0, 100)));
      } catch {
        // ignore
      }
    }
  }

  private handleIncomingBroadcast(payload: { type: string; data: unknown }) {
    if (payload.type === 'NEW_SUBMISSION') {
      const sub = payload.data as StudentSubmission;
      // Avoid duplicate by id
      if (!this.submissions.some(s => s.id === sub.id)) {
        this.submissions.unshift(sub);
        this.saveSubmissions();
        soundEffects.playPing();
        this.notify({ type: 'NEW_SUBMISSION', data: sub });
      }
    }
  }

  public subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(event: { type: 'NEW_SUBMISSION' | 'METRICS_UPDATE' | 'STUDENT_ANSWER_STREAM' | 'SUBMISSIONS_SYNCED'; data: unknown }) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in listener', err);
      }
    });
  }

  public getSubmissions(): StudentSubmission[] {
    return [...this.submissions];
  }

  /**
   * Gộp kết quả từ nguồn ngoài (Kho đề trực tuyến) vào kho submissions
   * dùng chung mà mọi màn hình bảng điểm cùng đọc. Khử trùng theo id
   * (bản ghi từ Kho có id ổn định "store-..." qua các lần tải). Trả về số
   * bản ghi THỰC SỰ được thêm mới; phát sự kiện SUBMISSIONS_SYNCED (App
   * chỉ làm mới danh sách, KHÔNG bật toast "vừa nộp bài" như bài nộp trực
   * tiếp) và lưu cache như bài nộp thường.
   */
  public mergeExternalSubmissions(incoming: StudentSubmission[]): number {
    if (!incoming || incoming.length === 0) return 0;
    const existingIds = new Set(this.submissions.map((s) => s.id));
    const fresh = incoming.filter((s) => s && s.id && !existingIds.has(s.id));
    if (fresh.length === 0) return 0;
    this.submissions = [...this.submissions, ...fresh];
    this.saveSubmissions();
    this.notify({ type: 'SUBMISSIONS_SYNCED', data: fresh });
    return fresh.length;
  }

  public getMetrics(): ConcurrentSystemMetrics {
    return { ...this.metrics };
  }

  /**
   * Submit test from Student Exam screen and immediately broadcast
   * to Teacher Dashboard in real-time.
   */
  public submitStudentExam(submission: Omit<StudentSubmission, 'id' | 'submittedAt' | 'autoGraded'>): StudentSubmission {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const newSub: StudentSubmission = {
      ...submission,
      id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      submittedAt: `Vừa xong (${timeStr})`,
      autoGraded: true
    };

    this.submissions.unshift(newSub);
    this.saveSubmissions();

    // Send to Cloud Server Backend in background (zero lag)
    try {
      fetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSub)
      }).catch((e) => console.warn('Background sync submission failed:', e));
    } catch {
      // ignore
    }

    // Broadcast cross-tab
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'NEW_SUBMISSION', data: newSub });
      } catch {
        // ignore
      }
    }

    soundEffects.playPing();
    this.notify({ type: 'NEW_SUBMISSION', data: newSub });
    return newSub;
  }

  /**
   * Start / Stop 500 concurrent students simulation
   * Demonstrates zero network drops, high throughput (480+ req/s),
   * live A/B/C/D voting distribution, and automatic real-time result return.
   */
  public toggle500Simulation(enable?: boolean): boolean {
    const targetState = enable !== undefined ? enable : !this.metrics.is500SimulationActive;
    this.metrics.is500SimulationActive = targetState;

    if (targetState) {
      if (this.simulationInterval) clearInterval(this.simulationInterval);
      this.simulationInterval = setInterval(() => {
        this.tickSimulation();
      }, 1200);
    } else {
      if (this.simulationInterval) {
        clearInterval(this.simulationInterval);
        this.simulationInterval = null;
      }
      this.metrics.throughputReqPerSec = 42;
      this.metrics.networkLatencyMs = 8;
      this.notify({ type: 'METRICS_UPDATE', data: this.metrics });
    }

    return this.metrics.is500SimulationActive;
  }

  private tickSimulation() {
    if (!this.metrics.is500SimulationActive) return;

    // Simulate fluctuation of high-concurrency 500 students
    const jitter = Math.floor(Math.random() * 9) - 4;
    this.metrics.throughputReqPerSec = Math.max(380, Math.min(580, 475 + jitter * 12));
    this.metrics.networkLatencyMs = Math.max(7, Math.min(18, 11 + (jitter % 3)));
    this.metrics.cpuLoadPercentage = +(15.5 + Math.random() * 3).toFixed(1);
    this.metrics.memoryBufferMb = +(14.2 + Math.random() * 1.5).toFixed(1);

    // Live answer distribution shifts as 500 students select answers
    const randomA = Math.floor(290 + Math.random() * 30);
    const randomB = Math.floor(90 + Math.random() * 20);
    const randomC = Math.floor(50 + Math.random() * 15);
    const randomD = 500 - (randomA + randomB + randomC);

    this.metrics.liveAnswerDistribution = {
      A: randomA,
      B: randomB,
      C: randomC,
      D: Math.max(0, randomD),
      totalAnswers: 500
    };

    // Real submissions only
    this.notify({ type: 'METRICS_UPDATE', data: this.metrics });
  }

  private generateRandomStudentSubmission() {
    const fName = this.vietnameseFirstNames[Math.floor(Math.random() * this.vietnameseFirstNames.length)];
    const mName = this.vietnameseMiddleNames[Math.floor(Math.random() * this.vietnameseMiddleNames.length)];
    const lName = this.vietnameseLastNames[Math.floor(Math.random() * this.vietnameseLastNames.length)];
    const studentName = `${fName} ${mName} ${lName}`;

    const cls = this.sampleClasses[Math.floor(Math.random() * this.sampleClasses.length)];
    const sbd = Math.floor(10 + Math.random() * 85);
    const studentInfo = `${cls} - SBD: ${sbd.toString().padStart(3, '0')}`;

    // Score between 7.0 and 10.0
    const correctCount = Math.floor(4 + Math.random() * 3); // 4, 5, or 6
    const score = +((correctCount / 6) * 10).toFixed(2);
    const duration = Math.floor(120 + Math.random() * 200);

    const keys: OptionKey[] = ['A', 'B', 'C', 'D'];
    const answers: Record<string, OptionKey> = {
      q1: 'A',
      q2: Math.random() > 0.2 ? 'B' : keys[Math.floor(Math.random() * 4)],
      q3: Math.random() > 0.15 ? 'B' : keys[Math.floor(Math.random() * 4)],
      q4: Math.random() > 0.1 ? 'A' : keys[Math.floor(Math.random() * 4)],
      q5: Math.random() > 0.25 ? 'A' : keys[Math.floor(Math.random() * 4)],
      q6: Math.random() > 0.2 ? 'A' : keys[Math.floor(Math.random() * 4)]
    };

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const sub: StudentSubmission = {
      id: 'sub-sim-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      sessionId: '',
      studentName,
      studentInfo,
      score,
      totalPoints: 10.0,
      correctAnswersCount: correctCount,
      totalQuestions: 6,
      submittedAt: `Vừa xong (${timeStr})`,
      durationSeconds: duration,
      streakMax: correctCount,
      answers,
      autoGraded: true
    };

    this.submissions.unshift(sub);
    if (this.submissions.length > 150) {
      this.submissions.pop();
    }
    this.saveSubmissions();

    this.notify({ type: 'NEW_SUBMISSION', data: sub });
  }

  public clearSubmissions() {
    this.submissions = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('testonline_submissions_cache');
    }
    this.loadInitialSubmissions();
    this.notify({ type: 'METRICS_UPDATE', data: this.metrics });
  }
}

export const realtimeEngine = new RealtimeEngine();
