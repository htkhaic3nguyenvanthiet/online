/**
 * OMML → LaTeX converter + plain-text lineariser.
 *
 * Ported and adapted from the teacher's EduMix project
 * (~/workspace/projects/tronde/src/utils/docxParser.ts, function ommlToLatex),
 * which is battle-tested on Vietnamese school exams. Adaptations vs. the
 * original: single-backslash LaTeX output, numeric DOM nodeType checks (works
 * with both the browser DOM and @xmldom in the Node test harness), escaping of
 * KaTeX comment/control characters inside math text, and an added plain-text
 * lineariser used for search/previews/fallbacks.
 *
 * HARD RULE (learned from EduMix's failure mode): this module NEVER invents
 * content. Anything it cannot convert yields an empty string, and the caller
 * (docxPreprocess / wordExamParser) surfaces a visible "unreadable formula"
 * marker plus a warning instead of a fabricated formula.
 */

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function localTag(node: any): string {
  if (!node) return '';
  const name = node.localName || (typeof node.tagName === 'string' ? node.tagName.split(':').pop() : '') || '';
  return String(name).toLowerCase();
}

function directChild(parent: any, localName: string): any | null {
  if (!parent || !parent.childNodes) return null;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const ch = parent.childNodes[i];
    if (ch && ch.nodeType === ELEMENT_NODE && localTag(ch) === localName.toLowerCase()) {
      return ch;
    }
  }
  // Fallback via namespaced lookup when available (browser DOM)
  try {
    const found = parent.getElementsByTagName?.(`m:${localName}`)?.[0];
    if (found) return found;
  } catch {
    // ignore
  }
  return null;
}

function directChildren(parent: any, localName: string): any[] {
  const out: any[] = [];
  if (!parent || !parent.childNodes) return out;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const ch = parent.childNodes[i];
    if (ch && ch.nodeType === ELEMENT_NODE && localTag(ch) === localName.toLowerCase()) {
      out.push(ch);
    }
  }
  return out;
}

function attrVal(el: any): string {
  if (!el) return '';
  try {
    return (el.getAttribute('m:val') ?? el.getAttribute('val') ?? el.getAttribute('w:val') ?? '') || '';
  } catch {
    return '';
  }
}

