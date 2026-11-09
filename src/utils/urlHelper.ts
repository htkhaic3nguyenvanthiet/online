/**
 * URL and Routing utilities for student exam links
 */
import { ExamSession, Quiz, Question } from '../types/quiz';

export function getStudentExamShareUrl(examOrSessionId: string): string {
  if (typeof window === 'undefined') {
    return `https://htkhaic3nguyenvanthiet.github.io/online/?exam=${examOrSessionId}`;
  }

  // Use current origin and pathname (works for localhost, dev server, and GitHub Pages)
  const base = `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '');
  return `${base}?exam=${encodeURIComponent(examOrSessionId)}`;
}

export function getExamIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Search Query Parameters: ?exam=xxx or ?quiz=xxx or ?sessionId=xxx or ?id=xxx
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('exam') || params.get('quiz') || params.get('sessionId') || params.get('id');
  if (fromQuery && fromQuery.trim()) return decodeURIComponent(fromQuery.trim());

  // 2. Hash Routing: #exam/xxx, #/exam/xxx, #take/xxx, #/take/xxx, #quiz/xxx
  const hash = window.location.hash;
  if (hash) {
    const hashMatch = hash.match(/#\/?(?:exam|take|quiz|test)\/([^/?&]+)/i);
    if (hashMatch && hashMatch[1]) {
      return decodeURIComponent(hashMatch[1].trim());
    }

    if (hash.includes('exam=')) {
      const parts = hash.split('exam=');
      if (parts[1]) {
        const val = parts[1].split('&')[0];
        if (val) return decodeURIComponent(val.trim());
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// EXAM-IN-LINK: link thi tự chứa toàn bộ đề thi trong fragment (#d=...).
// Trang chạy tĩnh (GitHub Pages) không có máy chủ dùng chung, nên cách duy
// nhất để học sinh mở đúng đề trên máy của mình là mang đề theo trong link:
// payload JSON được nén gzip (CompressionStream gốc của trình duyệt, không
// dùng thư viện ngoài) rồi mã hóa base64url. App.tsx đọc payload này TRƯỚC
// khi gọi server/localStorage. Token có tiền tố "g." (đã nén gzip) hoặc
// "j." (JSON thuần, khi trình duyệt không có CompressionStream).
// ---------------------------------------------------------------------------

export interface EmbeddedExamPayload {
  v: 1;
  session: {
    id: string;
    title: string;
    quizId: string;
    className?: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    allowedAttempts: number;
    isArenaMode?: boolean;
    antiCheatConfig?: ExamSession['antiCheatConfig'];
    scoringConfig?: ExamSession['scoringConfig'];
    // Khi phiên thi đã đăng lên Kho đề: mang theo mã Kho để học sinh mở link
    // nhúng (#d=) vẫn nộp kết quả về đúng đề trên Sheet của giáo viên.
    storeExamId?: string;
    storeUrl?: string;
  };
  quizTitle: string;
  questions: Question[];
}

export function buildEmbeddedExamPayload(
  session: ExamSession,
  quiz: Quiz | undefined,
  questions: Question[]
): EmbeddedExamPayload {
  return {
    v: 1,
    session: {
      id: session.id,
      title: session.title,
      quizId: session.quizId,
      className: session.className,
      startTime: session.startTime,
      endTime: session.endTime,
      durationMinutes: session.durationMinutes,
      allowedAttempts: session.allowedAttempts,
      isArenaMode: session.isArenaMode,
      antiCheatConfig: session.antiCheatConfig,
      scoringConfig: session.scoringConfig,
      storeExamId: session.storeExamId,
      storeUrl: session.storeUrl
    },
    quizTitle: quiz?.title || session.title,
    questions
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function gzipCompress(data: Uint8Array): Promise<Uint8Array | null> {
  const CS = (globalThis as any).CompressionStream;
  if (typeof CS === 'undefined' || typeof Blob === 'undefined') return null;
  try {
    const stream = new Blob([data as any]).stream().pipeThrough(new CS('gzip'));
    const buf = await new Response(stream as any).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as any).DecompressionStream;
  if (typeof DS === 'undefined') throw new Error('DecompressionStream unavailable');
  const stream = new Blob([data as any]).stream().pipeThrough(new DS('gzip'));
  const buf = await new Response(stream as any).arrayBuffer();
  return new Uint8Array(buf);
}

export async function encodeExamPayloadToken(payload: EmbeddedExamPayload): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  const gz = await gzipCompress(raw);
  if (gz && gz.length < raw.length) {
    return 'g.' + bytesToBase64Url(gz);
  }
  return 'j.' + bytesToBase64Url(raw);
}

export async function decodeExamPayloadToken(token: string): Promise<EmbeddedExamPayload | null> {
  try {
    if (!token || (!token.startsWith('g.') && !token.startsWith('j.'))) return null;
    let bytes = base64UrlToBytes(token.slice(2));
    if (token.startsWith('g.')) {
      bytes = await gzipDecompress(bytes);
    }
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || !parsed.session || !parsed.session.id || !Array.isArray(parsed.questions)) {
      return null;
    }
    return parsed as EmbeddedExamPayload;
  } catch {
    return null;
  }
}

/**
 * Link thi mặc định gửi cho học sinh: giữ ?exam=<sessionId> để tham chiếu,
 * đồng thời nhúng toàn bộ đề vào #d=... để học sinh mở đúng đề trên mọi máy.
 */
export async function getStudentExamEmbeddedShareUrl(
  session: ExamSession,
  quiz: Quiz | undefined,
  questions: Question[]
): Promise<string> {
  const base = getStudentExamShareUrl(session.id);
  try {
    const token = await encodeExamPayloadToken(buildEmbeddedExamPayload(session, quiz, questions));
    const url = `${base}#d=${token}`;
    if (url.length > 30000) {
      console.warn(
        `[ExamLink] Link thi chứa sẵn đề dài ${url.length} ký tự — một số ứng dụng nhắn tin có thể cắt ngắn link, hãy gửi link qua kênh không giới hạn độ dài.`
      );
    }
    return url;
  } catch (e) {
    console.warn('[ExamLink] Không tạo được link chứa sẵn đề, dùng link thường:', e);
    return base;
  }
}

