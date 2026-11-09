import mammoth from 'mammoth';
import { Question, OptionKey, SubQuestionItem, Quiz } from '../types/quiz';
import { preprocessDocx, MathSegment } from './docxPreprocess';
import { DEFAULT_SUBJECT, isKnownSubject } from '../data/subjects';

export interface ParsedExamResult {
  title: string;
  subject: string;
  grade: string;
  breakdown: string;
  totalPoints: number;
  durationMinutes: number;
  questions: Question[];
  part1Count: number;
  part2Count: number;
  part3Count: number;
  rawHtml?: string;
  // Trọng số điểm từng phần đọc từ chính file (Phase B); UI dùng làm mặc định
  // khi tạo phiên thi thay cho hằng số ghi cứng.
  part1PointPerQuestion: number;
  part2PointPerQuestion: number;
  part3PointPerQuestion: number;
  // Đáp án Phần III vi phạm quy tắc số thuần 1–4 ký tự (chỉ cảnh báo).
  part3Violations: Part3Violation[];
  // Cảnh báo import khác (công thức/hình không đọc được, phương án rỗng...).
  importWarnings: string[];
}

/** Dữ liệu giàu trích từ .docx ở tầng tiền xử lí (xem docxPreprocess.ts). */
export interface ParseExtras {
  mathSegments?: MathSegment[];
  /** Data URI theo chỉ số token ⟦img:{i}⟧ toàn cục trong tài liệu. */
  imageDataUris?: string[];
  warnings?: string[];
}

export interface Part3Violation {
  /** Số thứ tự câu trong Phần III (1-based). */
  partIndex: number;
  /** Thứ tự toàn cục của câu trong đề. */
  order: number;
  answer: string;
  reason: string;
}

/**
 * Quy tắc Phần III của Thầy: đáp án CHỈ là con số — chữ số, dấu trừ đứng đầu
 * nếu âm, dấu phẩy thập phân — dài tự nhiên 1–4 ký tự, KHÔNG đệm 0.
 * Trả về lý do vi phạm, hoặc null nếu hợp lệ.
 */
export function validatePart3Answer(answer: string): string | null {
  const a = (answer ?? '').trim();
  if (!a) return 'Chưa có đáp án';
  if (a.length > 4) return `Dài ${a.length} ký tự — tối đa 4 ký tự (tính cả dấu trừ và dấu phẩy)`;
  if (!/^-?\d+(,\d+)?$/.test(a)) {
    return 'Chỉ được gồm chữ số, dấu trừ ở đầu (nếu âm) và dấu phẩy thập phân — không phân số, %, đơn vị hay chữ';
  }
  return null;
}

export function findPart3Violations(questions: Question[]): Part3Violation[] {
  const violations: Part3Violation[] = [];
  let partIndex = 0;
  questions.forEach((q) => {
    if (q.partType !== 'part3_short_answer') return;
    partIndex++;
    const answer = (q.shortAnswerCorrect || q.correctAnswer || '').toString();
    const reason = validatePart3Answer(answer);
    if (reason) {
      violations.push({ partIndex, order: q.order, answer, reason });
    }
  });
  return violations;
}

// Clean HTML tags while preserving text
function stripHtml(html: string): string {
  if (typeof document === 'undefined') {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\u00a0/g, ' ');
}

/**
 * HTML → "rich text" used across the app (Phase B): plain text plus inline
 * markers that RichText.tsx renders —
 *   \(...\)     LaTeX (inserted when OMML tokens are substituted)
 *   ⟦img:N⟧     image N of the owning question (token inserted pre-mammoth)
 *   ⟦table⟧     the question's structured table
 *   ⟦sub:x⟧ / ⟦sup:x⟧   subscript / superscript runs (was: flattened digits)
 * Mammoth emits <sub>/<sup> for vertAlign runs; keep their semantics here
 * instead of letting stripHtml merge them into the surrounding digits.
 */
function htmlToRichText(html: string): string {
  const withMarkers = html
    .replace(/<sub>([\s\S]*?)<\/sub>/gi, (_m, inner) => `⟦sub:${inner.replace(/<[^>]+>/g, '')}⟧`)
    .replace(/<sup>([\s\S]*?)<\/sup>/gi, (_m, inner) => `⟦sup:${inner.replace(/<[^>]+>/g, '')}⟧`);
  return stripHtml(withMarkers);
}

// Check if a specific target option key (e.g. "A." or "a)") has underline formatting
function isTargetUnderlined(htmlSnippet: string, keyRegex: RegExp): boolean {
  // Check patterns like:
  // <u>A.</u> or <u>A</u>. or <u>A)</u> or <u>a)</u> or <u>a</u>)
  // or <u> A. some text </u>
  const underlinePattern = /<u[^>]*>([\s\S]*?)<\/u>/gi;
  let match;
  while ((match = underlinePattern.exec(htmlSnippet)) !== null) {
    const underlinedContent = match[1];
    if (keyRegex.test(underlinedContent)) {
      return true;
    }
  }

  // Also check inline style="text-decoration: underline"
  const inlineUnderlinePattern = /style="[^"]*text-decoration:\s*underline[^"]*"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/gi;
  while ((match = inlineUnderlinePattern.exec(htmlSnippet)) !== null) {
    if (keyRegex.test(match[1])) {
      return true;
    }
  }

  return false;
}

/**
 * Find the start position of an option/sub-item marker ("A.", "b)", ...) in an
 * HTML fragment. A candidate is rejected when the marker letter is immediately
 * preceded by another letter — e.g. the "a)" in "(kg/ha)" or the "C." in "ĐC."
 * (đối chứng) are part of words, not markers.
 * A candidate is also rejected when the letter is immediately preceded by "(":
 * "(B)." inside an option's own text is a parenthetical symbol reference, not
 * an option start (Vật lí Q14: option A is literally "ben (B)." and option B is
 * "oát (W)." — accepting the parenthetical "B." truncated A to "ben (" and
 * produced a phantom "B.. B. oát (W)." option).
 */