/** Escape characters that KaTeX would treat as control/comment inside m:t text. */
function escapeMathText(text: string): string {
  return text.replace(/([%#&])/g, '\\$1');
}

// ---------------------------------------------------------------------------
// OMML → LaTeX
// ---------------------------------------------------------------------------

export function ommlToLatex(mathNode: any): string {
  function walk(node: any): string {
    if (!node) return '';
    if (node.nodeType === TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== ELEMENT_NODE) return '';

    const tag = localTag(node);

    switch (tag) {
      case 't':
        return escapeMathText(node.textContent || '');
      case 'f': {
        const numText = walk(directChild(node, 'num')).trim();
        const denText = walk(directChild(node, 'den')).trim();
        return `\\frac{${numText}}{${denText}}`;
      }
      case 'ssup': {
        const eText = walk(directChild(node, 'e')).trim();
        const supText = walk(directChild(node, 'sup')).trim();
        return `{${eText}}^{${supText}}`;
      }
      case 'ssub': {
        const eText = walk(directChild(node, 'e')).trim();
        const subText = walk(directChild(node, 'sub')).trim();
        return `{${eText}}_{${subText}}`;
      }
      case 'ssubsup': {
        const eText = walk(directChild(node, 'e')).trim();
        const subText = walk(directChild(node, 'sub')).trim();
        const supText = walk(directChild(node, 'sup')).trim();
        return `{${eText}}_{${subText}}^{${supText}}`;
      }
      case 'spre': {
        const subText = walk(directChild(node, 'sub')).trim();
        const supText = walk(directChild(node, 'sup')).trim();
        const eText = walk(directChild(node, 'e')).trim();
        return `{}_{${subText}}^{${supText}}{${eText}}`;
      }
      case 'rad': {
        const degText = walk(directChild(node, 'deg')).trim();
        const eText = walk(directChild(node, 'e')).trim();
        return degText ? `\\sqrt[${degText}]{${eText}}` : `\\sqrt{${eText}}`;
      }
      case 'nary': {
        const naryPr = directChild(node, 'naryPr');
        const chrNode = naryPr ? directChild(naryPr, 'chr') : null;
        const chrVal = chrNode ? attrVal(chrNode) || '∫' : '∫';
        const subText = walk(directChild(node, 'sub')).trim();
        const supText = walk(directChild(node, 'sup')).trim();
        const eText = walk(directChild(node, 'e')).trim();
        const opCmd =
          chrVal === '∑' ? '\\sum'
          : chrVal === '∏' ? '\\prod'
          : chrVal === '∮' ? '\\oint'
          : chrVal === '∐' ? '\\coprod'
          : '\\int';
        const subPart = subText ? `_{${subText}}` : '';
        const supPart = supText ? `^{${supText}}` : '';
        return eText ? `${opCmd}${subPart}${supPart} ${eText}` : `${opCmd}${subPart}${supPart}`;
      }
      case 'limlow': {
        const eText = walk(directChild(node, 'e')).trim();
        const limText = walk(directChild(node, 'lim')).trim();
        if (/^lim$/i.test(eText)) return `\\lim_{${limText}}`;
        return `{${eText}}_{${limText}}`;
      }
      case 'limupp': {
        const eText = walk(directChild(node, 'e')).trim();
        const limText = walk(directChild(node, 'lim')).trim();
        if (eText.includes('⇌')) return `\\xrightleftharpoons[${limText}]{}`;
        if (eText.includes('→')) return `\\xrightarrow{${limText}}`;
        return `{${eText}}^{${limText}}`;
      }
      case 'acc': {
        const accPr = directChild(node, 'accPr');
        const chrNode = accPr ? directChild(accPr, 'chr') : null;
        const chrVal = chrNode ? attrVal(chrNode) || '→' : '→';
        const eText = walk(directChild(node, 'e')).trim();
        if (chrVal === '¯' || chrVal === '̅' || chrVal === '_') return `\\overline{${eText}}`;
        if (chrVal === 'ˆ' || chrVal === '̂' || chrVal === '^') {
          return eText.length > 1 ? `\\widehat{${eText}}` : `\\hat{${eText}}`;
        }
        if (chrVal === '̃' || chrVal === '~') return `\\tilde{${eText}}`;
        if (chrVal === '⃗' || chrVal === '→') {
          return eText.length > 1 ? `\\overrightarrow{${eText}}` : `\\vec{${eText}}`;
        }
        return eText;
      }
      case 'bar': {
        const barPr = directChild(node, 'barPr');
        const posNode = barPr ? directChild(barPr, 'pos') : null;
        const posVal = posNode ? attrVal(posNode) || 'top' : 'top';
        const eText = walk(directChild(node, 'e')).trim();
        return posVal === 'bot' ? `\\underline{${eText}}` : `\\overline{${eText}}`;
      }
      case 'func': {
        const fnText = walk(directChild(node, 'fName')).trim();
        const eText = walk(directChild(node, 'e')).trim();
        const cleanFn = /^(sin|cos|tan|cot|arcsin|arccos|arctan|ln|log|lim|max|min|exp)$/i.test(fnText)
          ? `\\${fnText.toLowerCase()}`
          : fnText;
        return eText ? `${cleanFn} ${eText}` : cleanFn;
      }
      case 'groupchr': {
        const eText = walk(directChild(node, 'e')).trim();
        const groupChrPr = directChild(node, 'groupChrPr');
        const posNode = groupChrPr ? directChild(groupChrPr, 'pos') : null;
        const posVal = posNode ? attrVal(posNode) || 'bot' : 'bot';
        return posVal === 'top' ? `\\overbrace{${eText}}` : `\\underbrace{${eText}}`;
      }
      case 'd': {
        const dPr = directChild(node, 'dPr');
        const begNode = dPr ? directChild(dPr, 'begChr') : null;
        const endNode = dPr ? directChild(dPr, 'endChr') : null;
        const begChr = begNode ? attrVal(begNode) || '(' : '(';
        const endChr = endNode ? attrVal(endNode) : ')';
        const inner = directChildren(node, 'e').map((n) => walk(n).trim()).join(', ');
        if (begChr === '{' && !endChr) {
          return `\\begin{cases} ${inner} \\end{cases}`;
        }
        const esc = (c: string) => (c === '{' || c === '}' || c === '|' ? `\\${c}` : c);
        return `${esc(begChr)}${inner}${esc(endChr || '')}`;
      }
      case 'eqarr': {
        const rows = directChildren(node, 'e').map((n) => walk(n).trim());
        return rows.join(' \\\\ ');
      }
      case 'm': {
        const rows = directChildren(node, 'mr').map((mr) =>
          directChildren(mr, 'e').map((cell) => walk(cell).trim()).join(' & ')
        );
        return `\\begin{pmatrix} ${rows.join(' \\\\ ')} \\end{pmatrix}`;
      }
      case 'borderbox': {
        return walk(directChild(node, 'e')).trim();
      }
      default: {
        let acc = '';
        if (node.childNodes) {
          for (let i = 0; i < node.childNodes.length; i++) {
            acc += walk(node.childNodes[i]);
          }
        }
        return acc;
      }
    }
  }

  const raw = walk(mathNode).trim();
  return raw.replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// OMML → plain linear text (search / preview / fallback rendering)
// e.g. fraction → (2x+1)/(x-1), integral → ∫_0^1 2x dx, root → √(x)
// ---------------------------------------------------------------------------

export function ommlToPlainText(mathNode: any): string {
  function walk(node: any): string {
    if (!node) return '';
    if (node.nodeType === TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== ELEMENT_NODE) return '';

    const tag = localTag(node);

    switch (tag) {
      case 't':
        return node.textContent || '';
      case 'f': {
        const numText = walk(directChild(node, 'num')).trim();
        const denText = walk(directChild(node, 'den')).trim();
        return `(${numText})/(${denText})`;
      }
      case 'ssup': {
        const eText = walk(directChild(node, 'e')).trim();
        const supText = walk(directChild(node, 'sup')).trim();
        const needsParens = supText.length > 1 || /[+\-*/=<>]/.test(supText);
        return needsParens ? `${eText}^(${supText})` : `${eText}^${supText}`;
      }
      case 'ssub': {
        const eText = walk(directChild(node, 'e')).trim();
        const subText = walk(directChild(node, 'sub')).trim();
        const needsParens = subText.length > 1 || /[+\-*/=<>]/.test(subText);
        return needsParens ? `${eText}_(${subText})` : `${eText}_${subText}`;
      }
      case 'ssubsup': {
        const eText = walk(directChild(node, 'e')).trim();
        const subText = walk(directChild(node, 'sub')).trim();
        const supText = walk(directChild(node, 'sup')).trim();
        return `${eText}_${subText}^${supText}`;
      }
      case 'spre': {
        const subText = walk(directChild(node, 'sub')).trim();
        const supText = walk(directChild(node, 'sup')).trim();
        const eText = walk(directChild(node, 'e')).trim();
        return `_${subText}^${supText}${eText}`;
      }
      case 'rad': {
        const degText = walk(directChild(node, 'deg')).trim();
        const eText = walk(directChild(node, 'e')).trim();
        if (degText) return `√[${degText}](${eText})`;
        return eText.length <= 2 ? `√${eText}` : `√(${eText})`;
      }
      case 'nary': {
        const naryPr = directChild(node, 'naryPr');
        const chrNode = naryPr ? directChild(naryPr, 'chr') : null;
        const chrVal = chrNode ? attrVal(chrNode) || '∫' : '∫';
        const subText = walk(directChild(node, 'sub')).trim();
        const supText = walk(directChild(node, 'sup')).trim();
        const eText = walk(directChild(node, 'e')).trim();
        const lo = subText ? `_${subText}` : '';
        const hi = supText ? `^${supText}` : '';
        return `${chrVal}${lo}${hi} ${eText}`.trim();
      }
      case 'limlow': {
        const eText = walk(directChild(node, 'e')).trim();
        const limText = walk(directChild(node, 'lim')).trim();
        return `${eText} (${limText})`;
      }
      case 'limupp': {
        const eText = walk(directChild(node, 'e')).trim();
        const limText = walk(directChild(node, 'lim')).trim();
        return `${eText} (${limText})`;
      }
      case 'acc':
      case 'bar': {
        return walk(directChild(node, 'e')).trim();
      }
      case 'func': {
        const fnText = walk(directChild(node, 'fName')).trim();
        const eText = walk(directChild(node, 'e')).trim();
        return eText ? `${fnText} ${eText}` : fnText;
      }
      case 'groupchr': {
        return walk(directChild(node, 'e')).trim();
      }
      case 'd': {
        const dPr = directChild(node, 'dPr');
        const begNode = dPr ? directChild(dPr, 'begChr') : null;
        const endNode = dPr ? directChild(dPr, 'endChr') : null;
        const begChr = begNode ? attrVal(begNode) || '(' : '(';
        const endChr = endNode ? attrVal(endNode) : ')';
        const inner = directChildren(node, 'e').map((n) => walk(n).trim()).join(', ');
        return `${begChr}${inner}${endChr || ''}`;
      }
      case 'eqarr': {
        return directChildren(node, 'e').map((n) => walk(n).trim()).join('; ');
      }
      case 'm': {
        const rows = directChildren(node, 'mr').map((mr) =>
          directChildren(mr, 'e').map((cell) => walk(cell).trim()).join(', ')
        );
        return `(${rows.join('; ')})`;
      }
      default: {
        let acc = '';
        if (node.childNodes) {
          for (let i = 0; i < node.childNodes.length; i++) {
            acc += walk(node.childNodes[i]);
          }
        }
        return acc;
      }
    }
  }

  return walk(mathNode).trim().replace(/\s+/g, ' ');
}
