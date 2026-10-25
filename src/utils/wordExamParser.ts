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

  // Identify sections: PHẦN I, PHẦN II, PHẦN III
  const part1Regex = /(?:PHẦN\s*(?:I\b|THỨ\s*NHẤT|1\b)|CÂU\s*HỎI\s*NHIỀU\s*PHƯƠNG\s*ÁN)/i;
  const part2Regex = /(?:PHẦN\s*(?:II\b|THỨ\s*HAI|2\b)|CÂU\s*HỎI\s*ĐÚNG\s*SAI)/i;
  const part3Regex = /(?:PHẦN\s*(?:III\b|THỨ\s*BA|3\b)|CÂU\s*HỎI\s*TRẢ\s*LỜI\s*NGẮN)/i;

  let section1Html = '';
  let section2Html = '';
  let section3Html = '';

  const p1Match = normalizedHtml.search(part1Regex);
  const p2Match = normalizedHtml.search(part2Regex);
  const p3Match = normalizedHtml.search(part3Regex);

  const hasExplicitParts = (p1Match !== -1 || p2Match !== -1 || p3Match !== -1);

  if (hasExplicitParts) {
    const indices: { part: number; index: number }[] = [];
    if (p1Match !== -1) indices.push({ part: 1, index: p1Match });
    if (p2Match !== -1) indices.push({ part: 2, index: p2Match });
    if (p3Match !== -1) indices.push({ part: 3, index: p3Match });
    indices.sort((a, b) => a.index - b.index);

    for (let i = 0; i < indices.length; i++) {
      const current = indices[i];
      const nextIndex = i + 1 < indices.length ? indices[i + 1].index : normalizedHtml.length;
      const snippet = normalizedHtml.substring(current.index, nextIndex);
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
    const optASplit = block.split(/(?=(?:<[^>]+>|\s)*(?:<u>)?\s*(?:<strong>)?\s*A[\.\:\)\/])/i);
    let questionHeadHtml = block;
    let optionsBody = '';

    if (optASplit.length >= 2) {
      questionHeadHtml = optASplit[0];
      optionsBody = block.substring(questionHeadHtml.length);
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

      const startRegex = new RegExp(`(?:<[^>]*>|\\s)*(?:<u>)?(?:<strong>)?\\s*${currentKey}[\\.\\:\\)\\/]`, 'i');
      const startPos = optionsBody.search(startRegex);

      if (startPos !== -1) {
        let endPos = optionsBody.length;
        if (nextKey) {
          const nextRegex = new RegExp(`(?:<[^>]*>|\\s)*(?:<u>)?(?:<strong>)?\\s*${nextKey}[\\.\\:\\)\\/]`, 'i');
          const searchNext = optionsBody.substring(startPos + 2).search(nextRegex);
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
    const subItemSplit = block.split(/(?=(?:<[^>]+>|\s)*(?:<u>)?(?:<strong>)?\s*a[\.\:\)])/i);
    const questionPromptHtml = subItemSplit[0] || '';
    const cleanPrompt = stripHtml(questionPromptHtml).replace(/^.*?Câu\s*\d+[:.\-\s]\s*/i, '').trim();

    const subItemsBody = block.substring(questionPromptHtml.length);
    const subKeys: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
    const subItems: SubQuestionItem[] = [];

    for (let s = 0; s < subKeys.length; s++) {
      const curKey = subKeys[s];
      const nxtKey = subKeys[s + 1];

      const startRegex = new RegExp(`(?:<[^>]*>|\\s)*(?:<u>)?(?:<strong>)?\\s*${curKey}[\\.\\:\\)]`, 'i');
      const startPos = subItemsBody.search(startRegex);

      if (startPos !== -1) {
        let endPos = subItemsBody.length;
        if (nxtKey) {
          const nxtRegex = new RegExp(`(?:<[^>]*>|\\s)*(?:<u>)?(?:<strong>)?\\s*${nxtKey}[\\.\\:\\)]`, 'i');
          const searchNxt = subItemsBody.substring(startPos + 2).search(nxtRegex);
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

  // HELPER 3: Parse a block as Part III (Short Answer 4 numeric chars)
  const parseAsPart3 = (block: string): boolean => {
    const rawText = stripHtml(block);
    const cleanContent = rawText
      .replace(/^.*?Câu\s*\d+[:.\-\s]\s*/i, '')
      .replace(/(?:Đáp\s*án|ĐS|Key|A)[\.\:\)]\s*\d{1,4}.*$/i, '')
      .trim();

    let shortAnswer = '1234'; // Default per user specification A.1234
    const answerMatch = block.match(/(?:A[\.\:\)]\s*|Đáp\s*án\s*[:\s]*|ĐS\s*[:\s]*|<u[^>]*>\s*A?[\.\:]?\s*)(\d{1,4})/i)
      || rawText.match(/(?:A[\.\:\)]\s*|Đáp\s*án\s*[:\s]*|ĐS\s*[:\s]*)(\d{1,4})/i)
      || rawText.match(/\bA\.(\d{4})\b/i);

    if (answerMatch && answerMatch[1]) {
      shortAnswer = answerMatch[1].trim().slice(0, 4);
    }

    allQuestions.push({
      id: `q-p3-${globalOrder}-${Date.now()}`,
      order: globalOrder++,
      partType: 'part3_short_answer',
      content: cleanContent || `Câu hỏi trả lời ngắn ${globalOrder - 1}`,
      shortAnswerCorrect: shortAnswer,
      correctAnswer: shortAnswer,
      options: [],
      explanation: `Đáp án số 4 ký tự chuẩn: ${shortAnswer}. Thí sinh nhập đúng 4 chữ số.`,
      points: 0.25
    });

    part3Count++;
    return true;
  };

  // EXECUTION PATH A: Explicit Section Headers Present
  if (hasExplicitParts) {
    if (section1Html) {
      const qBlocks = section1Html.split(questionSplitter).filter(b => b.trim() && /(?:Câu\s*\d+[:.\-\s])/i.test(b));
      qBlocks.forEach(b => parseAsPart1(b));
    }
    if (section2Html) {
      const qBlocks = section2Html.split(questionSplitter).filter(b => b.trim() && /(?:Câu\s*\d+[:.\-\s])/i.test(b));
      qBlocks.forEach(b => parseAsPart2(b));
    }
    if (section3Html) {
      const qBlocks = section3Html.split(questionSplitter).filter(b => b.trim() && /(?:Câu\s*\d+[:.\-\s])/i.test(b));
      qBlocks.forEach(b => parseAsPart3(b));
    }
  } else {
    // EXECUTION PATH B: Standard Exam Without Explicit "PHẦN" Headers
    // Automatically classify each question based on its internal structure!
    const allBlocks = normalizedHtml.split(questionSplitter).filter(b => b.trim() && /(?:Câu\s*\d+[:.\-\s])/i.test(b));

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
