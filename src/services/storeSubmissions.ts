/**
 * storeSubmissions — cầu nối giữa "Kho đề trực tuyến" (Google Sheet) và
 * bảng điểm trong app.
 *
 * Vấn đề: học sinh nộp bài từ máy khác -> kết quả chỉ nằm trong Sheet của
 * giáo viên (qua listSubmissions của Kho). Các màn hình bảng điểm của app
 * (modal Thống kê trong OnlineSessionsView, trang ExamSummaryAttendanceView)
 * vốn chỉ đọc danh sách nộp bài cục bộ (realtimeEngine trên chính trình
 * duyệt này) nên không thấy các bài đó. File này cung cấp MỘT đường duy
 * nhất để tải + chuyển đổi + khử trùng kết quả từ Kho, dùng chung cho mọi
 * màn hình — tránh mỗi nơi một kiểu chuyển đổi lệch nhau.
 *
 * LUẬT KHỬ TRÙNG (một bài nộp trên Kho bị coi là TRÙNG với một bài nộp cục
 * bộ khi thỏa một trong hai):
 *   (a) detail.submissionId của bài trên Kho === id của bài cục bộ
 *       (phía học sinh luôn gửi kèm submissionId = id do realtimeEngine
 *       sinh ra — đây là dấu vết chính xác nhất, bắt được mọi bài nộp từ
 *       chính trình duyệt này); hoặc
 *   (b) họ tên đã chuẩn hóa (trim, thường hóa, gộp khoảng trắng) bằng nhau,
 *       lớp không mâu thuẫn (chỉ khi cả hai phía đều có chuỗi lớp và khác
 *       nhau mới loại), và thời điểm nộp lệch nhau <= 2 giây. Mốc thời gian:
 *       phía Kho ưu tiên detail.submittedAt (ISO do máy học sinh ghi lúc
 *       nộp), dự phòng timestamp của dòng Sheet; phía cục bộ lấy epoch
 *       nhúng trong id dạng "sub-<epochMs>-..." (định dạng của
 *       realtimeEngine), dự phòng Date.parse(submittedAt) nếu hợp lệ.
 * Trong cùng một mẻ kết quả từ Kho, các dòng trùng nhau (cùng submissionId,
 * hoặc cùng họ tên + thời điểm trong vòng 2 giây) cũng chỉ giữ dòng đầu.
 * Nguyên tắc an toàn: khi không đủ bằng chứng thì KHÔNG khử (thà thừa một
 * dòng trùng còn hơn giấu mất kết quả thật của học sinh).
 */
import { ExamSession, StudentSubmission } from '../types/quiz';
import {
  ExamStoreConfig,
  StoreSubmissionRow,
  getExamStoreConfig,
  listStoreSubmissions,
} from './examStoreService';

const DEDUPE_WINDOW_MS = 2000;

