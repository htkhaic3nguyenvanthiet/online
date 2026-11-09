/**
 * examStoreService — "Kho đề trực tuyến" trên Google Apps Script của chính giáo viên.
 *
 * Bối cảnh: trang chạy tĩnh (GitHub Pages) không có máy chủ dùng chung. Trước đây
 * đề thi phải nhúng trọn vào link (#d=...) khiến link/QR dài hàng chục nghìn ký tự
 * với đề có hình. Kho đề này giải quyết tận gốc:
 *   - Nội dung đề lưu trong Google Drive của giáo viên (qua Apps Script Web App).
 *   - Link thi rút gọn chỉ còn mã đề ngắn: ?exam=<examId>#s=<địa chỉ Kho>.
 *   - Học sinh nộp bài -> kết quả chảy về Google Sheet của giáo viên.
 *
 * Giao thức (xem apps-script/Code.gs):
 *   GET  ?action=ping                          -> { ok:true, service:"TestOnlineKho" }
 *   GET  ?action=getExam&id=<examId>           -> { found:true, session, quiz, questions }
 *   POST {action:"saveExam", token, exam}      -> { ok:true, examId }   (cần Mã bảo mật)
 *   POST {action:"submit", examId, submission} -> { ok:true }           (học sinh, không cần mã)
 *   POST {action:"listSubmissions", token, examId} -> { ok:true, submissions:[...] }
 *
 * LƯU Ý KỸ THUẬT về Apps Script Web App:
 *   - Mọi request tới /exec đều bị Google trả 302 redirect sang
 *     script.googleusercontent.com. fetch mặc định tự đi theo redirect (follow)
 *     nên GET hoạt động bình thường; với POST, trình duyệt đổi method thành GET
 *     khi đi theo 302 — Apps Script đã XỬ LÝ xong POST trước khi redirect và
 *     trang đích của redirect chính là nội dung phản hồi JSON, nên kết quả vẫn
 *     đọc được đúng. Đây là hành vi chuẩn, đã được cộng đồng dùng rộng rãi.
 *   - POST dùng Content-Type "text/plain" (KHÔNG dùng application/json) để
 *     trình duyệt KHÔNG gửi preflight CORS (Apps Script không trả lời OPTIONS).
 *     Body vẫn là chuỗi JSON và Code.gs tự JSON.parse — an toàn.
 *   - Mọi hàm đều "fail soft": lỗi mạng / Kho chưa cấu hình -> trả null/false,
 *     app tự lùi về link nhúng đề như trước, tuyệt đối không chặn người dùng.
 *
 * THIẾT KẾ CHO KIỂM THỬ: các hàm mạng đều nhận config tường minh
 * ({ storeUrl, teacherToken }) để test bằng Node với stub server; lớp tiện ích
 * phía dưới mới đọc localStorage (chỉ chạy trên trình duyệt).
 */
import { ExamSession, Quiz, Question } from '../types/quiz';

export interface ExamStoreConfig {
  storeUrl: string;
  teacherToken: string;
}

export interface StoreExamPayload {
  examId?: string;
  session?: ExamSession | null;
  quiz?: Quiz | null;
  questions: Question[];
}

export interface StoreSubmissionInput {
  studentName: string;
  className: string;
  score: number;
  totalPoints: number;
  detail?: Record<string, unknown>;
}

export interface StoreSubmissionRow {
  timestamp: string;
  examId: string;
  studentName: string;
  className: string;
  score: number;
  totalPoints: number;
  detail: Record<string, unknown> | null;
}

const STORE_URL_KEY = 'testonline_store_url';
const STORE_TOKEN_KEY = 'testonline_store_token';

export function normalizeStoreUrl(url: string): string {
  return (url || '').trim();
}

function storageGet(key: string): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key) || '';
    }
  } catch {
    // ignore
  }
  return '';
}

