import mammoth from 'mammoth';
import { Question, OptionKey, SubQuestionItem, Quiz } from '../types/quiz';

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
}

// Clean HTML tags while preserving text
function stripHtml(html: string): string {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\u00a0/g, ' ');
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
 */
function findMarkerStart(body: string, key: string, punctClass: string): number {
  const re = new RegExp(`(?:<[^>]*>|\\s)*(?:<u>)?(?:<strong>)?\\s*${key}[${punctClass}]`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const letterPos = m.index + m[0].length - 2;
    const prev = letterPos > 0 ? body[letterPos - 1] : '';
    if (!/[A-Za-zÀ-ỹ]/.test(prev)) return m.index;
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
export function parseCircular7991Html(htmlContent: string, defaultTitle = 'ĐỀ THI THEO THÔNG TƯ 7991'): ParsedExamResult {
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
  const bodyHtml = normalizedHtml.substring(0, bodyEnd).replace(/<img[^>]*>/gi, '');

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

    const cleanContent = stripHtml(questionHeadHtml).replace(/^.*?Câu\s*\d+[:.\-\s]\s*/i, '').trim();

    const optionKeys: OptionKey[] = ['A', 'B', 'C', 'D'];
    const parsedOptions: { key: OptionKey; text: string; isCorrect: boolean }[] = [];
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

        const cleanOptText = stripHtml(optSnippet)
          .replace(new RegExp(`^\\s*${currentKey}[\\.\\:\\)\\/]\\s*`, 'i'), '')
          .trim();

        parsedOptions.push({
          key: currentKey,
          text: cleanOptText || `Phương án ${currentKey}`,
          isCorrect: keyUnderlined
        });
      }
    }

    // If options were not found, provide defaults rather than dropping the authored question
    if (parsedOptions.length === 0) {
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

    allQuestions.push({
      id: `q-p1-${globalOrder}-${Date.now()}`,
      order: globalOrder++,
      partType: 'part1_choice',
      content: cleanContent || `Câu hỏi trắc nghiệm ${globalOrder - 1}`,
      options: parsedOptions,
      correctAnswer: detectedCorrect,
      explanation: 'Đáp án được nhận diện tự động từ ký tự gạch chân trong file Word theo Thông tư 7991.',
      points: 0.25
    });

    part1Count++;
    return true;
  };

  // HELPER 2: Parse a block as Part II (True/False a, b, c, d)
  const parseAsPart2 = (block: string): boolean => {
    const aStart = findMarkerStart(block, 'a', '\\.\\:\\)');
    const questionPromptHtml = aStart === -1 ? '' : block.substring(0, aStart);
    const cleanPrompt = stripHtml(questionPromptHtml).replace(/^.*?Câu\s*\d+[:.\-\s]\s*/i, '').trim();

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

        const rawText = stripHtml(itemSnippet);
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

    allQuestions.push({
      id: `q-p2-${globalOrder}-${Date.now()}`,
      order: globalOrder++,
      partType: 'part2_true_false',
      content: cleanPrompt || `Câu hỏi Đúng/Sai ${globalOrder - 1}`,
      subItems,
      options: [],
      correctAnswer: subItems.map(si => `${si.key}:${si.isCorrect ? 'Đ' : 'S'}`).join(' '),
      explanation: 'Nhận diện theo ký tự gạch chân: Ý có ký tự gạch chân là ĐÚNG, ý không gạch chân là SAI.',
      points: 1.0
    });

    part2Count++;
    return true;
  };

  // HELPER 3: Parse a block as Part III (Short Answer)
  const parseAsPart3 = (block: string): boolean => {
    const rawText = stripHtml(block);
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

    let shortAnswer = '1234'; // Default per user specification A.1234
    let explanation = '';
    if (keyAnswer) {
      shortAnswer = keyAnswer;
      explanation = `Đáp án trích từ phần ĐÁP ÁN của file Word: ${shortAnswer}.`;
    } else {
      const answerMatch = block.match(/(?:A[\.\:\)]\s*|Đáp\s*án\s*[:\s]*|ĐS\s*[:\s]*|<u[^>]*>\s*A?[\.\:]?\s*)(\d{1,4})/i)
        || rawText.match(/(?:A[\.\:\)]\s*|Đáp\s*án\s*[:\s]*|ĐS\s*[:\s]*)(\d{1,4})/i)
        || rawText.match(/\bA\.(\d{4})\b/i);

      if (answerMatch && answerMatch[1]) {
        shortAnswer = answerMatch[1].trim().slice(0, 4);
      }
      explanation = `Đáp án số 4 ký tự chuẩn: ${shortAnswer}. Thí sinh nhập đúng 4 chữ số.`;
    }

    allQuestions.push({
      id: `q-p3-${globalOrder}-${Date.now()}`,
      order: globalOrder++,
      partType: 'part3_short_answer',
      content: cleanContent || `Câu hỏi trả lời ngắn ${globalOrder - 1}`,
      shortAnswerCorrect: shortAnswer,
      correctAnswer: shortAnswer,
      options: [],
      explanation,
      points: 0.25
    });

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

  // Extract title candidate if present
  let extractedTitle = defaultTitle;
  const topText = stripHtml(normalizedHtml.substring(0, 500));
  const titleCandidate = topText.split('\n').map(l => l.trim()).filter(Boolean)[0];
  if (titleCandidate && titleCandidate.length < 90 && !/^(PHẦN|Câu)/i.test(titleCandidate)) {
    extractedTitle = titleCandidate;
  }

  return {
    title: extractedTitle,
    subject: 'Công nghệ 12',
    grade: 'Lớp 12',
    breakdown,
    totalPoints: 10,
    durationMinutes: 50,
    questions: allQuestions,
    part1Count,
    part2Count,
    part3Count,
    rawHtml: htmlContent
  };
}

/**
 * Converts Word (.docx) file ArrayBuffer to HTML with underline tag mappings
 * and parses into Circular 7991 standard.
 */
export async function parseDocxFile(file: File): Promise<ParsedExamResult> {
  const arrayBuffer = await file.arrayBuffer();

  const options = {
    styleMap: [
      "u => u",
      "b => b",
      "strong => strong",
      "i => i",
      "strike => del"
    ]
  };

  const result = await mammoth.convertToHtml({ arrayBuffer }, options);
  const html = result.value;

  const defaultTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').toUpperCase();
  return parseCircular7991Html(html, defaultTitle);
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
