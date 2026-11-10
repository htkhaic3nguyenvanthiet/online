// ============================================================
// LaTeX -> OMML — port nguyên vẹn pipeline của EduMix
// (tronde/src/utils/scientificExamProcessor.ts): LaTeX -> MathML
// (KaTeX) -> OMML, dự phòng bộ chuyển trực tiếp LaTeX -> OMML.
// Dùng khi xuất đề giấy: công thức không có OMML gốc (ví dụ khôi
// phục từ MathType) vẫn thành công thức Word thật, không bị rơi.
// ============================================================
import katex from 'katex';


/**
 * Bản đồ giải mã vùng Private Use Area (PUA: U+F020..U+F0FF) từ font Symbol / MT Extra / Wingdings của Microsoft Word cũ
 * sang chuẩn UTF-8 Unicode (Cambria Math) để triệt tiêu hoàn toàn lỗi ô vuông (□) khi mở trên Word.
 */
const PUA_SYMBOL_TO_UNICODE_MAP: Record<number, string> = {
  0xf020: ' ',
  0xf021: '!',
  0xf022: '∀',
  0xf023: '#',
  0xf024: '∃',
  0xf025: '%',
  0xf026: '&',
  0xf027: '∋',
  0xf028: '(',
  0xf029: ')',
  0xf02a: '∗',
  0xf02b: '+',
  0xf02c: ',',
  0xf02d: '−',
  0xf02e: '.',
  0xf02f: '/',
  0xf030: '0',
  0xf031: '1',
  0xf032: '2',
  0xf033: '3',
  0xf034: '4',
  0xf035: '5',
  0xf036: '6',
  0xf037: '7',
  0xf038: '8',
  0xf039: '9',
  0xf03a: ':',
  0xf03b: ';',
  0xf03c: '<',
  0xf03d: '=',
  0xf03e: '>',
  0xf03f: '?',
  0xf040: '≅',
  0xf041: 'Α',
  0xf042: 'Β',
  0xf043: 'Χ',
  0xf044: 'Δ',
  0xf045: 'Ε',
  0xf046: 'Φ',
  0xf047: 'Γ',
  0xf048: 'Η',
  0xf049: 'Ι',
  0xf04a: 'ϑ',
  0xf04b: 'Κ',
  0xf04c: 'Λ',
  0xf04d: 'Μ',
  0xf04e: 'Ν',
  0xf04f: 'Ο',
  0xf050: 'Π',
  0xf051: 'Θ',
  0xf052: 'Ρ',
  0xf053: 'Σ',
  0xf054: 'Τ',
  0xf055: 'Υ',
  0xf056: 'ς',
  0xf057: 'Ω',
  0xf058: 'Ξ',
  0xf059: 'Ψ',
  0xf05a: 'Ζ',
  0xf05b: '[',
  0xf05c: '∴',
  0xf05d: ']',
  0xf05e: '⊥',
  0xf05f: '_',
  0xf060: '‾',
  0xf061: 'α',
  0xf062: 'β',
  0xf063: 'χ',
  0xf064: 'δ',
  0xf065: 'ε',
  0xf066: 'φ',
  0xf067: 'γ',
  0xf068: 'η',
  0xf069: 'ι',
  0xf06a: 'ϕ',
  0xf06b: 'κ',
  0xf06c: 'λ',
  0xf06d: 'μ',
  0xf06e: 'ν',
  0xf06f: 'ο',
  0xf070: 'π',
  0xf071: 'θ',
  0xf072: 'ρ',
  0xf073: 'σ',
  0xf074: 'τ',
  0xf075: 'υ',
  0xf076: 'ϖ',
  0xf077: 'ω',
  0xf078: 'ξ',
  0xf079: 'ψ',
  0xf07a: 'ζ',
  0xf07b: '{',
  0xf07c: '|',
  0xf07d: '}',
  0xf07e: '∼',
  0xf0a0: '€',
  0xf0a1: 'ϒ',
  0xf0a2: '′',
  0xf0a3: '≤',
  0xf0a4: '⁄',
  0xf0a5: '∞',
  0xf0a6: 'ƒ',
  0xf0a7: '♣',
  0xf0a8: '♦',
  0xf0a9: '♥',
  0xf0aa: '♠',
  0xf0ab: '↔',
  0xf0ac: '←',
  0xf0ad: '↑',
  0xf0ae: '→',
  0xf0af: '↓',
  0xf0b0: '°',
  0xf0b1: '±',
  0xf0b2: '″',
  0xf0b3: '≥',
  0xf0b4: '×',
  0xf0b5: '∝',
  0xf0b6: '∂',
  0xf0b7: '•',
  0xf0b8: '÷',
  0xf0b9: '≠',
  0xf0ba: '≡',
  0xf0bb: '≈',
  0xf0bc: '…',
  0xf0bd: '∣',
  0xf0be: '⎯',
  0xf0bf: '↵',
  0xf0c0: 'ℵ',
  0xf0c1: 'ℑ',
  0xf0c2: 'ℜ',
  0xf0c3: '℘',
  0xf0c4: '⊗',
  0xf0c5: '⊕',
  0xf0c6: '∅',
  0xf0c7: '∩',
  0xf0c8: '∪',
  0xf0c9: '⊃',
  0xf0ca: '⊇',
  0xf0cb: '⊄',
  0xf0cc: '⊂',
  0xf0cd: '⊆',
  0xf0ce: '∈',
  0xf0cf: '∉',
  0xf0d0: '∠',
  0xf0d1: '∇',
  0xf0d2: '®',
  0xf0d3: '©',
  0xf0d4: '™',
  0xf0d5: '∏',
  0xf0d6: '√',
  0xf0d7: '⋅',
  0xf0d8: '¬',
  0xf0d9: '∧',
  0xf0da: '∨',
  0xf0db: '⇔',
  0xf0dc: '⇐',
  0xf0dd: '⇑',
  0xf0de: '⇒',
  0xf0df: '⇓',
  0xf0e0: '◊',
  0xf0e1: '⟨',
  0xf0e2: '®',
  0xf0e3: '©',
  0xf0e4: '™',
  0xf0e5: '∑',
  0xf0e6: '(',
  0xf0e7: '(',
  0xf0e8: '(',
  0xf0e9: '⌈',
  0xf0ea: '⌊',
  0xf0eb: '⌊',
  0xf0ec: '{',
  0xf0ed: '{',
  0xf0ee: '{',
  0xf0ef: '|',
  0xf0f1: '⟩',
  0xf0f2: '∫',
  0xf0f3: '∫',
  0xf0f4: '∫',
  0xf0f5: '∫',
  0xf0f6: ')',
  0xf0f7: ')',
  0xf0f8: ')',
  0xf0f9: '⌉',
  0xf0fa: '⌋',
  0xf0fb: '⌋',
  0xf0fc: '}',
  0xf0fd: '}',
  0xf0fe: '}',
};

/**
 * Giải mã thẻ <w:sym w:font="..." w:char="..."/> trong Word XML sang ký tự UTF-8 chuẩn
 */
export function decodeWordSymChar(fontName: string, charHex: string): string {
  const code = parseInt((charHex || '').trim(), 16);
  if (Number.isNaN(code)) return '';
  if (PUA_SYMBOL_TO_UNICODE_MAP[code]) {
    return PUA_SYMBOL_TO_UNICODE_MAP[code];
  }
  const normalizedFont = (fontName || '').toLowerCase();
  if (normalizedFont.includes('mt extra')) {
    if (code === 0xf072 || code === 0x0072) return '\u20D7';
    if (code === 0xf06c || code === 0x006c) return 'ℓ';
    if (code === 0xf068 || code === 0x0068) return 'ℏ';
  }
  if (code >= 0xf020 && code <= 0xf0ff) {
    const lowCode = code - 0xf000;
    const remapped = PUA_SYMBOL_TO_UNICODE_MAP[0xf000 + lowCode];
    if (remapped) return remapped;
    if (lowCode >= 0x20 && lowCode <= 0x7e) {
      return String.fromCharCode(lowCode);
    }
  }
  if (code >= 0x20 && code <= 0xd7ff) {
    return String.fromCharCode(code);
  }
  return '';
}

/**
 * Làm sạch toàn bộ ký tự PUA (U+E000..U+F8FF), variation selectors, ký tự vô hình và thực thể HTML
 * về chuẩn UTF-8 NFC để Word hiển thị đúng với font Cambria Math mà không bao giờ bị ô vuông (□).
 */
