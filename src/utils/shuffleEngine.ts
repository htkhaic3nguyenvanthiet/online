// ============================================================
// TRỘN ĐỀ (Phase C) — shuffle engine thuần, có seed tái lập.
// Port tinh túy #6 của EduMix (Fisher–Yates theo phần, đáp án bám
// theo NỘI DUNG) + bổ sung mà EduMix thiếu: seed tái lập được.
//
// Vì sao trộn ở đây an toàn cho Toán/Lý/Hóa: mỗi Question đã mang
// theo ảnh (images[]), bảng (table) và công thức LaTeX ngay trong
// object (Phase B). Trộn = di chuyển nguyên object, nên công thức
// và hình không bao giờ tách khỏi câu. Marker ⟦img:N⟧ trong text
// phương án trỏ vào images[] CỦA CHÍNH CÂU ĐÓ — khi trộn phương án,
// marker đi theo chuỗi text, TUYỆT ĐỐI không đánh số lại marker.
//
// Quy tắc bất biến của engine:
// - Không bao giờ trộn lẫn giữa các phần (I/II/III/IV riêng biệt).
// - Phần II: giữ nguyên thứ tự CÂU (dẫn liệu nặng), chỉ trộn thứ tự
//   các ý a/b/c/d BÊN TRONG từng câu; cờ isCorrect (Đúng) đi theo ý.
// - Phần IV (tự luận): không trộn gì cả — như EduMix.
// - Đáp án Phần I: options[].isCorrect và correctAnswer (chữ cái)
//   luôn được đồng bộ lại theo vị trí mới của phương án đúng.
// - correctAnswer của Phần II là chuỗi suy ra "a:Đ b:S ..." (đúng
//   định dạng parser sinh ra) — được dựng lại sau khi trộn ý.
// ============================================================

import { OptionKey, Question, Quiz } from '../types/quiz';

export interface ShuffleOptions {
  /** Trộn thứ tự câu Phần I (mặc định: true) */
  shufflePart1Questions?: boolean;
  /** Trộn 4 phương án trong mỗi câu Phần I (mặc định: true) */
  shuffleOptions?: boolean;
  /** Trộn các ý a–d trong mỗi câu Phần II (mặc định: true) */
  shufflePart2Items?: boolean;
  /** Trộn thứ tự câu Phần III (mặc định: false) */
  shufflePart3Questions?: boolean;
}

export interface ShuffledVariantResult {
  quiz: Quiz;
  /** Mã đề của biến thể (ví dụ 102) */
  code: number;
  /** Seed đã dùng — tái lập được đúng biến thể này */
  seed: number;
  /** Đáp án đúng Phần I theo thứ tự câu của biến thể */
  part1Key: OptionKey[];
  /** Mỗi phần tử: các chữ cái ý ĐÚNG của một câu Phần II, theo thứ tự câu */
  part2TrueLetters: string[][];
  /** Đáp án Phần III theo thứ tự câu của biến thể */
  part3Key: string[];
  /** Phân bố đáp án đúng Phần I của biến thể */
  distribution: Record<OptionKey, number>;
}

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];
const SUB_KEYS: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];