function normalizeName(name: string): string {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Chuỗi lớp suy từ studentInfo (vd "12A5 - SBD: 01" -> "12A5"); rỗng nếu không có. */
function classOfSubmission(sub: Pick<StudentSubmission, 'studentInfo'>): string {
  return (sub.studentInfo || '').split(' - ')[0].trim().toLowerCase();
}

function parseEpochMs(value: unknown): number | null {
  if (typeof value === 'number' && isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value) {
    const t = Date.parse(value);
    return isNaN(t) ? null : t;
  }
  return null;
}

/** Mốc nộp bài phía Kho: ưu tiên detail.submittedAt (máy học sinh ghi), dự phòng timestamp dòng Sheet. */
export function storeRowEpochMs(row: StoreSubmissionRow): number | null {
  const d = (row.detail || {}) as Record<string, unknown>;
  return parseEpochMs(d.submittedAt) ?? parseEpochMs(row.timestamp);
}

/** Mốc nộp bài phía cục bộ: epoch nhúng trong id "sub-<epochMs>-..." của realtimeEngine
 *  (bản ghi đã gộp từ Kho mang id "store-sub-<epochMs>-..." cũng được nhận diện). */
export function localSubmissionEpochMs(sub: Pick<StudentSubmission, 'id' | 'submittedAt'>): number | null {
  const m = /^(?:store-)?sub-(\d+)-/.exec(sub.id || '');
  if (m) {
    const t = Number(m[1]);
    if (isFinite(t) && t > 0) return t;
  }
  return parseEpochMs(sub.submittedAt);
}

function storeRowSubmissionId(row: StoreSubmissionRow): string {
  const d = (row.detail || {}) as Record<string, unknown>;
  return d.submissionId != null ? String(d.submissionId) : '';
}

/** Kiểm tra một dòng kết quả trên Kho có trùng với bất kỳ bài nộp cục bộ nào không (luật ở đầu file). */
export function isStoreRowDuplicateOfLocal(
  row: StoreSubmissionRow,
  localSubs: StudentSubmission[]
): boolean {
  if (!localSubs || localSubs.length === 0) return false;
  const sid = storeRowSubmissionId(row);
  if (sid && localSubs.some((s) => s.id === sid || s.id === `store-${sid}`)) return true; // luật (a)

  const rowName = normalizeName(row.studentName);
  const rowEpoch = storeRowEpochMs(row);
  if (!rowName || rowEpoch == null) return false;
  const d = (row.detail || {}) as Record<string, unknown>;
  const rowClass = (String(d.studentInfo || row.className || '').split(' - ')[0] || '')
    .trim()
    .toLowerCase();

  return localSubs.some((s) => {
    if (normalizeName(s.studentName) !== rowName) return false;
    const localClass = classOfSubmission(s);
    if (rowClass && localClass && rowClass !== localClass) return false;
    const localEpoch = localSubmissionEpochMs(s);
    if (localEpoch == null) return false;
    return Math.abs(rowEpoch - localEpoch) <= DEDUPE_WINDOW_MS; // luật (b)
  });
}

/**
 * Chuyển một dòng kết quả của Kho thành StudentSubmission của app.
 * Đây là bản chuyển đổi DUY NHẤT (trước đây nằm riêng trong
 * ExamSummaryAttendanceView): giữ nguyên cách điền từng trường, bổ sung
 * các trường detail mới (streakMax, tabSwitchCount, cheatLogs,
 * disqualificationReason) khi phía học sinh có gửi.
 * id của bản ghi: "store-<submissionId>" nếu có submissionId (ổn định qua
 * các lần tải lại và dùng để khử trùng ở tầng bản ghi), ngược lại
 * "store-<mã đề>-<thứ tự dòng>".
 */
export function convertStoreRowToSubmission(
  row: StoreSubmissionRow,
  session: ExamSession,
  index: number
): StudentSubmission {
  const d = (row.detail || {}) as Record<string, any>;
  const sid = storeRowSubmissionId(row);
  const parsedTime = new Date(row.timestamp);
  const displayTime = isNaN(parsedTime.getTime()) ? row.timestamp : parsedTime.toLocaleString('vi-VN');
  return {
    id: sid ? `store-${sid}` : `store-${session.storeExamId || 'exam'}-${index}`,
    sessionId: session.id,
    studentName: row.studentName,
    studentInfo: String(d.studentInfo || row.className || ''),
    score: row.score,
    totalPoints: row.totalPoints,
    correctAnswersCount: Number(d.correctAnswersCount ?? 0),
    wrongAnswersCount: d.wrongAnswersCount != null ? Number(d.wrongAnswersCount) : undefined,
    unansweredCount: d.unansweredCount != null ? Number(d.unansweredCount) : undefined,
    totalQuestions: Number(d.totalQuestions ?? session.questionCount ?? 0),
    submittedAt: displayTime,
    durationSeconds: Number(d.durationSeconds ?? 0),
    streakMax: Number(d.streakMax ?? 0),
    answers: (d.answers as Record<string, any>) || {},
    autoGraded: true,
    tabSwitchCount: d.tabSwitchCount != null ? Number(d.tabSwitchCount) : undefined,
    cheatLogs: Array.isArray(d.cheatLogs) ? d.cheatLogs : undefined,
    attemptNumber: d.attemptNumber != null ? Number(d.attemptNumber) : undefined,
    isDisqualified: !!d.isDisqualified,
    disqualificationReason: d.disqualificationReason ? String(d.disqualificationReason) : undefined,
  };
}

/**
 * Chuyển cả mẻ dòng từ Kho: khử trùng NỘI BỘ mẻ (cùng submissionId, hoặc
 * cùng họ tên + thời điểm <= 2 giây) và loại các dòng trùng với bài nộp
 * cục bộ được truyền vào.
 */
export function convertStoreSubmissions(
  rows: StoreSubmissionRow[],
  session: ExamSession,
  localSubs: StudentSubmission[] = []
): StudentSubmission[] {
  const seenIds = new Set<string>();
  const seenNameEpoch: { name: string; epoch: number }[] = [];
  const out: StudentSubmission[] = [];
  rows.forEach((row, idx) => {
    const sid = storeRowSubmissionId(row);
    if (sid) {
      if (seenIds.has(sid)) return;
      seenIds.add(sid);
    }
    const epoch = storeRowEpochMs(row);
    const name = normalizeName(row.studentName);
    if (epoch != null && name) {
      if (seenNameEpoch.some((e) => e.name === name && Math.abs(e.epoch - epoch) <= DEDUPE_WINDOW_MS)) {
        return;
      }
      seenNameEpoch.push({ name, epoch });
    }
    if (isStoreRowDuplicateOfLocal(row, localSubs)) return;
    out.push(convertStoreRowToSubmission(row, session, idx));
  });
  return out;
}

/**
 * Khử trùng ở tầng bản ghi đã chuyển đổi (dùng khi danh sách cục bộ thay
 * đổi SAU lúc tải từ Kho, vd bài mới nộp ngay trên trình duyệt này trong
 * lúc modal đang mở): một bản ghi Kho bị loại khi submissionId nhúng
 * trong id của nó ("store-<submissionId>") khớp id một bài cục bộ, hoặc
 * khi họ tên + chuỗi thời gian hiển thị trùng khít với một bài cục bộ.
 */
export function filterDuplicateStoreSubmissions(
  localSubs: StudentSubmission[],
  storeSubs: StudentSubmission[]
): StudentSubmission[] {
  if (!localSubs || localSubs.length === 0) return storeSubs;
  const localIds = new Set(localSubs.map((s) => s.id));
  const localNameTimes = new Set(
    localSubs.map((s) => `${normalizeName(s.studentName)}|${s.submittedAt}`)
  );
  return storeSubs.filter((st) => {
    if (localIds.has(st.id)) return false;
    if (st.id.startsWith('store-')) {
      const embedded = st.id.slice('store-'.length);
      if (embedded && localIds.has(embedded)) return false;
    }
    if (localNameTimes.has(`${normalizeName(st.studentName)}|${st.submittedAt}`)) return false;
    return true;
  });
}

export interface FetchMergedStoreResult {
  submissions: StudentSubmission[];
  error?: string;
}

/**
 * Tải kết quả của phiên thi từ Kho và trả về danh sách StudentSubmission
 * ĐÃ khử trùng với bài nộp cục bộ (chỉ gồm các bài cần hiển thị thêm).
 *
 * - Phiên không gắn Kho (không có storeExamId): { submissions: [] }, không lỗi.
 * - URL Kho: ưu tiên cấu hình đã lưu (getExamStoreConfig), dự phòng
 *   session.storeUrl (link thi luôn mang theo địa chỉ Kho). Mã bảo mật chỉ
 *   lấy từ cấu hình đã lưu trên máy giáo viên — không bao giờ đi theo link.
 * - Chưa cấu hình / tải thất bại: trả error dạng chuỗi để UI phân biệt
 *   "kho trống" (không lỗi, 0 kết quả) với "không tải được".
 * cfgOverride chỉ phục vụ kiểm thử (Node + stub server).
 */
export async function fetchMergedStoreSubmissions(
  session: ExamSession,
  localSubmissions: StudentSubmission[] = [],
  cfgOverride?: ExamStoreConfig
): Promise<FetchMergedStoreResult> {
  if (!session?.storeExamId) return { submissions: [] };
  const stored = cfgOverride || getExamStoreConfig();
  const cfg: ExamStoreConfig = {
    storeUrl: (stored.storeUrl || session.storeUrl || '').trim(),
    teacherToken: (stored.teacherToken || '').trim(),
  };
  if (!cfg.storeUrl || !cfg.teacherToken) {
    return {
      submissions: [],
      error:
        'Chưa tải được kết quả từ Kho: hãy nhập URL Web App và Mã bảo mật trong mục Cài đặt → "Kho đề trực tuyến (Google)" trước.',
    };
  }
  const rows = await listStoreSubmissions(cfg, session.storeExamId);
  if (!rows) {
    return {
      submissions: [],
      error:
        'Không tải được kết quả từ Kho. Kiểm tra lại kết nối mạng, URL Web App và Mã bảo mật trong mục Cài đặt.',
    };
  }
  return { submissions: convertStoreSubmissions(rows, session, localSubmissions) };
}