export function sanitizeSpecialCharsToUtf8(input: string): string {
  if (!input) return '';
  let out = input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&rarr;/gi, '→')
    .replace(/&larr;/gi, '←')
    .replace(/&harr;/gi, '↔')
    .replace(/&rArr;/gi, '⇒')
    .replace(/&hArr;/gi, '⇔')
    .replace(/&le;/gi, '≤')
    .replace(/&ge;/gi, '≥')
    .replace(/&ne;/gi, '≠')
    .replace(/&plusmn;/gi, '±')
    .replace(/&times;/gi, '×')
    .replace(/&divide;/gi, '÷')
    .replace(/&deg;/gi, '°')
    .replace(/&infin;/gi, '∞')
    .replace(/&radic;/gi, '√')
    .replace(/&sum;/gi, '∑')
    .replace(/&prod;/gi, '∏')
    .replace(/&int;/gi, '∫')
    .replace(/&part;/gi, '∂')
    .replace(/&nabla;/gi, '∇')
    .replace(/&isin;/gi, '∈')
    .replace(/&notin;/gi, '∉')
    .replace(/&sub;/gi, '⊂')
    .replace(/&sube;/gi, '⊆')
    .replace(/&cup;/gi, '∪')
    .replace(/&cap;/gi, '∩')
    .replace(/&empty;/gi, '∅')
    .replace(/&perp;/gi, '⊥')
    .replace(/&ang;/gi, '∠')
    .replace(/&Delta;/g, 'Δ')
    .replace(/&Omega;/g, 'Ω')
    .replace(/&alpha;/g, 'α')
    .replace(/&beta;/g, 'β')
    .replace(/&gamma;/g, 'γ')
    .replace(/&delta;/g, 'δ')
    .replace(/&epsilon;/g, 'ε')
    .replace(/&lambda;/g, 'λ')
    .replace(/&mu;/g, 'μ')
    .replace(/&pi;/g, 'π')
    .replace(/&sigma;/g, 'σ')
    .replace(/&phi;/g, 'φ')
    .replace(/&omega;/g, 'ω');

  // Chuyển đổi từng ký tự nằm trong vùng PUA (U+F000..U+F0FF) hoặc loại bỏ PUA lạ gây ô vuông
  let cleaned = '';
  for (let i = 0; i < out.length; i++) {
    const code = out.charCodeAt(i);
    if (PUA_SYMBOL_TO_UNICODE_MAP[code]) {
      cleaned += PUA_SYMBOL_TO_UNICODE_MAP[code];
    } else if (code >= 0xe000 && code <= 0xf8ff) {
      // Ký tự PUA không xác định -> bỏ qua để tránh hiện ô vuông □ trong Word
      continue;
    } else if (
      (code >= 0xfe00 && code <= 0xfe0f) || // Variation Selectors (gây ô vuông trên Word cũ)
      (code >= 0x2061 && code <= 0x2064) || // Invisible math operators (\u2061 Function Application...)
      (code >= 0x200b && code <= 0x200d) || // Zero-width spaces
      code === 0xfeff ||
      code === 0xfffd ||
      code === 0x25a1 // White square □ lỗi font
    ) {
      continue;
    } else if (code === 0x2212) {
      // Chuẩn hóa dấu trừ toán học
      cleaned += '-';
    } else {
      cleaned += out[i];
    }
  }

  return cleaned.normalize('NFC');
}

/**
 * Bản đồ chuyển đổi ký hiệu LaTeX Toán - Lý - Hóa - Sinh sang ký tự chuẩn Unicode / Toán học
 */
const LATEX_SYMBOL_MAP: Record<string, string> = {
  '\\alpha': 'α',
  '\\beta': 'β',
  '\\gamma': 'γ',
  '\\delta': 'δ',
  '\\epsilon': 'ε',
  '\\varepsilon': 'ε',
  '\\zeta': 'ζ',
  '\\eta': 'η',
  '\\theta': 'θ',
  '\\vartheta': 'ϑ',
  '\\iota': 'ι',
  '\\kappa': 'κ',
  '\\lambda': 'λ',
  '\\mu': 'μ',
  '\\nu': 'ν',
  '\\xi': 'ξ',
  '\\pi': 'π',
  '\\rho': 'ρ',
  '\\sigma': 'σ',
  '\\tau': 'τ',
  '\\upsilon': 'υ',
  '\\phi': 'φ',
  '\\varphi': 'φ',
  '\\chi': 'χ',
  '\\psi': 'ψ',
  '\\omega': 'ω',
  '\\Gamma': 'Γ',
  '\\Delta': 'Δ',
  '\\Theta': 'Θ',
  '\\Lambda': 'Λ',
  '\\Xi': 'Ξ',
  '\\Pi': 'Π',
  '\\Sigma': 'Σ',
  '\\Upsilon': 'Υ',
  '\\Phi': 'Φ',
  '\\Psi': 'Ψ',
  '\\Omega': 'Ω',
  '\\rightarrow': '→',
  '\\to': '→',
  '\\leftarrow': '←',
  '\\leftrightarrow': '↔',
  '\\rightleftharpoons': '⇌',
  '\\leftrightharpoons': '⇌',
  '\\Rightarrow': '⇒',
  '\\Leftarrow': '⇐',
  '\\Leftrightarrow': '⇔',
  '\\iff': '⇔',
  '\\uparrow': '↑',
  '\\downarrow': '↓',
  '\\pm': '±',
  '\\mp': '∓',
  '\\times': '×',
  '\\div': '÷',
  '\\cdot': '·',
  '\\ast': '∗',
  '\\leq': '≤',
  '\\le': '≤',
  '\\geq': '≥',
  '\\ge': '≥',
  '\\neq': '≠',
  '\\ne': '≠',
  '\\approx': '≈',
  '\\equiv': '≡',
  '\\cong': '≅',
  '\\sim': '∼',
  '\\propto': '∝',
  '\\infty': '∞',
  '\\partial': '∂',
  '\\nabla': '∇',
  '\\forall': '∀',
  '\\exists': '∃',
  '\\in': '∈',
  '\\notin': '∉',
  '\\subset': '⊂',
  '\\subseteq': '⊆',
  '\\cup': '∪',
  '\\cap': '∩',
  '\\emptyset': '∅',
  '\\varnothing': '∅',
  '\\angle': '∠',
  '\\measuredangle': '∡',
  '\\sphericalangle': '∢',
  '\\perp': '⊥',
  '\\parallel': '∥',
  '\\triangle': '△',
  '\\square': '□',
  '\\lozenge': '◊',
  '\\odot': '⊙',
  '\\oplus': '⊕',
  '\\otimes': '⊗',
  '\\star': '⋆',
  '\\hbar': 'ℏ',
  '\\ell': 'ℓ',
  '\\supset': '⊃',
  '\\supseteq': '⊇',
  '\\setminus': '∖',
  '\\vee': '∨',
  '\\wedge': '∧',
  '\\neg': '¬',
  '\\implies': '⇒',
  '\\mapsto': '↦',
  '\\updownarrow': '↕',
  '\\nearrow': '↗',
  '\\searrow': '↘',
  '\\prime': '′',
  '\\dots': '…',
  '\\cdots': '⋯',
  '\\ldots': '…',
  '\\male': '♂',
  '\\female': '♀',
  '\\circ': '°',
  '\\degree': '°',
  '\\mathbb{R}': 'ℝ',
  '\\mathbb{N}': 'ℕ',
  '\\mathbb{Z}': 'ℤ',
  '\\mathbb{Q}': 'ℚ',
  '\\mathbb{C}': 'ℂ',
  '\\{': '{',
  '\\}': '}',
};

const UNICODE_SUB_TO_NORMAL: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  '₊': '+',
  '₋': '-',
  '₌': '=',
  '₍': '(',
  '₎': ')',
  'ₐ': 'a',
  'ₑ': 'e',
  'ₒ': 'o',
  'ₓ': 'x',
  'ₕ': 'h',
  'ₖ': 'k',
  'ₗ': 'l',
  'ₘ': 'm',
  'ₙ': 'n',
  'ₚ': 'p',
  'ₛ': 's',
  'ₜ': 't',
};

const UNICODE_SUP_TO_NORMAL: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '₇': '7',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
  '⁼': '=',
  '⁽': '(',
  '⁾': ')',
  'ⁿ': 'n',
  'ⁱ': 'i',
};