function findMarkerStart(body: string, key: string, punctClass: string): number {
  // The leading run may swallow OPENING/structural tags and whitespace, but
  // NEVER the CLOSING tag of an inline formatting element (</u>, </b>, ...):
  // those closers belong to the PREVIOUS option's marked letter. Letting the
  // regex eat them used to truncate the previous option's snippet before its
  // </u>, which silently broke correct-answer detection (Phase A finding 2 —
  // worst when the next option's text was empty because mammoth dropped its
  // OMML formula, putting the marker immediately after </u></b>).
  const re = new RegExp(`(?:<(?!\/(?:u|b|strong|i|em|sub|sup|del)>)[^>]*>|\\s)*(?:<u>)?(?:<strong>)?\\s*${key}[${punctClass}]`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const letterPos = m.index + m[0].length - 2;
    const prev = letterPos > 0 ? body[letterPos - 1] : '';
    if (!/[A-Za-zÀ-ỹ]/.test(prev) && prev !== '(') return m.index;
  }
  return -1;
}

// Section heading patterns (shared by the body splitter and the answer-key reader)
const PART1_HEADING = /(?:PHẦN\s*(?:I\b|THỨ\s*NHẤT|1\b)|CÂU\s*HỎI\s*NHIỀU\s*PHƯƠNG\s*ÁN)/i;
const PART2_HEADING = /(?:PHẦN\s*(?:II\b|THỨ\s*HAI|2\b)|CÂU\s*HỎI\s*ĐÚNG\s*SAI)/i;
const PART3_HEADING = /(?:PHẦN\s*(?:III\b|THỨ\s*BA|3\b)|CÂU\s*HỎI\s*TRẢ\s*LỜI\s*NGẮN)/i;

/**
 * Read the Phần III (short-answer) answers out of the answer-key section.
 * Key lines look like "Câu 1: 9/16. <short explanation>" — the answer is the
 * first token run after "Câu N:", ending at the first '.' followed by a space
 * (sentence end), at ';', or at the line end. The value is kept VERBATIM as
 * printed ("9/16", "0,6", "3000", "41,5%"); no reformatting is applied.
 * Returns an empty map when the key has no Phần III segment.
 */
function extractPart3AnswersFromKey(answerSectionHtml: string): Map<number, string> {
  const answers = new Map<number, string>();
  if (!answerSectionHtml) return answers;

  const text = stripHtml(answerSectionHtml.replace(/<img[^>]*>/gi, ''));
  const p3Index = text.search(PART3_HEADING);
  if (p3Index === -1) return answers;

  let segment = text.substring(p3Index);
  // If another part's heading follows the Phần III heading (unusual key order),
  // stop the segment there so its entries cannot pollute the map.
  const rest = segment.substring(8);
  const nextHeading = rest.search(new RegExp(`(?:${PART1_HEADING.source}|${PART2_HEADING.source})`, 'i'));
  if (nextHeading !== -1) segment = segment.substring(0, nextHeading + 8);

  const entryRegex = /Câu\s*(\d+)\s*[:.]\s*/g;
  const entries = [...segment.matchAll(entryRegex)];
  entries.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < entries.length ? (entries[i + 1].index ?? segment.length) : segment.length;
    let raw = segment.substring(start, end).split(/[;\n]/)[0];
    const sentenceEnd = raw.search(/\.\s/);
    if (sentenceEnd !== -1) raw = raw.substring(0, sentenceEnd);
    const value = raw.replace(/\.+$/, '').trim();
    // Skip implausible values: a lone A–D letter is a Phần I key leaking in,
    // and Đúng/Sai wording belongs to Phần II entries.
    if (value && !/^[A-D]$/.test(value) && !/^(?:Đúng|Sai)\b/i.test(value)) {
      answers.set(parseInt(m[1], 10), value);
    }
  });

  return answers;
}

/**
 * Robust Circular 7991 HTML Parser:
 * Guarantees that EVERY authored question in the Word document is preserved.
 */
