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
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
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
 * Parses raw HTML (or plain text with tags) conforming to Thông tư 7991 (3 parts)
 */
export function parseCircular7991Html(htmlContent: string, defaultTitle = 'ĐỀ THI THEO THÔNG TƯ 7991'): ParsedExamResult {
  // Normalize whitespace & linebreaks
  const normalizedHtml = htmlContent
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n</p>')
    .replace(/<\/div>/gi, '\n</div>')
    .replace(/<\/tr>/gi, '\n</tr>');

  // Identify the 3 sections: PHẦN I, PHẦN II, PHẦN III
  // Regex to match section boundaries
  const part1Regex = /(?:PHẦN\s*I\b|PHẦN\s*THỨ\s*NHẤT|PHẦN\s*1\b|CÂU\s*HỎI\s*NHIỀU\s*PHƯƠNG\s*ÁN)/i;
  const part2Regex = /(?:PHẦN\s*II\b|PHẦN\s*THỨ\s*HAI|PHẦN\s*2\b|CÂU\s*HỎI\s*ĐÚNG\s*SAI)/i;
  const part3Regex = /(?:PHẦN\s*III\b|PHẦN\s*THỨ\s*BA|PHẦN\s*3\b|CÂU\s*HỎI\s*TRẢ\s*LỜI\s*NGẮN)/i;

  let section1Html = '';
  let section2Html = '';
  let section3Html = '';

  const p1Match = normalizedHtml.search(part1Regex);
  const p2Match = normalizedHtml.search(part2Regex);
  const p3Match = normalizedHtml.search(part3Regex);

  if (p1Match !== -1 || p2Match !== -1 || p3Match !== -1) {
    // We have section headers
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
  } else {
    // Fallback: try to split whole text if no explicit "PHẦN" header was found
    section1Html = normalizedHtml;
  }

  const allQuestions: Question[] = [];
  let globalOrder = 1;

  // ------------------------------------------------------------------
  // 1. PROCESS PHẦN I: TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN (A, B, C, D)
  // ------------------------------------------------------------------
  if (section1Html) {
    // Split by questions: "Câu 1", "Câu 2", etc.
    const qBlocks = section1Html.split(/(?=(?:<p[^>]*>|\n)\s*(?:<b>)?\s*Câu\s*\d+[:.])/i).filter(b => b.trim());

    qBlocks.forEach((block) => {
      // Must contain question header
      if (!/(?:Câu\s*\d+[:.])/i.test(block)) return;

      // Extract Question Content (before option A)
      const optASplit = block.split(/(?=(?:<[^>]+>|\s)*(?:<u>)?\s*A[\.\:\)])/i);
      if (optASplit.length < 2) return;

      const questionHeadHtml = optASplit[0];
      const cleanContent = stripHtml(questionHeadHtml).replace(/^.*?Câu\s*\d+[:.]\s*/i, '').trim();

      const optionsBody = block.substring(questionHeadHtml.length);

      // Split 4 options A, B, C, D
      // Look for markers: A., B., C., D.
      const optionKeys: OptionKey[] = ['A', 'B', 'C', 'D'];
      const parsedOptions: { key: OptionKey; text: string; isCorrect: boolean }[] = [];
      let detectedCorrect: OptionKey = 'A';
      let foundUnderline = false;

      for (let k = 0; k < optionKeys.length; k++) {
        const currentKey = optionKeys[k];
        const nextKey = optionKeys[k + 1];

        const startRegex = new RegExp(`(?:<[^>]*>|\\s)*(?:<u>)?\\s*${currentKey}[\\.\\:\\)]`, 'i');
        const startPos = optionsBody.search(startRegex);

        if (startPos !== -1) {
          let endPos = optionsBody.length;
          if (nextKey) {
            const nextRegex = new RegExp(`(?:<[^>]*>|\\s)*(?:<u>)?\\s*${nextKey}[\\.\\:\\)]`, 'i');
            const searchNext = optionsBody.substring(startPos + 2).search(nextRegex);
            if (searchNext !== -1) {
              endPos = startPos + 2 + searchNext;
            }
          }

          const optSnippet = optionsBody.substring(startPos, endPos);
          // Check if key is underlined in this snippet
          // e.g., <u>A.</u> or <u>A</u> or <u>A:</u>
          const keyUnderlined = isTargetUnderlined(
            optSnippet.substring(0, Math.min(optSnippet.length, 120)),
            new RegExp(`^\\s*${currentKey}[\\.\\:\\)]?|${currentKey}`, 'i')
          );

          if (keyUnderlined && !foundUnderline) {
            detectedCorrect = currentKey;
            foundUnderline = true;
          }

          const cleanOptText = stripHtml(optSnippet)
            .replace(new RegExp(`^\\s*${currentKey}[\\.\\:\\)]\\s*`, 'i'), '')
            .trim();

          parsedOptions.push({
            key: currentKey,
            text: cleanOptText || `Phương án ${currentKey}`,
            isCorrect: keyUnderlined
          });
        }
      }

      // If no underline was explicitly detected, ensure default detectedCorrect has isCorrect: true
      if (parsedOptions.length > 0) {
        parsedOptions.forEach(opt => {
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
      }
    });
  }

  const part1Count = allQuestions.length;

  // ------------------------------------------------------------------
  // 2. PROCESS PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI (a, b, c, d)
  // ------------------------------------------------------------------
  if (section2Html) {
    const qBlocks = section2Html.split(/(?=(?:<p[^>]*>|\n)\s*(?:<b>)?\s*Câu\s*\d+[:.])/i).filter(b => b.trim());

    qBlocks.forEach((block) => {
      if (!/(?:Câu\s*\d+[:.])/i.test(block)) return;

      // Extract Question prompt
      const subItemSplit = block.split(/(?=(?:<[^>]+>|\s)*(?:<u>)?\s*a[\.\)])/i);
      const questionPromptHtml = subItemSplit[0] || '';
      const cleanPrompt = stripHtml(questionPromptHtml).replace(/^.*?Câu\s*\d+[:.]\s*/i, '').trim();

      const subItemsBody = block.substring(questionPromptHtml.length);
      const subKeys: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
      const subItems: SubQuestionItem[] = [];

      for (let s = 0; s < subKeys.length; s++) {
        const curKey = subKeys[s];
        const nxtKey = subKeys[s + 1];

        const startRegex = new RegExp(`(?:<[^>]*>|\\s)*(?:<u>)?\\s*${curKey}[\\.\\)]`, 'i');
        const startPos = subItemsBody.search(startRegex);

        if (startPos !== -1) {
          let endPos = subItemsBody.length;
          if (nxtKey) {
            const nxtRegex = new RegExp(`(?:<[^>]*>|\\s)*(?:<u>)?\\s*${nxtKey}[\\.\\)]`, 'i');
            const searchNxt = subItemsBody.substring(startPos + 2).search(nxtRegex);
            if (searchNxt !== -1) {
              endPos = startPos + 2 + searchNxt;
            }
          }

          const itemSnippet = subItemsBody.substring(startPos, endPos);
          // Requirement: "CÁC CÂU HỎI ĐÚNG/SAI LÀ a), b),c),d)"
          // If underlined -> ĐÚNG (true). If not underlined -> SAI (false).
          const isUnderlined = isTargetUnderlined(
            itemSnippet.substring(0, Math.min(itemSnippet.length, 120)),
            new RegExp(`^\\s*${curKey}[\\.\\)]?|${curKey}`, 'i')
          );

          // Also allow explicit "(Đúng)" or "(Đ)" in text as reinforcement
          const rawText = stripHtml(itemSnippet);
          const hasExplicitDung = /\(Đúng\)|\(Đ\)/i.test(rawText);
          const isCorrect = isUnderlined || hasExplicitDung;

          const cleanItemContent = rawText
            .replace(new RegExp(`^\\s*${curKey}[\\.\\)]\\s*`, 'i'), '')
            .replace(/\s*\((?:Đúng|Sai|Đ|S)\)\s*$/i, '')
            .trim();

          subItems.push({
            key: curKey,
            content: cleanItemContent || `Ý mệnh đề ${curKey})`,
            isCorrect: isCorrect
          });
        }
      }

      if (subItems.length > 0) {
        allQuestions.push({
          id: `q-p2-${globalOrder}-${Date.now()}`,
          order: globalOrder++,
          partType: 'part2_true_false',
          content: cleanPrompt || `Câu hỏi Đúng/Sai ${globalOrder - 1}`,
          subItems: subItems,
          options: [],
          correctAnswer: subItems.map(si => `${si.key}:${si.isCorrect ? 'Đ' : 'S'}`).join(' '),
          explanation: 'Nhận diện theo định dạng gạch chân: Ý có ký tự gạch chân là ĐÚNG, ý không gạch chân là SAI.',
          points: 1.0 // circular 7991: up to 1.0 pt per question
        });
      }
    });
  }

  const part2Count = allQuestions.length - part1Count;

  // ------------------------------------------------------------------
  // 3. PROCESS PHẦN III: TRẮC NGHIỆM TRẢ LỜI NGẮN (4 KÝ TỰ SỐ, MẶC ĐỊNH A.1234)
  // ------------------------------------------------------------------
  if (section3Html) {
    const qBlocks = section3Html.split(/(?=(?:<p[^>]*>|\n)\s*(?:<b>)?\s*Câu\s*\d+[:.])/i).filter(b => b.trim());

    qBlocks.forEach((block) => {
      if (!/(?:Câu\s*\d+[:.])/i.test(block)) return;

      const rawText = stripHtml(block);
      const cleanContent = rawText
        .replace(/^.*?Câu\s*\d+[:.]\s*/i, '')
        .replace(/(?:Đáp\s*án|ĐS|Key|A)[\.\:\)]\s*\d{1,4}.*$/i, '')
        .trim();

      // Requirement:
      // "Câu hỏi trả lời ngắn ghi bằng số có 4 ký tự mặc định là A.1234 là đúng"
      // Search for format A.1234 or A. 1234 or A: 1234 or 4 numeric characters
      let shortAnswer = '1234'; // Default per user request!

      const answerMatch = block.match(/(?:A[\.\:\)]\s*|Đáp\s*án\s*[:\s]*|ĐS\s*[:\s]*|<u[^>]*>\s*A?[\.\:]?\s*)(\d{1,4})/i)
        || rawText.match(/(?:A[\.\:\)]\s*|Đáp\s*án\s*[:\s]*|ĐS\s*[:\s]*)(\d{1,4})/i)
        || rawText.match(/\bA\.(\d{4})\b/i);

      if (answerMatch && answerMatch[1]) {
        // Pad or truncate to 4 chars if needed, user specified 4 numeric chars e.g. 1234
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
        explanation: `Đáp án số 4 ký tự chuẩn: ${shortAnswer}. Thí sinh tô hoặc nhập đúng 4 chữ số.`,
        points: 0.25
      });
    });
  }

  const part3Count = allQuestions.length - part1Count - part2Count;

  // Compute breakdown string e.g. "18-4-6-0"
  const breakdown = `${part1Count}-${part2Count}-${part3Count}-0`;

  // Extract title if present in top lines
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

PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu 4. Mỗi câu hỏi thí sinh chỉ chọn một phương án.
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

PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời câu 1. Trong mỗi ý a), b), c), d), thí sinh chọn đúng hoặc sai.
Câu 1: Khi nghiên cứu về các biện pháp cải tạo và sử dụng đất phèn ở vùng Đồng bằng sông Cửu Long:
<u>a)</u> Biện pháp bón vôi có tác dụng khử chua, nâng độ pH của đất phèn.
<u>b)</u> Biện pháp thau chua rửa mặn bằng nguồn nước ngọt sông Tiền, sông Hậu là giải pháp sinh thái bền vững.
c) Nên cày lật sâu tầng đất sinh phèn (tầng pyrit) lên bề mặt để phơi ải trong mùa khô.
d) Đất phèn hoàn toàn không thể canh tác bất kỳ loại cây trồng nào kể cả tràm và khóm (dứa).

PHẦN III. Câu trắc nghiệm trả lời ngắn. Thí sinh trả lời câu 1 đến câu 2.
Câu 1: Một gia đình muốn lắp đặt hệ thống châm phân tự động gồm 4 bồn chứa dinh dưỡng đa lượng và vi lượng. Hãy ghi mã hiệu kỹ thuật gồm 4 ký tự số mặc định để kích hoạt van an toàn điện tử:
A. 1234

Câu 2: Trong công thức phối trộn phân NPK tỷ lệ 16-16-8 cho cây ăn trái giai đoạn nuôi trái, hãy nhập 4 chữ số biểu thị số lượng kilogram phân kali cần bón cho 1 hecta:
A. 2400
`;
}