function escapeXmlText(str: string): string {
  return sanitizeSpecialCharsToUtf8(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Thay thế các macro ký hiệu LaTeX đơn giản (\alpha, \Omega, \rightarrow, \rightleftharpoons...) sang ký tự Unicode chuẩn
 */
export function replaceLatexSymbolsWithUnicode(input: string): string {
  if (!input) return '';
  let out = sanitizeSpecialCharsToUtf8(input);

  // Chuẩn hóa mũi tên phản ứng hóa học viết tắt
  out = out
    .replace(/<==>|\\rightleftharpoons|\\leftrightharpoons/g, '⇌')
    .replace(/<=>/g, '⇌')
    .replace(/-->/g, '→')
    .replace(/(?<![<=-])->(?![>])/g, '→');

  // Thay thế các lệnh LaTeX dài trước, ngắn sau
  const sortedKeys = Object.keys(LATEX_SYMBOL_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const escapedKey = key.replace(/[\\{}]/g, '\\$&');
    const regex = new RegExp(`${escapedKey}(?![a-zA-Z])`, 'g');
    out = out.replace(regex, LATEX_SYMBOL_MAP[key]);
  }

  return out;
}

/**
 * Đọc nhóm ngoặc nhọn { ... } cân bằng trong chuỗi LaTeX bắt đầu từ vị trí idx
 */
function readBalancedBraces(
  str: string,
  startIdx: number,
  openChar = '{',
  closeChar = '}'
): { content: string; nextIdx: number } | null {
  let i = startIdx;
  while (i < str.length && /\s/.test(str[i])) i++;
  if (i >= str.length || str[i] !== openChar) return null;

  let depth = 0;
  const contentStart = i + 1;
  for (; i < str.length; i++) {
    if (str[i] === '\\' && i + 1 < str.length) {
      i++;
      continue;
    }
    if (str[i] === openChar) depth++;
    else if (str[i] === closeChar) {
      depth--;
      if (depth === 0) {
        return {
          content: str.slice(contentStart, i),
          nextIdx: i + 1,
        };
      }
    }
  }
  return {
    content: str.slice(contentStart),
    nextIdx: str.length,
  };
}

export interface WordRunStyleOptions {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  colorHex?: string;
  fontSizeHalfPt?: number;
  vertAlign?: 'subscript' | 'superscript';
  fontFamily?: string;
}

/**
 * Tạo một phần tử <m:r> trong chuẩn Office Math Markup Language (OMML)
 * BẮT BUỘC dùng font Cambria Math để hiển thị toàn bộ ký hiệu toán học, véc-tơ, tích phân, căn thức và ký hiệu đặc biệt mà không bị ô vuông (□).
 */
function buildOmmlRun(
  text: string,
  italic = true,
  style?: WordRunStyleOptions
): string {
  const clean = sanitizeSpecialCharsToUtf8(replaceLatexSymbolsWithUnicode(text));
  if (!clean) return '';
  const sz = style?.fontSizeHalfPt || 24;
  return `<m:r><m:rPr><m:scr m:val="roman"/><m:sty m:val="${
    italic ? 'i' : 'p'
  }"/>${italic ? '' : '<m:nor/>'}</m:rPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" w:eastAsia="Cambria Math" w:cs="Cambria Math"/>${
    style?.bold ? '<w:b/><w:bCs/>' : ''
  }${
    style?.colorHex ? `<w:color w:val="${style.colorHex}"/>` : ''
  }<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><m:t xml:space="preserve">${escapeXmlText(
    clean
  )}</m:t></m:r>`;
}

/**
 * Chuẩn hóa chuỗi LaTeX trước khi đưa vào KaTeX để sinh MathML chuẩn W3C
 */
function preprocessLatexForMathMl(latexRaw: string): string {
  let s = sanitizeSpecialCharsToUtf8(latexRaw || '')
    .trim()
    .replace(/^\$\$|\$\$$/g, '')
    .replace(/^\$|\$$/g, '')
    .replace(/^\\\(|\\\)$/g, '')
    .replace(/^\\\[|\\\]$/g, '')
    .trim();

  // Hỗ trợ các macro đặc thù Toán - Lý - Hóa - Sinh Việt Nam mà KaTeX mặc định không có sẵn
  s = s
    .replace(/\\male\b/g, '♂')
    .replace(/\\female\b/g, '♀')
    .replace(/\\degree\b/g, '^\\circ')
    .replace(/\\xrightleftharpoons\s*(\[[^\]]*\])?\s*\{([^{}]*)\}/g, (_, sub, sup) => {
      if (sub) {
        return `\\stackrel{${sup}}{\\underset{${sub.slice(1, -1)}}{\\rightleftharpoons}}`;
      }
      return `\\overset{${sup}}{\\rightleftharpoons}`;
    })
    .replace(/\\xrightarrow\s*(\[[^\]]*\])?\s*\{([^{}]*)\}/g, (_, sub, sup) => {
      if (sub) {
        return `\\stackrel{${sup}}{\\underset{${sub.slice(1, -1)}}{\\longrightarrow}}`;
      }
      return `\\overset{${sup}}{\\longrightarrow}`;
    })
    .replace(/\\xleftarrow\s*(\[[^\]]*\])?\s*\{([^{}]*)\}/g, (_, sub, sup) => {
      if (sub) {
        return `\\stackrel{${sup}}{\\underset{${sub.slice(1, -1)}}{\\longleftarrow}}`;
      }
      return `\\overset{${sup}}{\\longleftarrow}`;
    });

  return s;
}

/**
 * BƯỚC 1: Chuyển đổi mỗi đoạn công thức LaTeX sang chuẩn MathML (sử dụng KaTeX có sẵn trên trang hoặc MathJax fallback)
 */
export function convertLatexToMathMl(latexRaw: string): string {
  const prepared = preprocessLatexForMathMl(latexRaw);
  if (!prepared) return '';

  try {
    const mathmlHtml = katex.renderToString(prepared, {
      output: 'mathml',
      throwOnError: false,
      strict: false,
      trust: true,
    });
    const mathMatch = mathmlHtml.match(/<math[\s\S]*<\/math>/i);
    if (mathMatch) {
      return mathMatch[0];
    }
  } catch {
    // Fallback sang MathJax nếu có trên window
  }

  try {
    const win = typeof window !== 'undefined' ? (window as unknown as Record<string, any>) : null;
    if (win && win.MathJax && typeof win.MathJax.tex2mml === 'function') {
      const mml = win.MathJax.tex2mml(prepared);
      if (typeof mml === 'string' && mml.includes('<math')) {
        return mml;
      }
    }
  } catch {
    // Bỏ qua lỗi MathJax
  }

  return '';
}

const NARY_OPERATORS_SET = new Set(['∫', '∬', '∭', '∮', '∑', '∏', '⋃', '⋂']);

function normalizeAccentCharForOmml(rawAccent: string): {
  type: 'acc' | 'bar';
  chr: string;
  pos?: 'top' | 'bot';
} {
  const t = (rawAccent || '').trim();
  if (
    t === '¯' ||
    t === '‾' ||
    t === '\u00AF' ||
    t === '\u0304' ||
    t === '\u0305' ||
    t === '⎯' ||
    t === '_'
  ) {
    return { type: 'bar', chr: '¯', pos: t === '_' ? 'bot' : 'top' };
  }
  if (
    t === '→' ||
    t === '⟶' ||
    t === '\u2192' ||
    t === '\u27F6' ||
    t === '\u20D7' ||
    t === '⇀' ||
    t === '\u20D1'
  ) {
    // Chuẩn Microsoft Word OMML: dấu véc-tơ trên đỉnh phải là U+20D7 (Combining Right Arrow Above)
    return { type: 'acc', chr: '\u20D7' };
  }
  if (t === 'ˆ' || t === '^' || t === '\u0302' || t === '\u02C6') {
    return { type: 'acc', chr: '\u0302' };
  }
  if (t === '~' || t === '˜' || t === '\u0303' || t === '\u02DC') {
    return { type: 'acc', chr: '\u0303' };
  }
  if (t === '˙' || t === '\u0307') {
    return { type: 'acc', chr: '\u0307' };
  }
  if (t === '¨' || t === '\u0308') {
    return { type: 'acc', chr: '\u0308' };
  }
  if (t === '˘' || t === '\u0306' || t === '⌢' || t === '⌒') {
    return { type: 'acc', chr: '\u0306' };
  }
  return { type: 'acc', chr: t || '\u20D7' };
}

/**
 * BƯỚC 2: Bộ chuyển đổi MathML sang XML OMML chuẩn của Microsoft Word (theo quy tắc mml2omml)
 * Hỗ trợ đầy đủ: <math>, <semantics>, <mrow>, <mi>, <mn>, <mo>, <mtext>, <mfrac>, <msqrt>, <mroot>,
 * <msub>, <msup>, <msubsup>, <mover>, <munder>, <munderover>, <mtable>, <mtr>, <mtd>, <mfenced>, <menclose>.
 */