function storageSet(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

/** Đọc cấu hình Kho đã lưu trên trình duyệt của giáo viên (rỗng nếu chưa cài). */
export function getExamStoreConfig(): ExamStoreConfig {
  return {
    storeUrl: normalizeStoreUrl(storageGet(STORE_URL_KEY)),
    teacherToken: storageGet(STORE_TOKEN_KEY).trim(),
  };
}

export function saveExamStoreConfig(cfg: ExamStoreConfig): void {
  storageSet(STORE_URL_KEY, normalizeStoreUrl(cfg.storeUrl));
  storageSet(STORE_TOKEN_KEY, (cfg.teacherToken || '').trim());
}

export function isExamStoreConfigured(cfg?: ExamStoreConfig): boolean {
  const c = cfg || getExamStoreConfig();
  return !!normalizeStoreUrl(c.storeUrl);
}

export function isExamStoreTeacherReady(cfg?: ExamStoreConfig): boolean {
  const c = cfg || getExamStoreConfig();
  return !!normalizeStoreUrl(c.storeUrl) && !!(c.teacherToken || '').trim();
}

// ---------------------------------------------------------------------------
// Lõi mạng — nhận config tường minh, dùng được cả trên Node (để kiểm thử).
// ---------------------------------------------------------------------------

async function storeGetJson(storeUrl: string, params: Record<string, string>): Promise<any | null> {
  const base = normalizeStoreUrl(storeUrl);
  if (!base) return null;
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${base}${base.includes('?') ? '&' : '?'}${qs}`, {
      method: 'GET',
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function storePostJson(storeUrl: string, body: Record<string, unknown>): Promise<any | null> {
  const base = normalizeStoreUrl(storeUrl);
  if (!base) return null;
  try {
    const res = await fetch(base, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Kiểm tra kết nối tới Kho: true khi Kho trả ping đúng định dạng. */
export async function pingExamStore(cfg: ExamStoreConfig): Promise<boolean> {
  const json = await storeGetJson(cfg.storeUrl, { action: 'ping' });
  return !!(json && json.ok === true && json.service === 'TestOnlineKho');
}

/**
 * Đăng một đề thi lên Kho (cần Mã bảo mật của giáo viên).
 * payload.examId có sẵn thì đăng lại đúng mã đó; chưa có thì Kho tự sinh mã ngắn.
 * Trả { examId } khi thành công, null khi thất bại.
 */
export async function publishExamToStore(
  cfg: ExamStoreConfig,
  payload: StoreExamPayload
): Promise<{ examId: string } | null> {
  if (!isExamStoreTeacherReady(cfg)) return null;
  if (!payload.questions || payload.questions.length === 0) return null;
  const json = await storePostJson(cfg.storeUrl, {
    action: 'saveExam',
    token: cfg.teacherToken,
    exam: {
      examId: payload.examId,
      session: payload.session ?? null,
      quiz: payload.quiz ?? null,
      questions: payload.questions,
    },
  });
  if (json && json.ok === true && typeof json.examId === 'string' && json.examId) {
    return { examId: json.examId };
  }
  return null;
}

/** Tải một đề từ Kho theo mã đề (học sinh dùng — không cần Mã bảo mật). */
export async function fetchExamFromStore(
  storeUrl: string,
  examId: string
): Promise<StoreExamPayload | null> {
  if (!normalizeStoreUrl(storeUrl) || !examId) return null;
  const json = await storeGetJson(storeUrl, { action: 'getExam', id: examId });
  if (json && json.found === true && Array.isArray(json.questions) && json.questions.length > 0) {
    return {
      examId: typeof json.examId === 'string' ? json.examId : examId,
      session: json.session ?? null,
      quiz: json.quiz ?? null,
      questions: json.questions as Question[],
    };
  }
  return null;
}

/**
 * Học sinh nộp kết quả về Kho (không cần Mã bảo mật).
 * Fire-and-forget: lỗi mạng không bao giờ làm phiền học sinh.
 */
export async function submitResultToStore(
  storeUrl: string,
  examId: string,
  submission: StoreSubmissionInput
): Promise<boolean> {
  if (!normalizeStoreUrl(storeUrl) || !examId) return false;
  const json = await storePostJson(storeUrl, {
    action: 'submit',
    examId,
    submission,
  });
  return !!(json && json.ok === true);
}

/** Giáo viên tải danh sách kết quả của một đề từ Kho (cần Mã bảo mật). */
export async function listStoreSubmissions(
  cfg: ExamStoreConfig,
  examId: string
): Promise<StoreSubmissionRow[] | null> {
  if (!isExamStoreTeacherReady(cfg) || !examId) return null;
  const json = await storePostJson(cfg.storeUrl, {
    action: 'listSubmissions',
    token: cfg.teacherToken,
    examId,
  });
  if (json && json.ok === true && Array.isArray(json.submissions)) {
    return json.submissions as StoreSubmissionRow[];
  }
  return null;
}