export function parseCircular7991Html(
  htmlContent: string,
  defaultTitle = 'ĐỀ THI THEO THÔNG TƯ 7991',
  extras?: ParseExtras
): ParsedExamResult {
  // Normalize whitespace & linebreaks
  const normalizedHtml = htmlContent
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n</p>')
    .replace(/<\/div>/gi, '\n</div>')
    .replace(/<\/tr>/gi, '\n</tr>')
    .replace(/<\/li>/gi, '\n</li>');

  // The teacher's canonical file appends an answer-key section ("ĐÁP ÁN ...")
  // after the exam body. That section repeats "Câu N: ..." lines, so it must be
  // cut off before parsing, otherwise key lines are mistaken for questions.
  const answerKeyPatterns = [
    /(?:<p[^>]*>|<div[^>]*>|\n)\s*(?:<[^>]+>\s*)*ĐÁP\s*ÁN/i,
    // Heading may carry a short non-letter prefix (dashes, dots): "—— ĐÁP ÁN ..."
    /(?:<p[^>]*>|<div[^>]*>|\n)\s*(?:<[^>]+>\s*)*[^A-Za-zÀ-ỹ<]{0,16}ĐÁP\s*ÁN/i,
  ];
  let answerKeyIndex = -1;
  for (const pattern of answerKeyPatterns) {
    const idx = normalizedHtml.search(pattern);
    if (idx !== -1 && (answerKeyIndex === -1 || idx < answerKeyIndex)) answerKeyIndex = idx;
  }

  // A standalone end-of-exam paragraph ("— HẾT —") also terminates the body:
  // it must not stay glued onto the last question's stem.
  const hetIndex = normalizedHtml.search(
    /(?:<p[^>]*>|<div[^>]*>|\n)\s*(?:<[^>]+>\s*)*[—–\-]*\s*HẾT\s*[—–\-]*\s*(?:<[^>]+>\s*)*\n/i
  );

  // The answer-key section is kept aside: Phần III answers live ONLY there.
  const answerSectionHtml = answerKeyIndex !== -1 ? normalizedHtml.substring(answerKeyIndex) : '';
  const part3KeyAnswers = extractPart3AnswersFromKey(answerSectionHtml);

  let bodyEnd = normalizedHtml.length;
  if (answerKeyIndex !== -1) bodyEnd = Math.min(bodyEnd, answerKeyIndex);
  if (hetIndex !== -1) bodyEnd = Math.min(bodyEnd, hetIndex);

  // Strip <img> tags: embedded base64 image data contains letter+punctuation
  // sequences (e.g. "A/") that create false option markers inside the payload.
  // (Word images arrive as ⟦img:N⟧ text tokens via the pre-processing layer,
  // so no real image is lost by this strip.)
  let bodyHtml = normalizedHtml.substring(0, bodyEnd).replace(/<img[^>]*>/gi, '');

  // Extract <table> blocks into structured rows BEFORE question splitting.
  // Flattening them into running text (old behaviour) destroyed the grid —
  // e.g. the Sinh F1/F2/F3 genotype table became one unreadable line. Each
  // table is replaced by a ⟦table:K⟧ token; the owning question later gets
  // `table` attached and the token normalised to ⟦table⟧ for the renderer.
  const extractedTables: string[][][] = [];
  bodyHtml = bodyHtml.replace(/<table\b[\s\S]*?<\/table>/gi, (tableHtml) => {
    const rows: string[][] = [];
    const rowParts = tableHtml.split(/<tr\b[^>]*>/i).slice(1);
    rowParts.forEach((rowHtml) => {
      const cells = rowHtml
        .split(/<t[dh]\b[^>]*>/i)
        .slice(1)
        .map((cellHtml) => htmlToRichText(cellHtml.replace(/<\/t[dh]>[\s\S]*$/i, '')).replace(/\s+/g, ' ').trim());
      if (cells.length > 0 && cells.some((c) => c.length > 0)) rows.push(cells);
    });
    const idx = extractedTables.length;
    extractedTables.push(rows);
    return `\n⟦table:${idx}⟧\n`;
  });

  // Identify sections: PHẦN I, PHẦN II, PHẦN III
  const part1Regex = PART1_HEADING;
  const part2Regex = PART2_HEADING;
  const part3Regex = PART3_HEADING;

  let section1Html = '';
  let section2Html = '';
  let section3Html = '';

  const p1Match = bodyHtml.search(part1Regex);
  const p2Match = bodyHtml.search(part2Regex);
  const p3Match = bodyHtml.search(part3Regex);

  const hasExplicitParts = (p1Match !== -1 || p2Match !== -1 || p3Match !== -1);

  if (hasExplicitParts) {
    const indices: { part: number; index: number }[] = [];
    if (p1Match !== -1) indices.push({ part: 1, index: p1Match });
    if (p2Match !== -1) indices.push({ part: 2, index: p2Match });
    if (p3Match !== -1) indices.push({ part: 3, index: p3Match });
    indices.sort((a, b) => a.index - b.index);

    for (let i = 0; i < indices.length; i++) {
      const current = indices[i];
      const nextIndex = i + 1 < indices.length ? indices[i + 1].index : bodyHtml.length;
      const snippet = bodyHtml.substring(current.index, nextIndex);
      if (current.part === 1) section1Html = snippet;
      if (current.part === 2) section2Html = snippet;
      if (current.part === 3) section3Html = snippet;
    }
  }

  const allQuestions: Question[] = [];
  let globalOrder = 1;
  let part1Count = 0;
  let part2Count = 0;
  let part3Count = 0;

  // Question splitting regex supporting <b>, <strong>, <u>, <span>, <p>, <td>
  const questionSplitter = /(?=(?:<p[^>]*>|<tr[^>]*>|<td[^>]*>|<div[^>]*>|\n|^)\s*(?:<[^>]+>)*\s*Câu\s*\d+[:.\-\s])/i;

  // --- Rich-content finalisation (Phase B) --------------------------------
  // Runs on each fully-built question: substitutes ⟦MATH{i}⟧ tokens with
  // \(LaTeX\), attaches the structured table, re-indexes ⟦img:N⟧ markers so
  // they point into THIS question's own `images` array (an image can never
  // be detached from its question — the EduMix shuffle lesson), keeps the
  // original OMML XML on the question, and derives the plain-text stem.
  const finalizeRich = (q: Question): void => {
    const warnings: string[] = [...(q.parseWarnings || [])];
    const ommlCollector: string[] = [];

    const subMath = (text: string, plainOut: { value: string }): string => {
      plainOut.value = text.replace(/⟦MATH(\d+)⟧/g, (m, n) => {
        const seg = extras?.mathSegments?.[Number(n)];
        return seg ? seg.plain || seg.latex || m : m;
      });
      return text.replace(/⟦MATH(\d+)⟧/g, (m, n) => {
        const seg = extras?.mathSegments?.[Number(n)];
        if (!seg) return m; // unknown token — leave it visible, never invent
        if (seg.ommlXml) ommlCollector.push(seg.ommlXml);
        if (!seg.latex) {
          warnings.push('Có công thức toán chưa chuyển được sang LaTeX — vị trí công thức hiện dấu "chưa đọc được", XML gốc vẫn được lưu kèm câu hỏi.');
          return '⟦công thức chưa đọc được⟧';
        }
        return `\\(${seg.latex}\\)`;
      });
    };

    const contentPlainBox = { value: '' };
    q.content = subMath(q.content, contentPlainBox);
    (q.options || []).forEach((opt) => {
      opt.text = subMath(opt.text, { value: '' });
    });
    (q.subItems || []).forEach((si) => {
      si.content = subMath(si.content, { value: '' });
    });
    if (ommlCollector.length > 0) q.ommlXml = ommlCollector;

    // Plain-text stem for titles/search/fallbacks (from the linearised math
    // version, with media/table/sub-sup markers reduced to readable text).
    q.contentPlain = contentPlainBox.value
      .replace(/⟦img:\d+⟧/g, '[Hình ảnh]')
      .replace(/⟦table(?::\d+)?⟧/g, '[Bảng số liệu]')
      .replace(/⟦sub:([\s\S]*?)⟧/g, '$1')
      .replace(/⟦sup:([\s\S]*?)⟧/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    // Structured table: first ⟦table:K⟧ found (content, then options, then
    // sub-items) becomes q.table; every marker normalises to ⟦table⟧.
    const fields: { get: () => string; set: (v: string) => void }[] = [
      { get: () => q.content, set: (v) => { q.content = v; } },
      ...(q.options || []).map((opt) => ({ get: () => opt.text, set: (v: string) => { opt.text = v; } })),
      ...(q.subItems || []).map((si) => ({ get: () => si.content, set: (v: string) => { si.content = v; } })),
    ];
    let tableAttached = false;
    fields.forEach((f) => {
      const text = f.get();
      if (!/⟦table:\d+⟧/.test(text)) return;
      f.set(text.replace(/⟦table:(\d+)⟧/g, (_m, n) => {
        const rows = extractedTables[Number(n)];
        if (rows && !tableAttached) {
          q.table = rows;
          tableAttached = true;
        }
        return '⟦table⟧';
      }));
    });

    // Images: collect the global token indices actually used by this
    // question (in field order) and re-index them locally.
    const seen = new Map<number, number>();
    const order: number[] = [];
    const scan = (text: string) => {
      for (const m of text.matchAll(/⟦img:(\d+)⟧/g)) {
        const g = Number(m[1]);
        if (!seen.has(g)) {
          seen.set(g, order.length);
          order.push(g);
        }
      }
    };
    fields.forEach((f) => scan(f.get()));
    if (order.length > 0) {
      const rewrite = (text: string) =>
        text.replace(/⟦img:(\d+)⟧/g, (m, n) => {
          const local = seen.get(Number(n));
          return local === undefined ? m : `⟦img:${local}⟧`;
        });
      fields.forEach((f) => f.set(rewrite(f.get())));
      q.images = order.map((g) => extras?.imageDataUris?.[g] ?? '');
      if (q.images.some((uri) => !uri)) {
        warnings.push('Có hình ảnh trong câu không đọc được từ file Word — vị trí hình hiện khung cảnh báo.');
      }
    }

    if (warnings.length > 0) q.parseWarnings = warnings;
  };

  // HELPER 1: Parse a block as Part I (Multiple Choice A, B, C, D)
  const parseAsPart1 = (block: string): boolean => {
    // Extract Question Content (before option A)
    let questionHeadHtml = block;
    let optionsBody = '';

    const aStart = findMarkerStart(block, 'A', '\\.\\:\\)\\/');
    if (aStart !== -1) {
      questionHeadHtml = block.substring(0, aStart);
      optionsBody = block.substring(aStart);
    } else {
      // Fallback: look for A. anywhere
      const aIndex = block.search(/(?:^|\n|\s|[>])A[\.\:\)\/]\s*/i);
      if (aIndex !== -1) {
        questionHeadHtml = block.substring(0, aIndex);
        optionsBody = block.substring(aIndex);
      }
    }

    const cleanContent = htmlToRichText(questionHeadHtml).replace(/^.*?Câu\s*\d+[:.\-\s]\s*/i, '').trim();

    const optionKeys: OptionKey[] = ['A', 'B', 'C', 'D'];
    const parsedOptions: { key: OptionKey; text: string; isCorrect: boolean }[] = [];
    const partWarnings: string[] = [];
    let detectedCorrect: OptionKey = 'A';
    let foundUnderline = false;

    for (let k = 0; k < optionKeys.length; k++) {
      const currentKey = optionKeys[k];
      const nextKey = optionKeys[k + 1];

      const startPos = findMarkerStart(optionsBody, currentKey, '\\.\\:\\)\\/');

      if (startPos !== -1) {
        let endPos = optionsBody.length;
        if (nextKey) {
          const searchNext = findMarkerStart(optionsBody.substring(startPos + 2), nextKey, '\\.\\:\\)\\/');
          if (searchNext !== -1) {
            endPos = startPos + 2 + searchNext;
          }
        }

        const optSnippet = optionsBody.substring(startPos, endPos);
        const keyUnderlined = isTargetUnderlined(
          optSnippet.substring(0, Math.min(optSnippet.length, 120)),
          new RegExp(`^\\s*${currentKey}[\\.\\:\\)\\/]?|${currentKey}`, 'i')
        );

        if (keyUnderlined && !foundUnderline) {
          detectedCorrect = currentKey;
          foundUnderline = true;
        }

        const cleanOptText = htmlToRichText(optSnippet)
          .replace(new RegExp(`^\\s*${currentKey}[\\.\\:\\)\\/]\\s*`, 'i'), '')
          .trim();

        if (!cleanOptText) {
          // Never invent option content — keep a visible placeholder and warn.
          partWarnings.push(`Phương án ${currentKey} không có nội dung đọc được trong file Word (có thể là công thức/hình chưa đọc được).`);
        }

        parsedOptions.push({
          key: currentKey,
          text: cleanOptText || `Phương án ${currentKey}`,
          isCorrect: keyUnderlined
        });
      }
    }

    // If options were not found, provide defaults rather than dropping the authored question
    if (parsedOptions.length === 0) {
      partWarnings.push('Không tách được 4 phương án A–D trong file Word.');
      optionKeys.forEach((k) => {
        parsedOptions.push({
          key: k,
          text: `Phương án ${k}`,
          isCorrect: k === 'A'
        });
      });
    }

    // Ensure detected option has isCorrect true
    parsedOptions.forEach((opt) => {
      opt.isCorrect = (opt.key === detectedCorrect);
    });

    const question: Question = {
      id: `q-p1-${globalOrder}-${Date.now()}`,
      order: globalOrder++,
      partType: 'part1_choice',
      content: cleanContent || `Câu hỏi trắc nghiệm ${globalOrder - 1}`,
      options: parsedOptions,
      correctAnswer: detectedCorrect,
      explanation: 'Đáp án được nhận diện tự động từ ký tự gạch chân trong file Word theo Thông tư 7991.',
      points: 0.25
    };
    if (partWarnings.length > 0) question.parseWarnings = partWarnings;
    finalizeRich(question);
    allQuestions.push(question);

    part1Count++;
    return true;
  };

  // HELPER 2: Parse a block as Part II (True/False a, b, c, d)
  const parseAsPart2 = (block: string): boolean => {
    const aStart = findMarkerStart(block, 'a', '\\.\\:\\)');
    const questionPromptHtml = aStart === -1 ? '' : block.substring(0, aStart);
    const cleanPrompt = htmlToRichText(questionPromptHtml).replace(/^.*?Câu\s*\d+[:.\-\s]\s*/i, '').trim();

    const subItemsBody = aStart === -1 ? block : block.substring(aStart);
    const subKeys: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
    const subItems: SubQuestionItem[] = [];

    for (let s = 0; s < subKeys.length; s++) {
      const curKey = subKeys[s];
      const nxtKey = subKeys[s + 1];

      const startPos = findMarkerStart(subItemsBody, curKey, '\\.\\:\\)');

      if (startPos !== -1) {
        let endPos = subItemsBody.length;
        if (nxtKey) {
          const searchNxt = findMarkerStart(subItemsBody.substring(startPos + 2), nxtKey, '\\.\\:\\)');
          if (searchNxt !== -1) {
            endPos = startPos + 2 + searchNxt;
          }
        }

        const itemSnippet = subItemsBody.substring(startPos, endPos);
        const isUnderlined = isTargetUnderlined(
          itemSnippet.substring(0, Math.min(itemSnippet.length, 120)),
          new RegExp(`^\\s*${curKey}[\\.\\:\\)]?|${curKey}`, 'i')
        );

        const rawText = htmlToRichText(itemSnippet);
        const hasExplicitDung = /\(Đúng\)|\(Đ\)/i.test(rawText);
        const isCorrect = isUnderlined || hasExplicitDung;

        const cleanItemContent = rawText
          .replace(new RegExp(`^\\s*${curKey}[\\.\\:\\)]\\s*`, 'i'), '')
          .replace(/\s*\((?:Đúng|Sai|Đ|S)\)\s*$/i, '')
          .trim();

        subItems.push({
          key: curKey,
          content: cleanItemContent || `Ý mệnh đề ${curKey})`,
          isCorrect
        });
      }
    }

    // Fallback if some sub-items weren't parsed
    if (subItems.length === 0) {
      subKeys.forEach((k, idx) => {
        subItems.push({
          key: k,
          content: `Ý mệnh đề ${k})`,
          isCorrect: idx < 2 // a,b true by default
        });
      });
    }

    const question2: Question = {
      id: `q-p2-${globalOrder}-${Date.now()}`,
      order: globalOrder++,
      partType: 'part2_true_false',
      content: cleanPrompt || `Câu hỏi Đúng/Sai ${globalOrder - 1}`,
      subItems,
      options: [],
      correctAnswer: subItems.map(si => `${si.key}:${si.isCorrect ? 'Đ' : 'S'}`).join(' '),
      explanation: 'Nhận diện theo ký tự gạch chân: Ý có ký tự gạch chân là ĐÚNG, ý không gạch chân là SAI.',
      points: 1.0
    };
    if (subItems.length === 0) {
      question2.parseWarnings = ['Không tách được các ý a)–d) trong file Word.'];
    }
    finalizeRich(question2);
    allQuestions.push(question2);

    part2Count++;
    return true;
  };

  // HELPER 3: Parse a block as Part III (Short Answer)
  const parseAsPart3 = (block: string): boolean => {
    const rawText = htmlToRichText(block);
    // This question's own number ("Câu N.") — used to look up its key answer.
    const numMatch = rawText.match(/Câu\s*(\d+)\s*[:.]/i);
    const questionNum = numMatch ? parseInt(numMatch[1], 10) : -1;

    let cleanContent = rawText
      .replace(/^.*?Câu\s*\d+[:.\-\s]\s*/i, '')
      .replace(/(?:Đáp\s*án|ĐS|Key|A)[\.\:\)]\s*\d{1,4}.*$/i, '')
      .trim();
    // Defence in depth: drop a trailing standalone end-of-exam line ("— HẾT —")
    // if one ever survives into the block.
    cleanContent = cleanContent
      .split('\n')
      .filter((line, idx, arr) => !(idx === arr.length - 1 && /^\s*[—–\-]*\s*HẾT\s*[—–\-]*\s*$/.test(line) && (line.includes('—') || line.includes('–') || line.trim() === 'HẾT')))
      .join('\n')
      .trim();

    // Preferred source: the answer-key section of the same file (verbatim).
    const keyAnswer = questionNum !== -1 ? part3KeyAnswers.get(questionNum) : undefined;

    let shortAnswer = '1234'; // Fallback marker when no answer exists in the file
    let explanation = '';
    let answerMissing = false;
    if (keyAnswer) {
      shortAnswer = keyAnswer;
      explanation = `Đáp án trích từ phần ĐÁP ÁN của file Word: ${shortAnswer}.`;
    } else {
      const answerMatch = block.match(/(?:A[\.\:\)]\s*|Đáp\s*án\s*[:\s]*|ĐS\s*[:\s]*|<u[^>]*>\s*A?[\.\:]?\s*)(\d{1,4})/i)
        || rawText.match(/(?:A[\.\:\)]\s*|Đáp\s*án\s*[:\s]*|ĐS\s*[:\s]*)(\d{1,4})/i)
        || rawText.match(/\bA\.(\d{4})\b/i);

      if (answerMatch && answerMatch[1]) {
        shortAnswer = answerMatch[1].trim().slice(0, 4);
        explanation = `Đáp án nhận diện trong thân câu: ${shortAnswer}.`;
      } else {
        // Nothing truthful was found — keep the legacy sentinel BUT flag it
        // loudly instead of pretending it is a real answer.
        answerMissing = true;
        explanation = 'Chưa tìm thấy đáp án trong file Word — đang để tạm 1234, Thầy vui lòng kiểm tra và sửa lại.';
      }
    }

    const question3: Question = {
      id: `q-p3-${globalOrder}-${Date.now()}`,
      order: globalOrder++,
      partType: 'part3_short_answer',
      content: cleanContent || `Câu hỏi trả lời ngắn ${globalOrder - 1}`,
      shortAnswerCorrect: shortAnswer,
      correctAnswer: shortAnswer,
      options: [],
      explanation,
      points: 0.25
    };
    if (answerMissing) {
      question3.parseWarnings = ['Chưa tìm thấy đáp án Phần III trong file — đáp án đang để tạm 1234.'];
    }
    finalizeRich(question3);
    allQuestions.push(question3);

    part3Count++;
    return true;
  };

  // A block only counts as a question when it STARTS with "Câu N." (after any
  // leading HTML tags). Section headers such as "PHẦN I. Thí sinh trả lời từ
  // câu 1 đến câu 24..." mention "câu 1" mid-sentence and must NOT be treated
  // as a question block (doing so shifts every detected answer by one).
  const isQuestionBlock = (b: string) => /^(?:<[^>]+>|\s)*Câu\s*\d+\s*[.:]/i.test(b);

  // EXECUTION PATH A: Explicit Section Headers Present
  if (hasExplicitParts) {
    if (section1Html) {
      const qBlocks = section1Html.split(questionSplitter).filter(isQuestionBlock);
      qBlocks.forEach(b => parseAsPart1(b));
    }
    if (section2Html) {
      const qBlocks = section2Html.split(questionSplitter).filter(isQuestionBlock);
      qBlocks.forEach(b => parseAsPart2(b));
    }
    if (section3Html) {
      const qBlocks = section3Html.split(questionSplitter).filter(isQuestionBlock);
      qBlocks.forEach(b => parseAsPart3(b));
    }
  } else {
    // EXECUTION PATH B: Standard Exam Without Explicit "PHẦN" Headers
    // Automatically classify each question based on its internal structure!
    const allBlocks = bodyHtml.split(questionSplitter).filter(isQuestionBlock);

    allBlocks.forEach((b) => {
      // Check if block has True/False format: contains a), b), c) or a., b., c.
      const hasSubItems = /(?:<[^>]+>|\s)*(?:<u>)?\s*[a-d][\.\:\)]\s+/i.test(b);
      // Check if block has Part III format: contains short answer 4 digits or A.1234
      const hasShortAnswerIndicator = /(?:trả\s*lời\s*ngắn|điền\s*số|A\.\d{4})/i.test(b);

      if (hasSubItems) {
        parseAsPart2(b);
      } else if (hasShortAnswerIndicator) {
        parseAsPart3(b);
      } else {
        parseAsPart1(b);
      }
    });
  }

  // Compute breakdown string e.g. "18-4-6-0"
  const breakdown = `${part1Count}-${part2Count}-${part3Count}-0`;

  // --- Metadata from the file itself (Phase B) -----------------------------
  // Subject + duration from the exam header; per-part weights from the
  // "mỗi câu X điểm" statements (they live in the part headings, most
  // reliably in the answer-key section). Hardcoded guesses are last resort.
  const fullPlainText = stripHtml(normalizedHtml);
  const headerText = fullPlainText.substring(0, 2500);

  // --- Subject + grade detection ------------------------------------------
  // Tên môn chuẩn nằm ở src/data/subjects.ts (SUBJECT_OPTIONS); bộ nhận diện
  // CHỈ được trả về một trong các chuỗi đó (tên môn + khối lớp), không bao
  // giờ trả chuỗi tự do — không nhận diện được thì để null, nơi gọi dùng
  // môn mặc định như trước.
  //
  // Nguồn tìm MÔN (theo thứ tự tin cậy): dòng "Môn: ..." ở đầu đề → tiêu
  // đề/tên file → các mẩu "MÔN ..." khác trong khối đầu đề → 300 ký tự đầu
  // của đề (bắt các đề ghi môn ngay trong dòng tiêu đề kiểu "ĐỀ THI TOÁN 12").
  // Nguồn tìm KHỐI LỚP: cùng dòng "Môn:" → tiêu đề/tên file → nhãn
  // "Lớp/Khối" trong khối đầu đề; không thấy thì mặc định lớp 12.
  const SUBJECT_SYNONYMS: Array<[RegExp, string]> = [
    [/GIÁO\s*DỤC\s*KINH\s*TẾ|GIAO\s*DUC\s*KINH\s*TE|GDKT|GDCD/, 'Giáo dục kinh tế và pháp luật'],
    [/CÔNG\s*NGHỆ|CONG\s*NGHE/, 'Công nghệ'],
    [/NGỮ\s*VĂN|NGU\s*VAN/, 'Ngữ văn'],
    [/TIẾNG\s*ANH|TIENG\s*ANH|ENGLISH/, 'Tiếng Anh'],
    [/VẬT\s*L[ÍI]|VẬT\s*LÝ|VAT\s*LI/, 'Vật lí'],
    [/LỊCH\s*SỬ|LICH\s*SU/, 'Lịch sử'],
    [/ĐỊA\s*L[ÍI]|ĐỊA\s*LÝ|DIA\s*LI/, 'Địa lí'],
    [/TIN\s*HỌC|TIN\s*HOC/, 'Tin học'],
    [/TOÁN|TOAN/, 'Toán học'],
    [/HÓA\s*HỌC|HOA\s*HOC|HÓA|HOA/, 'Hóa học'],
    [/SINH\s*HỌC|SINH\s*HOC|SINH/, 'Sinh học'],
    [/ĐỊA|DIA/, 'Địa lí'],
    [/LÝ|LY/, 'Vật lí'],
    [/SỬ/, 'Lịch sử'],
    [/VĂN|VAN/, 'Ngữ văn'],
    [/ANH/, 'Tiếng Anh'],
    [/TIN/, 'Tin học'],
  ];
  // Khớp đồng nghĩa theo ranh giới chữ cái (\\p{L}) để các từ viết tắt ngắn
  // (ANH, TIN, LÝ...) không khớp nhầm giữa một từ khác (THANH, TINH...).
  const matchSubjectBase = (text: string | null | undefined): string | null => {
    if (!text) return null;
    const up = text.toUpperCase().replace(/\s+/g, ' ');
    for (const [pattern, base] of SUBJECT_SYNONYMS) {
      const re = new RegExp(`(?<![\\p{L}])(?:${pattern.source})(?![\\p{L}])`, 'u');
      if (re.test(up)) return base;
    }
    return null;
  };
  const GRADE_LABELLED = /(?:LỚP|KHỐI|LOP|KHOI)\s*[-:.]?\s*(1[0-2])(?!\d)/;
  const GRADE_BARE = /(?<!\d)(1[0-2])(?!\d)/;
  const matchGrade = (text: string | null | undefined, allowBare: boolean): string | null => {
    if (!text) return null;
    const up = text.toUpperCase();
    const labelled = up.match(GRADE_LABELLED);
    if (labelled) return labelled[1];
    if (allowBare) {
      const bare = up.match(GRADE_BARE);
      if (bare) return bare[1];
    }
    return null;
  };

  const subjectMatch = headerText.match(/M[ôo]n(?:\s*thi)?\s*[:\-]?\s*([^\n]{2,60})/i);
  const rawSubjectLine = subjectMatch
    ? subjectMatch[1].split(/thời gian/i)[0].trim().replace(/\s+/g, ' ')
    : null;
  const monSnippets = (headerText.match(/M[ÔO]N[^\n]{0,60}/gi) || []).join(' • ');
  // 300 ký tự đầu có thể chứa tên tỉnh "Thanh Hóa" trong dòng Sở GD&ĐT —
  // loại riêng cụm này để không nhận nhầm thành môn Hóa ở nguồn cuối này.
  const headerStart = headerText.substring(0, 300).replace(/THANH\s*H[ÓO]A/gi, ' ');

  const detectedBase =
    matchSubjectBase(rawSubjectLine) ||
    matchSubjectBase(defaultTitle) ||
    matchSubjectBase(monSnippets) ||
    matchSubjectBase(headerStart);
  const detectedGrade =
    matchGrade(rawSubjectLine, true) ||
    matchGrade(defaultTitle, true) ||
    matchGrade(headerText, false) ||
    '12';
  let detectedSubject: string | null = null;
  if (detectedBase) {
    const candidate = `${detectedBase} ${detectedGrade}`;
    if (isKnownSubject(candidate)) detectedSubject = candidate;
  }

  let detectedDuration: number | null = null;
  const durationMatch = headerText.match(/Thời gian(?:\s*làm bài)?\s*[:\-]?\s*(\d{1,3})\s*phút/i);
  if (durationMatch) {
    const d = parseInt(durationMatch[1], 10);
    if (d >= 5 && d <= 300) detectedDuration = d;
  }

  const weightFor = (roman: 'I' | 'II' | 'III', fallback: number): number => {
    const re = new RegExp(`PHẦN\\s*${roman}\\b[\\s\\S]{0,220}?mỗi câu\\s*([\\d]+(?:[.,]\\d+)?)\\s*điểm`, 'i');
    const m = fullPlainText.match(re);
    if (m) {
      const v = parseFloat(m[1].replace(',', '.'));
      if (v > 0 && v <= 5) return v;
    }
    return fallback;
  };
  const part1Weight = weightFor('I', 0.25);
  const part2Weight = weightFor('II', 1.0);
  // Toán-style structure (12 MCQ + Phần III present) → Phần III = 0,5đ/câu.
  const part3Weight = weightFor('III', part1Count === 12 && part3Count > 0 ? 0.5 : 0.25);

  allQuestions.forEach((q) => {
    if (q.partType === 'part1_choice') q.points = part1Weight;
    else if (q.partType === 'part2_true_false') q.points = part2Weight;
    else if (q.partType === 'part3_short_answer') q.points = part3Weight;
  });

  // Phần III rule check (warnings only — never block the import).
  const part3Violations = findPart3Violations(allQuestions);
  if (part3Violations.length > 0) {
    allQuestions.forEach((q) => {
      if (q.partType !== 'part3_short_answer') return;
      const answer = (q.shortAnswerCorrect || q.correctAnswer || '').toString();
      const reason = validatePart3Answer(answer);
      if (reason) {
        q.parseWarnings = [...(q.parseWarnings || []), `Đáp án Phần III "${answer}": ${reason}`];
      }
    });
  }

  const importWarnings: string[] = [...(extras?.warnings || [])];
  allQuestions.forEach((q) => {
    (q.parseWarnings || []).forEach((w) => {
      importWarnings.push(`Câu ${q.order}: ${w}`);
    });
  });

  // Extract title candidate if present. Prefer the actual "ĐỀ THI…" header
  // line over an office header line ("SỞ GD&ĐT…") when both are present.
  let extractedTitle = defaultTitle;
  const topText = stripHtml(normalizedHtml.substring(0, 900));
  const topLines = topText.split('\n').map(l => l.trim()).filter(Boolean);
  const examLine = topLines.find((l) => /ĐỀ\s+(THI|KIỂM\s*TRA|ÔN|LUYỆN)/i.test(l) && l.length < 120);
  const titleCandidate = examLine || topLines[0];
  if (titleCandidate && titleCandidate.length < 120 && !/^(PHẦN|Câu)/i.test(titleCandidate)) {
    extractedTitle = titleCandidate;
  }

  return {
    title: extractedTitle,
    subject: detectedSubject || DEFAULT_SUBJECT,
    grade: `Lớp ${detectedGrade}`,
    breakdown,
    totalPoints: 10,
    durationMinutes: detectedDuration || 50,
    questions: allQuestions,
    part1Count,
    part2Count,
    part3Count,
    rawHtml: htmlContent,
    part1PointPerQuestion: part1Weight,
    part2PointPerQuestion: part2Weight,
    part3PointPerQuestion: part3Weight,
    part3Violations,
    importWarnings
  };
}