export function convertMathMlToOmmlInnerXml(
  mathmlString: string,
  style?: WordRunStyleOptions
): string {
  if (!mathmlString || typeof DOMParser === 'undefined') return '';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(mathmlString, 'text/html');
    const mathEl = doc.querySelector('math');
    if (!mathEl) return '';

    const convertChildrenList = (elements: Element[]): string => {
      const results: string[] = [];
      let idx = 0;

      while (idx < elements.length) {
        const el = elements[idx];
        const tag = el.tagName.toLowerCase();

        // Nhận diện cặp ngoặc co giãn (\left ... \right hoặc hệ phương trình \begin{cases}...\end{cases})
        if (tag === 'mo') {
          const opText = sanitizeSpecialCharsToUtf8(el.textContent || '').trim();
          const isFence =
            el.getAttribute('fence') === 'true' ||
            el.getAttribute('stretchy') === 'true';

          // Trường hợp hệ phương trình: <mo>{</mo> đi kèm <mtable> ngay phía sau
          if (opText === '{' && idx + 1 < elements.length) {
            const nextEl = elements[idx + 1];
            const nextTag = nextEl.tagName.toLowerCase();
            if (nextTag === 'mtable') {
              const nextCloseEl = idx + 2 < elements.length ? elements[idx + 2] : null;
              const nextCloseText = nextCloseEl
                ? sanitizeSpecialCharsToUtf8(nextCloseEl.textContent || '').trim()
                : '';
              const trs = Array.from(nextEl.children).filter(
                (c) => c.tagName.toLowerCase() === 'mtr'
              );
              const eqArrRows = trs
                .map((tr) => {
                  const tds = Array.from(tr.children).filter(
                    (c) => c.tagName.toLowerCase() === 'mtd'
                  );
                  const rowInner = tds
                    .map((td) => convertNode(td))
                    .filter(Boolean)
                    .join(buildOmmlRun('   ', false, style));
                  return `<m:e>${rowInner || buildOmmlRun(' ', false, style)}</m:e>`;
                })
                .join('');

              results.push(
                `<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val="${
                  nextCloseText === '}' ? '}' : ''
                }"/></m:dPr><m:e><m:eqArr>${eqArrRows}</m:eqArr></m:e></m:d>`
              );
              idx += nextCloseEl && nextCloseText === '' ? 3 : 2;
              continue;
            }
          }

          // Trường hợp tích phân / tổng / tích (<mo>∫</mo> hoặc <msub>/<msubsup> chứa toán tử n-ary)
          if (NARY_OPERATORS_SET.has(opText) && idx + 1 < elements.length) {
            const bodyXml = convertNode(elements[idx + 1]);
            results.push(
              `<m:nary><m:naryPr><m:chr m:val="${escapeXmlText(
                opText
              )}"/><m:subHide m:val="1"/><m:supHide m:val="1"/></m:naryPr><m:sub/><m:sup/><m:e>${
                bodyXml || buildOmmlRun(' ', false, style)
              }</m:e></m:nary>`
            );
            idx += 2;
            continue;
          }

          void isFence;
        }

        // Trường hợp <msub>, <msup>, <msubsup>, <munder>, <mover>, <munderover> có cơ số là toán tử N-ary (∫, ∑, ∏, ∮)
        if (
          tag === 'msub' ||
          tag === 'msup' ||
          tag === 'msubsup' ||
          tag === 'munder' ||
          tag === 'mover' ||
          tag === 'munderover'
        ) {
          const ch = Array.from(el.children);
          const baseEl = ch[0];
          const baseText = baseEl
            ? sanitizeSpecialCharsToUtf8(baseEl.textContent || '').trim()
            : '';
          if (baseEl && NARY_OPERATORS_SET.has(baseText)) {
            let subXml = '';
            let supXml = '';
            if (tag === 'msub' || tag === 'munder') {
              subXml = ch[1] ? convertNode(ch[1]) : '';
            } else if (tag === 'msup' || tag === 'mover') {
              supXml = ch[1] ? convertNode(ch[1]) : '';
            } else {
              subXml = ch[1] ? convertNode(ch[1]) : '';
              supXml = ch[2] ? convertNode(ch[2]) : '';
            }
            const bodyNode = idx + 1 < elements.length ? elements[idx + 1] : null;
            const bodyXml = bodyNode ? convertNode(bodyNode) : '';
            results.push(
              `<m:nary><m:naryPr><m:chr m:val="${escapeXmlText(
                baseText
              )}"/><m:subHide m:val="${subXml ? '0' : '1'}"/><m:supHide m:val="${
                supXml ? '0' : '1'
              }"/></m:naryPr><m:sub>${subXml}</m:sub><m:sup>${supXml}</m:sup><m:e>${
                bodyXml || buildOmmlRun(' ', false, style)
              }</m:e></m:nary>`
            );
            idx += bodyNode ? 2 : 1;
            continue;
          }
        }

        results.push(convertNode(el));
        idx++;
      }

      return results.join('');
    };

    const convertNode = (node: Element): string => {
      const tag = node.tagName.toLowerCase();
      const children = Array.from(node.children);

      switch (tag) {
        case 'math':
        case 'mrow':
        case 'mstyle':
        case 'mpadded': {
          return convertChildrenList(children);
        }

        case 'semantics': {
          // Chỉ lấy phần tử trình bày đầu tiên (bỏ qua <annotation encoding="application/x-tex">)
          const presentationChildren = children.filter(
            (c) =>
              c.tagName.toLowerCase() !== 'annotation' &&
              c.tagName.toLowerCase() !== 'annotation-xml'
          );
          return convertChildrenList(presentationChildren);
        }

        case 'annotation':
        case 'annotation-xml':
        case 'mphantom':
          return '';

        case 'mi': {
          const text = sanitizeSpecialCharsToUtf8(node.textContent || '');
          if (!text) return '';
          const variant = (node.getAttribute('mathvariant') || '').toLowerCase();
          const isNormal =
            variant === 'normal' ||
            variant === 'bold' ||
            text.length > 1 ||
            /^[\u0391-\u03A9]$/.test(text); // Chữ Hy Lạp hoa (Δ, Ω, Σ...) để đứng thẳng chuẩn SGK Việt Nam
          return buildOmmlRun(text, !isNormal, {
            ...style,
            bold: style?.bold || variant.includes('bold'),
          });
        }

        case 'mn': {
          const text = sanitizeSpecialCharsToUtf8(node.textContent || '');
          return buildOmmlRun(text, false, style);
        }

        case 'mo': {
          const text = sanitizeSpecialCharsToUtf8(node.textContent || '');
          if (!text) return '';
          return buildOmmlRun(text, false, style);
        }

        case 'mtext': {
          const text = sanitizeSpecialCharsToUtf8(node.textContent || '');
          if (!text) return '';
          return buildOmmlRun(text, false, style);
        }

        case 'mspace': {
          return buildOmmlRun(' ', false, style);
        }

        case 'mfrac': {
          const numXml = children[0] ? convertNode(children[0]) : '';
          const denXml = children[1] ? convertNode(children[1]) : '';
          const lineThickness = node.getAttribute('linethickness');
          const noBar = lineThickness === '0' || lineThickness === '0pt' || lineThickness === '0px';
          return `<m:f><m:fPr>${
            noBar ? '<m:type m:val="noBar"/>' : '<m:type m:val="bar"/>'
          }</m:fPr><m:num>${numXml || buildOmmlRun(' ', false, style)}</m:num><m:den>${
            denXml || buildOmmlRun(' ', false, style)
          }</m:den></m:f>`;
        }

        case 'msqrt': {
          const innerXml = convertChildrenList(children);
          return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${
            innerXml || buildOmmlRun(' ', false, style)
          }</m:e></m:rad>`;
        }

        case 'mroot': {
          const baseXml = children[0] ? convertNode(children[0]) : '';
          const degXml = children[1] ? convertNode(children[1]) : '';
          return `<m:rad><m:radPr><m:degHide m:val="${
            degXml ? '0' : '1'
          }"/></m:radPr><m:deg>${degXml}</m:deg><m:e>${
            baseXml || buildOmmlRun(' ', false, style)
          }</m:e></m:rad>`;
        }

        case 'msub': {
          const baseXml = children[0] ? convertNode(children[0]) : '';
          const subXml = children[1] ? convertNode(children[1]) : '';
          return `<m:sSub><m:e>${baseXml || buildOmmlRun(' ', false, style)}</m:e><m:sub>${
            subXml || buildOmmlRun(' ', false, style)
          }</m:sub></m:sSub>`;
        }

        case 'msup': {
          const baseXml = children[0] ? convertNode(children[0]) : '';
          const supXml = children[1] ? convertNode(children[1]) : '';
          return `<m:sSup><m:e>${baseXml || buildOmmlRun(' ', false, style)}</m:e><m:sup>${
            supXml || buildOmmlRun(' ', false, style)
          }</m:sup></m:sSup>`;
        }

        case 'msubsup': {
          const baseXml = children[0] ? convertNode(children[0]) : '';
          const subXml = children[1] ? convertNode(children[1]) : '';
          const supXml = children[2] ? convertNode(children[2]) : '';
          return `<m:sSubSup><m:e>${baseXml || buildOmmlRun(' ', false, style)}</m:e><m:sub>${
            subXml || buildOmmlRun(' ', false, style)
          }</m:sub><m:sup>${supXml || buildOmmlRun(' ', false, style)}</m:sup></m:sSubSup>`;
        }

        case 'mover': {
          const baseEl = children[0];
          const overEl = children[1];
          const baseXml = baseEl ? convertNode(baseEl) : '';
          const overText = overEl
            ? sanitizeSpecialCharsToUtf8(overEl.textContent || '').trim()
            : '';
          const isAccentAttr =
            node.getAttribute('accent') === 'true' ||
            (overEl && overEl.tagName.toLowerCase() === 'mo' && overText.length <= 2);

          if (
            isAccentAttr &&
            /^[→⟶\u20D7⇀¯‾\u00AF\u0304\u0305⎯ˆ^\u0302\u02C6~˜\u0303˙\u0307¨\u0308˘\u0306⌢⌒]$/.test(
              overText
            )
          ) {
            const accInfo = normalizeAccentCharForOmml(overText);
            if (accInfo.type === 'bar') {
              return `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${baseXml}</m:e></m:bar>`;
            }
            return `<m:acc><m:accPr><m:chr m:val="${escapeXmlText(
              accInfo.chr
            )}"/></m:accPr><m:e>${baseXml}</m:e></m:acc>`;
          }

          const overXml = overEl ? convertNode(overEl) : '';
          return `<m:limUpp><m:e>${baseXml || buildOmmlRun(' ', false, style)}</m:e><m:lim>${
            overXml || buildOmmlRun(' ', false, style)
          }</m:lim></m:limUpp>`;
        }

        case 'munder': {
          const baseEl = children[0];
          const underEl = children[1];
          const baseXml = baseEl ? convertNode(baseEl) : '';
          const underText = underEl
            ? sanitizeSpecialCharsToUtf8(underEl.textContent || '').trim()
            : '';
          if (underText === '_' || underText === '‾' || underText === '¯') {
            return `<m:bar><m:barPr><m:pos m:val="bot"/></m:barPr><m:e>${baseXml}</m:e></m:bar>`;
          }
          const underXml = underEl ? convertNode(underEl) : '';
          return `<m:limLow><m:e>${baseXml || buildOmmlRun(' ', false, style)}</m:e><m:lim>${
            underXml || buildOmmlRun(' ', false, style)
          }</m:lim></m:limLow>`;
        }

        case 'munderover': {
          const baseEl = children[0];
          const underEl = children[1];
          const overEl = children[2];
          const baseText = baseEl
            ? sanitizeSpecialCharsToUtf8(baseEl.textContent || '').trim()
            : '';
          const subXml = underEl ? convertNode(underEl) : '';
          const supXml = overEl ? convertNode(overEl) : '';

          if (NARY_OPERATORS_SET.has(baseText)) {
            return `<m:nary><m:naryPr><m:chr m:val="${escapeXmlText(
              baseText
            )}"/><m:subHide m:val="${subXml ? '0' : '1'}"/><m:supHide m:val="${
              supXml ? '0' : '1'
            }"/></m:naryPr><m:sub>${subXml}</m:sub><m:sup>${supXml}</m:sup><m:e>${buildOmmlRun(
              ' ',
              false,
              style
            )}</m:e></m:nary>`;
          }

          const baseXml = baseEl ? convertNode(baseEl) : '';
          const limUpp = `<m:limUpp><m:e>${
            baseXml || buildOmmlRun(' ', false, style)
          }</m:e><m:lim>${supXml}</m:lim></m:limUpp>`;
          return `<m:limLow><m:e>${limUpp}</m:e><m:lim>${subXml}</m:lim></m:limLow>`;
        }

        case 'mfenced': {
          const openChr = node.getAttribute('open') ?? '(';
          const closeChr = node.getAttribute('close') ?? ')';
          const sepChr = node.getAttribute('separators') ?? ',';
          const innerParts = children.map((c) => convertNode(c)).filter(Boolean);
          const joined = innerParts.join(
            sepChr ? buildOmmlRun(sepChr, false, style) : ''
          );
          return `<m:d><m:dPr><m:begChr m:val="${escapeXmlText(
            openChr
          )}"/><m:endChr m:val="${escapeXmlText(closeChr)}"/></m:dPr><m:e>${
            joined || buildOmmlRun(' ', false, style)
          }</m:e></m:d>`;
        }

        case 'mtable': {
          const trs = children.filter((c) => c.tagName.toLowerCase() === 'mtr');
          const matrixRows = trs
            .map((tr) => {
              const tds = Array.from(tr.children).filter(
                (c) => c.tagName.toLowerCase() === 'mtd'
              );
              return `<m:mr>${tds
                .map(
                  (td) =>
                    `<m:e>${convertNode(td) || buildOmmlRun(' ', false, style)}</m:e>`
                )
                .join('')}</m:mr>`;
            })
            .join('');
          return `<m:m>${matrixRows}</m:m>`;
        }

        case 'mtr':
        case 'mtd': {
          return convertChildrenList(children);
        }

        case 'menclose': {
          const notation = (node.getAttribute('notation') || '').toLowerCase();
          const innerXml = convertChildrenList(children);
          if (notation.includes('top')) {
            return `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${innerXml}</m:e></m:bar>`;
          }
          if (notation.includes('bottom')) {
            return `<m:bar><m:barPr><m:pos m:val="bot"/></m:barPr><m:e>${innerXml}</m:e></m:bar>`;
          }
          return `<m:borderBox><m:e>${innerXml}</m:e></m:borderBox>`;
        }

        default: {
          if (children.length > 0) {
            return convertChildrenList(children);
          }
          const raw = sanitizeSpecialCharsToUtf8(node.textContent || '');
          return raw ? buildOmmlRun(raw, false, style) : '';
        }
      }
    };

    return convertNode(mathEl);
  } catch {
    return '';
  }
}