/** PRNG mulberry32 — nhỏ, nhanh, xác định hoàn toàn theo seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates trên BẢN SAO của mảng (không sửa mảng gốc). */
export function fisherYatesShuffle<T>(input: readonly T[], rand: () => number): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function hashStringToSeed(text: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

type EffectivePart = 'part1_choice' | 'part2_true_false' | 'part3_short_answer' | 'part4_essay' | 'other';

function effectivePart(q: Question): EffectivePart {
  if (q.partType) return q.partType;
  // Cùng quy ước với CreateQuizModal: không có partType mà có options => Phần I.
  if (q.options && q.options.length > 0) return 'part1_choice';
  return 'other';
}

/**
 * Suy mã đề gốc từ tiêu đề/tên file của đề (ví dụ "... MÃ 101" -> 101).
 * Lấy nhóm số 3–4 chữ số xuất hiện CUỐI CÙNG; không thấy thì dùng 101.
 */
export function extractBaseCode(quiz: Pick<Quiz, 'title' | 'fileName'>): number {
  const haystack = `${quiz.title || ''} ${quiz.fileName || ''}`;
  const groups = haystack.match(/\d{3,4}/g);
  if (groups && groups.length > 0) {
    const n = parseInt(groups[groups.length - 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 101;
}

/** Trộn phương án của một câu Phần I; đáp án bám theo nội dung phương án. */
function shuffleQuestionOptions(q: Question, rand: () => number): void {
  if (!q.options || q.options.length < 2) return;
  const original = q.options;
  // Xác định OBJECT phương án đúng TRƯỚC khi trộn: ưu tiên cờ isCorrect,
  // dự phòng theo correctAnswer (chữ cái) — đúng thứ tự StudentArenaView dùng.
  // Theo dõi theo object nên đáp án bám đúng nội dung sau khi hoán vị.
  let correctOpt = original.find((o) => o.isCorrect);
  if (!correctOpt && q.correctAnswer) {
    correctOpt = original.find((o) => o.key === q.correctAnswer);
  }

  const permuted = fisherYatesShuffle(original, rand);
  q.options = permuted.map((opt, i) => ({
    ...opt,
    key: OPTION_KEYS[i],
    // Nếu đề gốc xác định được đáp án: chuẩn hóa về đúng một phương án
    // đúng (object đã theo dõi). Không xác định được: giữ nguyên, không bịa.
    isCorrect: correctOpt ? opt === correctOpt : opt.isCorrect,
  }));
  if (correctOpt) {
    const newIdx = q.options.findIndex((o) => o.isCorrect);
    if (newIdx !== -1) q.correctAnswer = OPTION_KEYS[newIdx];
  }
}

/** Trộn các ý a–d trong một câu Phần II; cờ Đúng đi theo nội dung ý. */
function shuffleSubItems(q: Question, rand: () => number): void {
  if (!q.subItems || q.subItems.length < 2) return;
  const permuted = fisherYatesShuffle(q.subItems, rand);
  q.subItems = permuted.map((si, i) => ({ ...si, key: SUB_KEYS[i] }));
  // Dựng lại correctAnswer đúng định dạng parser: "a:Đ b:S c:Đ d:S"
  q.correctAnswer = q.subItems.map((si) => `${si.key}:${si.isCorrect ? 'Đ' : 'S'}`).join(' ');
}

export interface ShuffleVariantConfig extends ShuffleOptions {
  /** Mã đề của biến thể này */
  code: number;
  /** Mã đề bắt đầu của cả đợt trộn (để ghi vào shuffleMeta) */
  baseCode?: number;
}

/**
 * Sinh MỘT biến thể đã trộn từ đề gốc. Đề gốc không bị thay đổi
 * (engine làm việc trên bản deep-clone).
 */
export function shuffleQuestions(
  source: Quiz,
  options: ShuffleVariantConfig,
  seed: number
): ShuffledVariantResult {
  const rand = mulberry32(seed);
  const opts: Required<ShuffleOptions> = {
    shufflePart1Questions: options.shufflePart1Questions ?? true,
    shuffleOptions: options.shuffleOptions ?? true,
    shufflePart2Items: options.shufflePart2Items ?? true,
    shufflePart3Questions: options.shufflePart3Questions ?? false,
  };

  const quiz = deepClone(source);
  const questions = quiz.questions || [];

  // Phân nhóm theo phần, giữ nguyên "khuôn vị trí" (slot pattern) của
  // mảng gốc: câu thuộc phần nào chỉ hoán vị trong nội bộ phần đó.
  const pools: Record<EffectivePart, Question[]> = {
    part1_choice: [],
    part2_true_false: [],
    part3_short_answer: [],
    part4_essay: [],
    other: [],
  };
  const slotPattern: EffectivePart[] = questions.map((q) => {
    const part = effectivePart(q);
    pools[part].push(q);
    return part;
  });

  if (opts.shufflePart1Questions && pools.part1_choice.length > 1) {
    pools.part1_choice = fisherYatesShuffle(pools.part1_choice, rand);
  }
  if (opts.shufflePart3Questions && pools.part3_short_answer.length > 1) {
    pools.part3_short_answer = fisherYatesShuffle(pools.part3_short_answer, rand);
  }
  // Thứ tự câu Phần II và Phần IV: giữ nguyên (chủ đích, xem đầu file).

  if (opts.shuffleOptions) {
    for (const q of pools.part1_choice) shuffleQuestionOptions(q, rand);
  }
  if (opts.shufflePart2Items) {
    for (const q of pools.part2_true_false) shuffleSubItems(q, rand);
  }

  // Lắp lại theo khuôn vị trí + đánh số thứ tự mới.
  const cursors: Record<EffectivePart, number> = {
    part1_choice: 0,
    part2_true_false: 0,
    part3_short_answer: 0,
    part4_essay: 0,
    other: 0,
  };
  quiz.questions = slotPattern.map((part, idx) => {
    const q = pools[part][cursors[part]++];
    q.order = idx + 1;
    return q;
  });

  // Bản ghi đáp án của biến thể.
  const part1 = pools.part1_choice;
  const part2 = pools.part2_true_false;
  const part3 = pools.part3_short_answer;
  const distribution: Record<OptionKey, number> = { A: 0, B: 0, C: 0, D: 0 };
  const part1Key: OptionKey[] = part1.map((q) => {
    const letter = (q.correctAnswer as OptionKey) || 'A';
    if (letter in distribution) distribution[letter as OptionKey]++;
    return letter;
  });
  const part2TrueLetters: string[][] = part2.map((q) =>
    (q.subItems || []).filter((si) => si.isCorrect).map((si) => si.key)
  );
  const part3Key: string[] = part3.map((q) => (q.shortAnswerCorrect || '').toString());

  const code = options.code;
  quiz.id = `quiz-tron-${code}-${Date.now()}-${Math.floor(rand() * 1e9).toString(36)}`;
  quiz.title = `${source.title} — Mã ${code}`;
  quiz.fileName = /\.docx$/i.test(source.fileName || '')
    ? source.fileName.replace(/\.docx$/i, `_Ma${code}.docx`)
    : `${source.fileName || source.title} — Mã ${code}`;
  quiz.createdAt = new Date().toLocaleDateString('vi-VN');
  quiz.folder = source.folder;
  quiz.questionCount = quiz.questions.length;
  quiz.shuffleMeta = {
    seed,
    baseCode: options.baseCode ?? code,
    code,
    sourceQuizId: source.id,
    distribution,
  };

  return { quiz, code, seed, part1Key, part2TrueLetters, part3Key, distribution };
}

export interface GenerateVariantsConfig extends ShuffleOptions {
  /** Số mã đề cần sinh (1–12) */
  count: number;
  /** Mã đề bắt đầu; mã các biến thể là dãy liên tiếp từ đây */
  baseCode: number;
}

/** Sinh nhiều mã đề liên tiếp từ một đề gốc, seed suy từ chính đề gốc. */
export function generateShuffledVariants(
  source: Quiz,
  config: GenerateVariantsConfig
): ShuffledVariantResult[] {
  const count = Math.max(1, Math.min(12, Math.floor(config.count) || 1));
  const baseSeed = hashStringToSeed(`${source.id}|${source.title}|${source.fileName}`);
  const results: ShuffledVariantResult[] = [];
  for (let i = 0; i < count; i++) {
    const code = config.baseCode + i;
    // Seed riêng cho từng mã nhưng tất cả đều tái lập được từ đề gốc.
    const seed = (baseSeed ^ Math.imul(code, 0x9e3779b1)) >>> 0;
    results.push(
      shuffleQuestions(
        source,
        {
          code,
          baseCode: config.baseCode,
          shufflePart1Questions: config.shufflePart1Questions,
          shuffleOptions: config.shuffleOptions,
          shufflePart2Items: config.shufflePart2Items,
          shufflePart3Questions: config.shufflePart3Questions,
        },
        seed
      )
    );
  }
  return results;
}

/** Bảng đáp án thuần văn bản của tất cả biến thể — cho nút "Sao chép". */
export function buildAnswerKeyText(sourceTitle: string, results: ShuffledVariantResult[]): string {
  const lines: string[] = [`BẢNG ĐÁP ÁN CÁC MÃ ĐỀ — ${sourceTitle}`];
  for (const r of results) {
    lines.push('');
    lines.push(`Mã ${r.code}:`);
    if (r.part1Key.length > 0) {
      lines.push(`  Phần I: ${r.part1Key.join(' ')}`);
    }
    if (r.part2TrueLetters.length > 0) {
      const p2 = r.part2TrueLetters
        .map((letters, i) => `Câu ${i + 1}: ${letters.join(',') || '—'}`)
        .join(' · ');
      lines.push(`  Phần II (ý đúng): ${p2}`);
    }
    if (r.part3Key.length > 0) {
      lines.push(`  Phần III: ${r.part3Key.join(' · ')}`);
    }
    const d = r.distribution;
    lines.push(`  Phân bố đáp án Phần I: A ${d.A} · B ${d.B} · C ${d.C} · D ${d.D}`);
  }
  return lines.join('\n');
}