/**
 * Converts Word (.docx) file ArrayBuffer to HTML with underline tag mappings
 * and parses into Circular 7991 standard.
 */
export async function parseDocxFile(file: File): Promise<ParsedExamResult> {
  const arrayBuffer = await file.arrayBuffer();

  // Pre-process the .docx package: OMML → ⟦MATH⟧ tokens, images → ⟦img:⟧
  // tokens (bound to their question/option), so mammoth's HTML carries the
  // rich content instead of dropping it. Any failure falls back to the
  // legacy mammoth-only path.
  let mammothBuffer: ArrayBuffer = arrayBuffer;
  let extras: ParseExtras | undefined;
  try {
    const pre = await preprocessDocx(arrayBuffer);
    if (pre) {
      mammothBuffer = pre.arrayBuffer;
      extras = {
        mathSegments: pre.mathSegments,
        imageDataUris: pre.imageDataUris,
        warnings: pre.warnings,
      };
    }
  } catch (err) {
    console.warn('[WordParser] Tiền xử lý .docx thất bại, dùng đường mammoth thuần:', err);
  }

  const options = {
    styleMap: [
      "u => u",
      "b => b",
      "strong => strong",
      "i => i",
      "strike => del"
    ]
  };

  // Mammoth's browser build reads `arrayBuffer`; its Node build reads
  // `buffer`. Pass both so the parser behaves identically in the app and in
  // the Node regression harness.
  const mammothInput: Record<string, unknown> = { arrayBuffer: mammothBuffer };
  if (typeof Buffer !== 'undefined') {
    mammothInput.buffer = Buffer.from(mammothBuffer);
  }
  const result = await mammoth.convertToHtml(mammothInput as any, options);
  const html = result.value;

  const defaultTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').toUpperCase();
  return parseCircular7991Html(html, defaultTitle, extras);
}