/**
 * Bộ chuyển đổi trực tiếp LaTeX -> OMML dự phòng (sử dụng khi môi trường không có DOMParser hoặc biểu thức tùy chỉnh)
 * Đảm bảo 100% dùng font Cambria Math và mã dấu chuẩn Unicode (U+20D7 cho véc-tơ, <m:bar> cho gạch ngang trên đầu).
 */
export function convertLatexExpressionToOmmlInnerXml(
  latexRaw: string,
  style?: WordRunStyleOptions
): string {
  const expr = sanitizeSpecialCharsToUtf8(latexRaw || '')
    .trim()
    .replace(/^\$+|\$+$/g, '')
    .trim();
  if (!expr) return '';

  let i = 0;
  const nodes: string[] = [];

  const parseAtomAt = (pos: number): { omml: string; nextPos: number } => {
    let p = pos;
    while (p < expr.length && /\s/.test(expr[p])) p++;
    if (p >= expr.length) return { omml: '', nextPos: p };

    if (expr[p] === '{') {
      const grp = readBalancedBraces(expr, p, '{', '}');
      if (grp) {
        return {
          omml: convertLatexExpressionToOmmlInnerXml(grp.content, style),
          nextPos: grp.nextIdx,
        };
      }
    }

    if (expr[p] === '\\') {
      const cmdMatch = expr.slice(p).match(/^\\([a-zA-Z]+)/);
      if (cmdMatch) {
        const fullCmd = cmdMatch[0];
        const mapped = LATEX_SYMBOL_MAP[fullCmd];
        if (mapped) {
          return {
            omml: buildOmmlRun(mapped, false, style),
            nextPos: p + fullCmd.length,
          };
        }
      }
    }

    return {
      omml: buildOmmlRun(expr[p], /[a-zA-Z]/.test(expr[p]), style),
      nextPos: p + 1,
    };
  };

  while (i < expr.length) {
    if (/\s/.test(expr[i])) {
      i++;
      continue;
    }

    // 1. Môi trường hệ phương trình \begin{cases} ... \end{cases} hoặc ma trận \begin{pmatrix/bmatrix/matrix}
    const envMatch = expr
      .slice(i)
      .match(/^\\begin\{(cases|matrix|pmatrix|bmatrix|vmatrix)\}([\s\S]*?)\\end\{\1\}/);
    if (envMatch) {
      const envType = envMatch[1];
      const body = envMatch[2].trim();
      const rows = body
        .split(/\\\\/)
        .map((r) => r.trim())
        .filter(Boolean);

      if (envType === 'cases') {
        const eqRowsXml = rows
          .map(
            (r) =>
              `<m:e>${convertLatexExpressionToOmmlInnerXml(
                r.replace(/&/g, '  '),
                style
              )}</m:e>`
          )
          .join('');
        nodes.push(
          `<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr><m:e><m:eqArr>${eqRowsXml}</m:eqArr></m:e></m:d>`
        );
      } else {
        const begChr =
          envType === 'pmatrix'
            ? '('
            : envType === 'bmatrix'
            ? '['
            : envType === 'vmatrix'
            ? '|'
            : '';
        const endChr =
          envType === 'pmatrix'
            ? ')'
            : envType === 'bmatrix'
            ? ']'
            : envType === 'vmatrix'
            ? '|'
            : '';
        const matrixRowsXml = rows
          .map((r) => {
            const cells = r.split('&').map((c) => c.trim());
            return `<m:mr>${cells
              .map((c) => `<m:e>${convertLatexExpressionToOmmlInnerXml(c, style)}</m:e>`)
              .join('')}</m:mr>`;
          })
          .join('');
        const matrixXml = `<m:m>${matrixRowsXml}</m:m>`;
        nodes.push(
          begChr
            ? `<m:d><m:dPr><m:begChr m:val="${begChr}"/><m:endChr m:val="${endChr}"/></m:dPr><m:e>${matrixXml}</m:e></m:d>`
            : matrixXml
        );
      }
      i += envMatch[0].length;
      continue;
    }

    // 2. Phân số \frac{tử}{mẫu} hoặc \dfrac{tử}{mẫu}
    const fracMatch = expr.slice(i).match(/^\\(?:d|t)?frac\b/);
    if (fracMatch) {
      const afterCmd = i + fracMatch[0].length;
      const numGrp = readBalancedBraces(expr, afterCmd, '{', '}');
      if (numGrp) {
        const denGrp = readBalancedBraces(expr, numGrp.nextIdx, '{', '}');
        if (denGrp) {
          nodes.push(
            `<m:f><m:fPr><m:type m:val="bar"/></m:fPr><m:num>${convertLatexExpressionToOmmlInnerXml(
              numGrp.content,
              style
            )}</m:num><m:den>${convertLatexExpressionToOmmlInnerXml(
              denGrp.content,
              style
            )}</m:den></m:f>`
          );
          i = denGrp.nextIdx;
          continue;
        }
      }
    }

    // 3. Căn thức \sqrt[n]{x} hoặc \sqrt{x}
    const sqrtMatch = expr.slice(i).match(/^\\sqrt\b/);
    if (sqrtMatch) {
      let cursor = i + sqrtMatch[0].length;
      const degGrp = readBalancedBraces(expr, cursor, '[', ']');
      if (degGrp) {
        cursor = degGrp.nextIdx;
      }
      const radGrp = readBalancedBraces(expr, cursor, '{', '}');
      if (radGrp) {
        if (degGrp && degGrp.content.trim()) {
          nodes.push(
            `<m:rad><m:radPr><m:degHide m:val="0"/></m:radPr><m:deg>${convertLatexExpressionToOmmlInnerXml(
              degGrp.content,
              style
            )}</m:deg><m:e>${convertLatexExpressionToOmmlInnerXml(
              radGrp.content,
              style
            )}</m:e></m:rad>`
          );
        } else {
          nodes.push(
            `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${convertLatexExpressionToOmmlInnerXml(
              radGrp.content,
              style
            )}</m:e></m:rad>`
          );
        }
        i = radGrp.nextIdx;
        continue;
      }
    }

    // 4. Véc-tơ \vec{E}, \overrightarrow{AB}, \overline{X}, \hat{A}
    const accMatch = expr
      .slice(i)
      .match(/^\\(vec|overrightarrow|overline|bar|hat|widehat)\b/);
    if (accMatch) {
      const kind = accMatch[1];
      const cursor = i + accMatch[0].length;
      const grp = readBalancedBraces(expr, cursor, '{', '}');
      if (grp) {
        const innerXml = convertLatexExpressionToOmmlInnerXml(grp.content, style);
        if (kind === 'overline' || kind === 'bar') {
          nodes.push(
            `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${innerXml}</m:e></m:bar>`
          );
        } else {
          const chr = kind === 'hat' || kind === 'widehat' ? '\u0302' : '\u20D7';
          nodes.push(
            `<m:acc><m:accPr><m:chr m:val="${chr}"/></m:accPr><m:e>${innerXml}</m:e></m:acc>`
          );
        }
        i = grp.nextIdx;
        continue;
      }
    }

    // 5. Mũi tên phản ứng hóa học kèm điều kiện trên/dưới: \xrightarrow[dưới]{trên} hoặc \xrightleftharpoons{trên}
    const xArrowMatch = expr
      .slice(i)
      .match(/^\\(xrightarrow|xrightleftharpoons|xleftarrow)\b/);
    if (xArrowMatch) {
      const arrowType = xArrowMatch[1];
      const arrowChar =
        arrowType === 'xrightleftharpoons'
          ? '⇌'
          : arrowType === 'xleftarrow'
          ? '←'
          : '→';
      let cursor = i + xArrowMatch[0].length;
      const belowGrp = readBalancedBraces(expr, cursor, '[', ']');
      if (belowGrp) cursor = belowGrp.nextIdx;
      const aboveGrp = readBalancedBraces(expr, cursor, '{', '}');
      if (aboveGrp) {
        cursor = aboveGrp.nextIdx;
        let arrowOmml = `<m:limUpp><m:e>${buildOmmlRun(
          ` ${arrowChar} `,
          false,
          style
        )}</m:e><m:lim>${convertLatexExpressionToOmmlInnerXml(
          aboveGrp.content,
          style
        )}</m:lim></m:limUpp>`;
        if (belowGrp && belowGrp.content.trim()) {
          arrowOmml = `<m:limLow><m:e>${arrowOmml}</m:e><m:lim>${convertLatexExpressionToOmmlInnerXml(
            belowGrp.content,
            style
          )}</m:lim></m:limLow>`;
        }
        nodes.push(arrowOmml);
        i = cursor;
        continue;
      }
    }

    // 6. Tích phân \int, Tổng \sum, Tích \prod kèm cận dưới _ và cận trên ^
    const naryMatch = expr.slice(i).match(/^\\(int|oint|sum|prod)\b/);
    if (naryMatch) {
      const kind = naryMatch[1];
      const chr =
        kind === 'sum' ? '∑' : kind === 'prod' ? '∏' : kind === 'oint' ? '∮' : '∫';
      let cursor = i + naryMatch[0].length;
      let subOmml = '';
      let supOmml = '';

      for (let pass = 0; pass < 2; pass++) {
        while (cursor < expr.length && /\s/.test(expr[cursor])) cursor++;
        if (expr[cursor] === '_') {
          const parsedSub = parseAtomAt(cursor + 1);
          subOmml = parsedSub.omml;
          cursor = parsedSub.nextPos;
        } else if (expr[cursor] === '^') {
          const parsedSup = parseAtomAt(cursor + 1);
          supOmml = parsedSup.omml;
          cursor = parsedSup.nextPos;
        }
      }

      const bodyAtom = parseAtomAt(cursor);
      nodes.push(
        `<m:nary><m:naryPr><m:chr m:val="${chr}"/><m:subHide m:val="${
          subOmml ? '0' : '1'
        }"/><m:supHide m:val="${
          supOmml ? '0' : '1'
        }"/></m:naryPr><m:sub>${subOmml}</m:sub><m:sup>${supOmml}</m:sup><m:e>${
          bodyAtom.omml || buildOmmlRun(' ', false, style)
        }</m:e></m:nary>`
      );
      i = bodyAtom.nextPos;
      continue;
    }

    // 7. Giới hạn \lim_{x \to x_0}
    const limMatch = expr.slice(i).match(/^\\lim\b/);
    if (limMatch) {
      let cursor = i + limMatch[0].length;
      while (cursor < expr.length && /\s/.test(expr[cursor])) cursor++;
      if (expr[cursor] === '_') {
        const subAtom = parseAtomAt(cursor + 1);
        nodes.push(
          `<m:limLow><m:e>${buildOmmlRun('lim', false, style)}</m:e><m:lim>${
            subAtom.omml
          }</m:lim></m:limLow>`
        );
        i = subAtom.nextPos;
        continue;
      }
      nodes.push(buildOmmlRun('lim', false, style));
      i = cursor;
      continue;
    }

    // 8. Nhóm ngoặc nhọn { ... } độc lập
    if (expr[i] === '{') {
      const grp = readBalancedBraces(expr, i, '{', '}');
      if (grp) {
        nodes.push(convertLatexExpressionToOmmlInnerXml(grp.content, style));
        i = grp.nextIdx;
        continue;
      }
    }

    // 9. Lệnh \text{...} hoặc \mathrm{...}
    const textCmdMatch = expr.slice(i).match(/^\\(?:text|mathrm|mathbf)\b/);
    if (textCmdMatch) {
      const grp = readBalancedBraces(expr, i + textCmdMatch[0].length, '{', '}');
      if (grp) {
        nodes.push(buildOmmlRun(grp.content, false, style));
        i = grp.nextIdx;
        continue;
      }
    }

    // 10. Lệnh ký hiệu LaTeX (\alpha, \Omega, \rightarrow...) hoặc hàm toán học (\sin, \cos, \tan, \ln, \log)
    if (expr[i] === '\\') {
      const fnMatch = expr
        .slice(i)
        .match(/^\\(sin|cos|tan|cot|arcsin|arccos|arctan|ln|log|exp|max|min|det)\b/);
      if (fnMatch) {
        nodes.push(buildOmmlRun(fnMatch[1], false, style));
        i += fnMatch[0].length;
        continue;
      }
      const bbMatch = expr.slice(i).match(/^\\mathbb\{([A-Z])\}/);
      if (bbMatch) {
        const sym = LATEX_SYMBOL_MAP[bbMatch[0]] || bbMatch[1];
        nodes.push(buildOmmlRun(sym, false, style));
        i += bbMatch[0].length;
        continue;
      }
      const leftRightMatch = expr.slice(i).match(/^\\(left|right)\s*([()[\]|.]|\\\{|\\\}|\\\||\\langle|\\rangle)/);
      if (leftRightMatch) {
        const rawDelim = leftRightMatch[2];
        const delim =
          rawDelim === '.'
            ? ''
            : rawDelim === '\\{'
            ? '{'
            : rawDelim === '\\}'
            ? '}'
            : rawDelim === '\\|'
            ? '‖'
            : rawDelim === '\\langle'
            ? '⟨'
            : rawDelim === '\\rangle'
            ? '⟩'
            : rawDelim;
        if (delim) {
          nodes.push(buildOmmlRun(delim, false, style));
        }
        i += leftRightMatch[0].length;
        continue;
      }
      const symMatch = expr.slice(i).match(/^\\[a-zA-Z]+/);
      if (symMatch) {
        const sym = LATEX_SYMBOL_MAP[symMatch[0]];
        if (sym) {
          nodes.push(buildOmmlRun(sym, false, style));
        } else {
          nodes.push(buildOmmlRun(symMatch[0].slice(1), true, style));
        }
        i += symMatch[0].length;
        continue;
      }
      if (i + 1 < expr.length) {
        nodes.push(buildOmmlRun(expr[i + 1], false, style));
        i += 2;
        continue;
      }
    }

    // 11. Xử lý chỉ số dưới (_) và chỉ số trên (^) gắn vào phần tử đứng ngay trước
    if ((expr[i] === '_' || expr[i] === '^') && nodes.length > 0) {
      const baseOmml = nodes.pop()!;
      let subOmml = '';
      let supOmml = '';
      let cursor = i;

      for (let pass = 0; pass < 2; pass++) {
        if (cursor < expr.length && expr[cursor] === '_') {
          const parsedSub = parseAtomAt(cursor + 1);
          subOmml = parsedSub.omml;
          cursor = parsedSub.nextPos;
        } else if (cursor < expr.length && expr[cursor] === '^') {
          const parsedSup = parseAtomAt(cursor + 1);
          supOmml = parsedSup.omml;
          cursor = parsedSup.nextPos;
        }
      }

      if (subOmml && supOmml) {
        nodes.push(
          `<m:sSubSup><m:e>${baseOmml}</m:e><m:sub>${subOmml}</m:sub><m:sup>${supOmml}</m:sup></m:sSubSup>`
        );
      } else if (subOmml) {
        nodes.push(`<m:sSub><m:e>${baseOmml}</m:e><m:sub>${subOmml}</m:sub></m:sSub>`);
      } else if (supOmml) {
        nodes.push(`<m:sSup><m:e>${baseOmml}</m:e><m:sup>${supOmml}</m:sup></m:sSup>`);
      } else {
        nodes.push(baseOmml);
      }
      i = cursor;
      continue;
    }

    // 12. Chuỗi ký tự thường hoặc con số liên tiếp
    let token = '';
    while (i < expr.length && !/[\s\\{}^_]/.test(expr[i])) {
      if (
        token.length > 0 &&
        i + 1 < expr.length &&
        (expr[i + 1] === '_' || expr[i + 1] === '^')
      ) {
        break;
      }
      token += expr[i];
      i++;
      if (i < expr.length && (expr[i] === '_' || expr[i] === '^')) {
        break;
      }
    }

    if (token) {
      const isPureNumberOrOp = /^[0-9.,+\-=*/()[\]<>→⇌±×÷°'":;|♂♀]+$/.test(token);
      nodes.push(buildOmmlRun(token, !isPureNumberOrOp, style));
    } else {
      i++;
    }
  }

  return nodes.join('');
}

/**
 * BƯỚC 3: Đóng gói biểu thức LaTeX thành thẻ <m:oMath>...</m:oMath> chuẩn Microsoft Office
 * Quy trình chuẩn:
 *   LaTeX -> MathML (KaTeX) -> XML OMML (mml2omml) -> <m:oMath>...</m:oMath>
 * Nếu có cấu trúc đặc thù như \xrightarrow[dưới]{trên} hoặc khi cần fallback, kết hợp bộ chuyển đổi OMML trực tiếp.
 */
export function buildOmmlElementFromLatex(
  latexRaw: string,
  style?: WordRunStyleOptions
): string {
  const cleanedLatex = sanitizeSpecialCharsToUtf8(latexRaw || '').trim();
  if (!cleanedLatex) return '';

  // Ưu tiên 1: Chuyển LaTeX -> MathML bằng KaTeX, sau đó mml2omml -> OMML
  const hasCustomReactionArrow = /\\(xrightarrow|xrightleftharpoons|xleftarrow)\b/.test(
    cleanedLatex
  );
  let innerOmml = '';

  if (!hasCustomReactionArrow) {
    const mathml = convertLatexToMathMl(cleanedLatex);
    if (mathml) {
      innerOmml = convertMathMlToOmmlInnerXml(mathml, style);
    }
  }

  // Ưu tiên 2 (Fallback): Chuyển trực tiếp LaTeX -> OMML
  if (!innerOmml) {
    innerOmml = convertLatexExpressionToOmmlInnerXml(cleanedLatex, style);
  }

  if (!innerOmml) return '';
  return `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${innerOmml}</m:oMath>`;
}

/**
 * Kiểm tra ký tự có phải là ký hiệu Toán - Lý - Hóa - Sinh đặc biệt cần ép font Cambria Math
 * để tránh bị ô vuông (□) khi hiển thị ngoài vùng <m:oMath>
 */
const SPECIAL_MATH_UNICODE_REGEX =
  /([\u0370-\u03FF\u2100-\u2BFF\u2640\u2642±×÷°‰′″‴∞√∛∜∫∬∭∮∑∏∂∇∆∈∉⊂⊃⊆⊇⊄⊅∪∩∅∀∃¬∧∨⇒⇔⇐↦↔↑↓⇌≈≡≠≤≥≪≫∝⊥∥∠∡∢△□◊⊙⊕⊗⋆ℏℓℝℕℤℚℂ]+)/g;

function buildSingleWordTextRunXml(text: string, style: WordRunStyleOptions): string {
  const cleanText = sanitizeSpecialCharsToUtf8(text);
  if (!cleanText) return '';
  const sz = style.fontSizeHalfPt || 24;

  // Tách riêng các cụm ký hiệu toán học/khoa học đặc biệt để gắn font Cambria Math, giúp Word không bao giờ hiển thị ô vuông □
  const parts = cleanText.split(SPECIAL_MATH_UNICODE_REGEX);
  const runs: string[] = [];

  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];
    if (!part) continue;
    const isMathSymbolChunk = idx % 2 === 1;
    const fontName = isMathSymbolChunk
      ? 'Cambria Math'
      : style.fontFamily || 'Times New Roman';

    runs.push(`<w:r>
    <w:rPr>
      <w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:eastAsia="${fontName}" w:cs="${fontName}"/>
      ${style.bold ? '<w:b/><w:bCs/>' : ''}
      ${style.italic && !isMathSymbolChunk ? '<w:i/><w:iCs/>' : ''}
      ${style.underline ? '<w:u w:val="single"/>' : ''}
      ${style.colorHex ? `<w:color w:val="${style.colorHex}"/>` : ''}
      ${style.vertAlign ? `<w:vertAlign w:val="${style.vertAlign}"/>` : ''}
      <w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>
    </w:rPr>
    <w:t xml:space="preserve">${escapeXmlText(part)}</w:t>
  </w:r>`);
  }

  return runs.join('\n');
}