export async function getEmbeddedExamPayloadFromLocation(): Promise<EmbeddedExamPayload | null> {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  const m = hash.match(/[#&]d=([A-Za-z0-9._-]+)/);
  if (!m) return null;
  return decodeExamPayloadToken(m[1]);
}

export function buildSessionFromEmbeddedPayload(payload: EmbeddedExamPayload): ExamSession {
  const s = payload.session;
  return {
    id: s.id,
    title: s.title,
    quizId: s.quizId,
    className: s.className,
    startTime: s.startTime,
    endTime: s.endTime,
    status: 'active',
    shareUrl: getStudentExamShareUrl(s.id),
    allowedAttempts: s.allowedAttempts ?? 1,
    durationMinutes: s.durationMinutes ?? 45,
    totalSubmissions: 0,
    maxSlots: 500,
    isArenaMode: s.isArenaMode,
    questionCount: payload.questions.length,
    questions: payload.questions,
    antiCheatConfig: s.antiCheatConfig,
    scoringConfig: s.scoringConfig,
    // Đích nộp bài về Kho: ưu tiên #s= trong link hiện tại, sau đó mới tới
    // địa chỉ Kho đã gói sẵn trong payload khi giáo viên tạo link.
    storeExamId: s.storeExamId,
    storeUrl: getStoreUrlFromLocation() || s.storeUrl
  };
}

// ---------------------------------------------------------------------------
// KHO ĐỀ TRỰC TUYẾN (Google): link thi rút gọn chỉ mang MÃ ĐỀ ngắn.
//   <trang>?exam=<storeExamId>#s=<base64url(địa chỉ Web App của Kho)>
// Fragment #s= cho trình duyệt của học sinh (máy mới tinh, chưa từng cấu hình)
// biết phải tải đề và nộp kết quả về Kho nào. Fragment #d= (đề nhúng sẵn) và
// #s= có thể cùng tồn tại: #d= thắng về nội dung, #s= vẫn là đích nộp bài.
// ---------------------------------------------------------------------------

export function encodeStoreUrlToken(storeUrl: string): string {
  const bytes = new TextEncoder().encode((storeUrl || '').trim());
  return bytesToBase64Url(bytes);
}

export function decodeStoreUrlToken(token: string): string | null {
  try {
    if (!token) return null;
    const url = new TextDecoder().decode(base64UrlToBytes(token)).trim();
    if (!/^https?:\/\//i.test(url)) return null;
    return url;
  } catch {
    return null;
  }
}

/** Đọc địa chỉ Kho mang theo trong link (#s=...); null nếu link không có. */
export function getStoreUrlFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  const m = hash.match(/[#&]s=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  return decodeStoreUrlToken(m[1]);
}

/** Link thi rút gọn khi đề đã đăng lên Kho: chỉ mang mã đề + địa chỉ Kho. */
export function getStudentExamStoreShareUrl(storeExamId: string, storeUrl: string): string {
  const base = getStudentExamShareUrl(storeExamId);
  if (!storeUrl) return base;
  return `${base}#s=${encodeStoreUrlToken(storeUrl)}`;
}