/**
 * Generate a sample standard Circular 7991 Word-like HTML template
 * so teachers can preview or copy-paste directly.
 */
export function getSampleCircular7991Template(): string {
  return `ĐỀ THI THỬ TỐT NGHIỆP THPT THEO THÔNG TƯ 7991
Môn: Công nghệ Trồng trọt 12 - Năm học 2025 - 2026
Thời gian: 50 phút (Không kể thời gian phát đề)

PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu 18. Mỗi câu hỏi thí sinh chỉ chọn một phương án.
Câu 1: Phương thức trồng trọt công nghệ cao nào giúp kiểm soát chính xác lượng dinh dưỡng cung cấp cho cây trồng?
<u>A.</u> Hệ thống tưới nhỏ giọt tự động kết hợp châm phân định lượng.
B. Tưới tràn rãnh ngập sâu định kỳ hàng tuần.
C. Rải phân hạt tự do trên bề mặt luống đất.
D. Tưới phun mưa áp lực cực lớn làm dập nát lá.

Câu 2: Loại đất nào có hàm lượng hạt sét cao, giữ nước và chất dinh dưỡng tốt nhưng dễ bị bí nghẽn khi ngập úng?
A. Đất cát pha ven biển.
<u>B.</u> Đất sét pha thịt nặng.
C. Đất đá vôi hoang mạc.
D. Đất sỏi đồi dốc cằn cỗi.

PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời câu 19 đến câu 22. Trong mỗi ý a), b), c), d), thí sinh chọn đúng hoặc sai.
Câu 19: Khi nghiên cứu về các biện pháp cải tạo và sử dụng đất phèn ở vùng Đồng bằng sông Cửu Long:
<u>a)</u> Biện pháp bón vôi có tác dụng khử chua, nâng độ pH của đất phèn.
<u>b)</u> Biện pháp thau chua rửa mặn bằng nguồn nước ngọt sông Tiền, sông Hậu là giải pháp sinh thái bền vững.
c) Nên cày lật sâu tầng đất sinh phèn (tầng pyrit) lên bề mặt để phơi ải trong mùa khô.
d) Đất phèn hoàn toàn không thể canh tác bất kỳ loại cây trồng nào kể cả tràm và khóm (dứa).

PHẦN III. Câu trắc nghiệm trả lời ngắn. Thí sinh trả lời câu 23 đến câu 28.
Câu 23: Một gia đình muốn lắp đặt hệ thống châm phân tự động gồm 4 bồn chứa dinh dưỡng đa lượng và vi lượng. Hãy ghi mã hiệu kỹ thuật gồm 4 ký tự số mặc định để kích hoạt van an toàn điện tử:
A. 1234

Câu 24: Trong công thức phối trộn phân NPK tỷ lệ 16-16-8 cho cây ăn trái giai đoạn nuôi trái, hãy nhập 4 chữ số biểu thị số lượng kilogram phân kali cần bón cho 1 hecta:
A. 2400
`;
}