/**
 * Phân tích một đoạn văn bản thông thường có chứa:
 * - Chỉ số hóa học / vật lý viết dạng H_2SO_4, Fe^{3+}, SO_4^{2-}, x_1, 10^{-6}
 * - Công thức hóa học phổ biến viết liền (VD: H2SO4, HNO3, Al2(SO4)3, Ca(OH)2, Fe3O4, CH3COOH, C6H12O6, SO4^2-, Fe^3+, CO2, H2O, O2, N2...)
 * - Ký tự chỉ số trên/dưới Unicode (₀₁₂₃₄₅₆₇₈₉, ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻)
 * - Mũi tên phản ứng một chiều (→), hai chiều (⇌)
 * và xuất ra các <m:oMath> hoặc <w:r> chuẩn Microsoft Word!
 */
function buildChemicalAndSubSupRunsXml(
  text: string,
  baseStyle: WordRunStyleOptions
): string {
  if (!text) return '';

  // Bước 1: Chuẩn hóa các ký hiệu mũi tên và các công thức hóa học phổ biến sang dạng tường minh _{...} và ^{...}
  let normalized = replaceLatexSymbolsWithUnicode(sanitizeSpecialCharsToUtf8(text));

  // Chuyển các chuỗi Unicode subscript (₀-₉) và superscript (⁰-⁹⁺⁻) sang _{...} và ^{...}
  normalized = normalized.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₕₖₗₘₙₚₛₜ]+/g, (match) => {
    const mapped = match
      .split('')
      .map((ch) => UNICODE_SUB_TO_NORMAL[ch] || ch)
      .join('');
    return `_{${mapped}}`;
  });

  normalized = normalized.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]+/g, (match) => {
    const mapped = match
      .split('')
      .map((ch) => UNICODE_SUP_TO_NORMAL[ch] || ch)
      .join('');
    return `^{${mapped}}`;
  });

  // Tự động nhận diện công thức phân tử Hóa học chuẩn (H2O, H2SO4, Fe(NO3)3, Al2(SO4)3, Fe2O3, C6H12O6, CH3COOH, KMnO4, Na2CO3...)
  const chemFormulaRegex =
    /\b((?:(?:H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Sc|Ti|V|Cr|Mn|Fe|Co|Ni|Cu|Zn|Ga|Ge|As|Se|Br|Kr|Rb|Sr|Y|Zr|Nb|Mo|Tc|Ru|Rh|Pd|Ag|Cd|In|Sn|Sb|Te|I|Xe|Cs|Ba|La|Ce|Pt|Au|Hg|Pb|Bi|Po|Rn|Fr|Ra|Ac|Th|Pa|U|\([A-Za-z0-9]+\))\d*){2,})(?![a-zA-Z0-9_])/g;

  normalized = normalized.replace(chemFormulaRegex, (fullMatch) => {
    if (!/\d/.test(fullMatch)) return fullMatch;
    if (/^(?:[A-Z]\d+|\d+[A-Z])$/.test(fullMatch)) return fullMatch;
    return fullMatch.replace(/([A-Za-z)])(\d+)/g, '$1_{$2}');
  });

  // Nhận diện các phân tử đơn nguyên tố và hợp chất phổ biến: O2, N2, H2, Cl2, Br2, I2, O3, P4, S8, SO4, NO3, CO3, PO4, NH4
  normalized = normalized.replace(
    /\b(O2|O3|N2|H2|Cl2|Br2|I2|F2|P4|S8|CH4|NH3|PH3|H2S|SO2|SO3|SO4|NO2|NO3|N2O|N2O4|N2O5|CO2|CO3|CS2|SiO2|P2O5|PO4|NH4|HCO3|HSO4|HSO3|HS|Al2O3|FeO|Fe2O3|Fe3O4|CuO|ZnO|MgO|CaO|BaO|Na2O|K2O|Ag2O|Cr2O3|CrO3|Cr2O7|CrO4|MnO2|MnO4)\b/g,
    (m) => m.replace(/([A-Za-z])(\d+)/g, '$1_{$2}')
  );

  // Nhận diện tất cả ion hóa học viết kèm dấu ^ (VD: SO4^2-, SO_{4}^2-, Al^3+, Fe^2+, Fe^3+, Cu^2+, CO3^2-, PO4^3-, NH4^+, NO3^-, OH^-)
  normalized = normalized.replace(
    /([A-Za-z0-9_(){}]+)\^\{?([0-9]*[+-])\}?(?![a-zA-Z0-9])/g,
    (_, base, charge) => `${base}^{${charge}}`
  );

  // Nhận diện các ion viết tắt phổ biến không dùng dấu ^ (VD: OH-, NO3-, NH4+, HCO3-, HSO4-, CH3COO-, Cl-, Na+, K+, Ag+, H+)
  normalized = normalized.replace(
    /\b(OH|NO_\{3\}|NO3|HCO_\{3\}|HCO3|HSO_\{4\}|HSO4|CH_\{3\}COO|CH3COO|Cl|Br)\-(?=\s|[,.;:)\]}]|$)/g,
    (_, base) => `${base.replace(/([A-Za-z])(\d+)/g, '$1_{$2}')}^{-}`
  );
  normalized = normalized.replace(
    /\b(NH_\{4\}|NH4|Na|K|Ag|H|Li)\+(?=\s|[,.;:)\]}]|$)/g,
    (_, base) => `${base.replace(/([A-Za-z])(\d+)/g, '$1_{$2}')}^{+}`
  );

  // Bước 2: Tách chuỗi theo các token _{...}, _x, ^{...}, ^x
  const tokenRegex = /(_\{([^{}]+)\}|_([0-9a-zA-Z+-])|\^\{([^{}]+)\}|\^([0-9+-]+))/g;
  const runsXml: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      runsXml.push(
        buildSingleWordTextRunXml(normalized.slice(lastIndex, match.index), baseStyle)
      );
    }
    const subContent = match[2] ?? match[3];
    const supContent = match[4] ?? match[5];

    if (subContent !== undefined) {
      runsXml.push(
        buildSingleWordTextRunXml(subContent, {
          ...baseStyle,
          vertAlign: 'subscript',
        })
      );
    } else if (supContent !== undefined) {
      runsXml.push(
        buildSingleWordTextRunXml(supContent, {
          ...baseStyle,
          vertAlign: 'superscript',
        })
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < normalized.length) {
    runsXml.push(buildSingleWordTextRunXml(normalized.slice(lastIndex), baseStyle));
  }

  return runsXml.join('\n');
}

/**
 * Chuyển đổi văn bản khoa học hỗn hợp (chứa cả công thức LaTeX $...$, lệnh \frac, \sqrt, \int, \lim, \vec, \xrightarrow
 * và các công thức Hóa học H2SO4, Fe(NO3)3, Fe^{3+}, SO4^{2-}, kiểu gen Sinh học AB/ab, X^A X^a)
 * sang chuỗi XML gồm các <w:r> và <m:oMath>...</m:oMath> nhúng trực tiếp vào <w:p> của file .docx!
 */
/**
 * Chuẩn hóa một chuỗi LaTeX để đối chiếu "cùng một công thức" giữa bản lưu khi
 * đọc file (formulaLatex) và đoạn $...$ tìm thấy trong stem lúc xuất bản:
 * thống nhất dấu trừ Unicode U+2212 về '-', gộp khoảng trắng thừa.
 */
export function normalizeLatexForOmmlMatch(latex: string): string {
  return (latex || '')
    .replace(/−/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Đưa khối OMML gốc (đã serialize từ file Word khi đọc) về dạng dùng được bên
 * trong một đoạn văn khi xuất: bỏ khai báo XML, nếu là <m:oMathPara> thì gỡ
 * wrapper và chỉ giữ (các) khối <m:oMath> bên trong.
 */
export function unwrapRawOmmlXmlForInlineUse(rawOmmlXml: string): string {
  if (!rawOmmlXml) return '';
  const cleaned = rawOmmlXml.replace(/<\?xml[^>]*\?>/g, '').trim();
  if (/<(?:\w+:)?oMathPara\b/i.test(cleaned)) {
    const blocks = cleaned.match(
      /<(?:\w+:)?oMath\b[^>]*>[\s\S]*?<\/(?:\w+:)?oMath\s*>/gi
    );
    return blocks ? blocks.join('') : '';
  }
  return cleaned;
}

