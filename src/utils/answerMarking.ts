/**
 * Multi-signal answer-marking detection, run on the .docx XML BEFORE
 * mammoth flattens formatting away.
 *
 * Teachers mark correct answers in many personal styles. This pass finds,
 * for every question group (Phần I options A–D inside one paragraph or in
 * four consecutive paragraphs; Phần II ý a–d in four consecutive
 * paragraphs), WHICH formatting dimension actually distinguishes the
 * answer(s) inside that group:
 *
 *   priority: underline  >  font colour  >  highlight  >  bold
 *
 * A dimension "decides" a group when it partitions the options (marks a
 * proper non-empty subset; for Phần I, exactly one). This is the crucial
 * insight from a real file where EVERY option letter was blue + bold and
 * only the correct one was additionally underlined: absolute formatting
 * means nothing — only the within-question difference does.
 *
 * When the winning dimension is not underline, underline is INJECTED into
 * the winning options' letter runs, so the downstream parser (which
 * already understands Bộ-style underline marking) reads the answers
 * natively. When the winner is underline (Bộ style), the document is
 * left completely untouched. Facts are reported in AnswerSignalStats so
 * the UI can tell the teacher how the answers were recognised.
 */

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export type AnswerSignal = 'underline' | 'color' | 'highlight' | 'bold';

export interface AnswerSignalStats {
  part1Questions: number;
  part2Groups: number;
  bySignal: Record<AnswerSignal, number>;
  /** Groups where two dimensions pointed at different answers. */
  conflicts: number;
  /** Phần I questions where no dimension singled out an answer. */
  undeterminedPart1: number;
  /** Phần II groups where no dimension partitioned the ý (answers stay default). */
  part2NoSignal: number;
}

export function emptyAnswerSignalStats(): AnswerSignalStats {
  return {
    part1Questions: 0,
    part2Groups: 0,
    bySignal: { underline: 0, color: 0, highlight: 0, bold: 0 },
    conflicts: 0,
    undeterminedPart1: 0,
    part2NoSignal: 0,
  };
}

interface RunFmt {
  underline: boolean;
  bold: boolean;
  color: string | null;
  highlight: boolean;
}

interface RunInfo {
  node: any;
  text: string;
  start: number;
  end: number;
  fmt: RunFmt;
}

const localTagOf = (node: any): string =>
  (node.localName || node.tagName || '').toLowerCase();
const isElement = (node: any): boolean => !!node && node.nodeType === 1;

function collectRunText(node: any, out: string[]): void {
  const children = node.childNodes || [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!isElement(child)) {
      if (child && child.nodeType === 3 && child.nodeValue) out.push(child.nodeValue);
      continue;
    }
    const tag = localTagOf(child);
    if (tag === 't') out.push(child.textContent || '');
    else if (tag === 'tab') out.push('\t');
    else if (tag === 'br') out.push('\n');
    else if (tag === 'object' || tag === 'drawing' || tag === 'pict') {
      // No question text inside embedded objects.
    } else {
      collectRunText(child, out);
    }
  }
}

function readRunFmt(run: any): RunFmt {
  const fmt: RunFmt = { underline: false, bold: false, color: null, highlight: false };
  let rPr: any = null;
  const children = run.childNodes || [];
  for (let i = 0; i < children.length; i++) {
    if (isElement(children[i]) && localTagOf(children[i]) === 'rpr') {
      rPr = children[i];
      break;
    }
  }
  if (!rPr) return fmt;
  const kids = rPr.childNodes || [];
  for (let i = 0; i < kids.length; i++) {
    const el = kids[i];
    if (!isElement(el)) continue;
    const tag = localTagOf(el);
    const val = (el.getAttribute('w:val') || '').toLowerCase();
    if (tag === 'u') fmt.underline = val !== 'none' && val !== '0' && val !== 'false';
    else if (tag === 'b' || tag === 'bcs') {
      if (val !== '0' && val !== 'false' && val !== 'none') fmt.bold = true;
    } else if (tag === 'color') {
      const raw = (el.getAttribute('w:val') || '').toUpperCase();
      fmt.color = raw && raw !== 'AUTO' ? raw : null;
    } else if (tag === 'highlight') {
      fmt.highlight = !!val && val !== 'none';
    }
  }
  return fmt;
}

interface ParaInfo {
  node: any;
  text: string;
  runs: RunInfo[];
}

function analyzeParagraph(para: any): ParaInfo {
  const runNodes = para.getElementsByTagName('w:r');
  const runs: RunInfo[] = [];
  let text = '';
  for (let i = 0; i < runNodes.length; i++) {
    const parts: string[] = [];
    collectRunText(runNodes[i], parts);
    const runText = parts.join('');
    const start = text.length;
    text += runText;
    runs.push({
      node: runNodes[i],
      text: runText,
      start,
      end: text.length,
      fmt: readRunFmt(runNodes[i]),
    });
  }
  return { node: para, text, runs };
}

interface OptionInfo {
  letterRun: RunInfo;
  segRuns: RunInfo[];
}

// --- marker finding ---------------------------------------------------------

const P1_MARKER_RE = /(?:^|[\s\t.:;>])([ABCD])[\.\)](?![\p{L}0-9])/gu;

function findP1Markers(text: string): { letter: string; letterIdx: number }[] {
  const out: { letter: string; letterIdx: number }[] = [];
  P1_MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = P1_MARKER_RE.exec(text))) {
    const letterIdx = m.index + m[0].length - 2;
    out.push({ letter: m[1], letterIdx });
  }
  return out;
}

/** First ascending A→B→C→D marker chain in the text, or null. */
function findFullOptionChain(
  text: string
): { letter: string; letterIdx: number }[] | null {
  const markers = findP1Markers(text);
  const chain: { letter: string; letterIdx: number }[] = [];
  const order = ['A', 'B', 'C', 'D'];
  let need = 0;
  for (const mk of markers) {
    if (mk.letter === order[need]) {
      chain.push(mk);
      need++;
      if (need === 4) return chain;
    } else if (mk.letter === 'A' && need > 0 && need < 4) {
      // Restart the chain at a fresh A.
      chain.length = 0;
      chain.push(mk);
      need = 1;
    }
  }
  return null;
}

function startsWithP1Marker(text: string): string | null {
  const m = text.match(/^\s*([ABCD])[\.\)]/);
  return m ? m[1] : null;
}

function startsWithP2Marker(text: string): string | null {
  const m = text.match(/^\s*([abcd])\)/) || text.match(/^\s*([abcd])[\.\)]/);
  return m ? m[1] : null;
}

function runAtOffset(para: ParaInfo, idx: number): RunInfo | null {
  for (const r of para.runs) {
    if (idx >= r.start && idx < r.end) return r;
  }
  // Letter at the very end of the paragraph.
  for (let i = para.runs.length - 1; i >= 0; i--) {
    if (para.runs[i].text.length > 0) return para.runs[i];
  }
  return null;
}

function optionsFromChain(para: ParaInfo, chain: { letterIdx: number }[]): OptionInfo[] {
  const opts: OptionInfo[] = [];
  for (let i = 0; i < chain.length; i++) {
    const letterRun = runAtOffset(para, chain[i].letterIdx);
    if (!letterRun) return [];
    const segStart = chain[i].letterIdx;
    const segEnd = i + 1 < chain.length ? chain[i + 1].letterIdx : para.text.length;
    const segRuns = para.runs.filter((r) => r.end > segStart && r.start < segEnd);
    opts.push({ letterRun, segRuns });
  }
  return opts;
}

function optionFromOwnParagraph(para: ParaInfo): OptionInfo | null {
  const letterRun = para.runs.find((r) => r.text.trim().length > 0) || null;
  if (!letterRun) return null;
  return { letterRun, segRuns: para.runs };
}

// --- dimension analysis ------------------------------------------------------

const SIGNAL_PRIORITY: AnswerSignal[] = ['underline', 'color', 'highlight', 'bold'];

interface Candidate {
  signal: AnswerSignal;
  marked: number[];
}

function boolFeature(fmt: RunFmt, signal: AnswerSignal): boolean {
  if (signal === 'underline') return fmt.underline;
  if (signal === 'bold') return fmt.bold;
  if (signal === 'highlight') return fmt.highlight;
  return false;
}

/** Marked set for a colour-style dimension given one value per option. */
function colorMarkedSet(values: (string | null)[]): number[] | null {
  if (values.every((v) => v === values[0])) return null;
  const counts = new Map<string | null, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let modal: string | null = null;
  let modalCount = -1;
  counts.forEach((c, v) => {
    if (c > modalCount) {
      modal = v;
      modalCount = c;
    }
  });
  const marked: number[] = [];
  values.forEach((v, i) => {
    if (v !== modal) marked.push(i);
  });
  return marked.length >= 1 && marked.length <= values.length - 1 ? marked : null;
}

function segmentMajority(segRuns: RunInfo[], pick: (f: RunFmt) => boolean): boolean {
  const bearing = segRuns.filter((r) => r.text.trim().length > 0);
  if (!bearing.length) return false;
  const hits = bearing.filter((r) => pick(r.fmt)).length;
  return hits / bearing.length >= 0.5;
}

function segmentColor(segRuns: RunInfo[]): string | null {
  const bearing = segRuns.filter((r) => r.text.trim().length > 0 && r.fmt.color);
  if (!bearing.length) return null;
  const counts = new Map<string, number>();
  for (const r of bearing) counts.set(r.fmt.color!, (counts.get(r.fmt.color!) || 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  counts.forEach((c, v) => {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  });
  return best;
}

function analyzeGroup(
  options: OptionInfo[],
  kind: 'p1' | 'p2'
): { winner: Candidate; conflicts: number } | null {
  const n = options.length;
  const validMarked = (marked: number[] | null): marked is number[] =>
    !!marked && (kind === 'p1' ? marked.length === 1 : marked.length >= 1 && marked.length <= n - 1);

  for (const tier of ['letter', 'segment'] as const) {
    const candidates: Candidate[] = [];
    for (const signal of SIGNAL_PRIORITY) {
      let marked: number[] | null = null;
      if (signal === 'color') {
        const values =
          tier === 'letter'
            ? options.map((o) => o.letterRun.fmt.color)
            : options.map((o) => segmentColor(o.segRuns));
        marked = colorMarkedSet(values);
      } else {
        const flags =
          tier === 'letter'
            ? options.map((o) => boolFeature(o.letterRun.fmt, signal))
            : options.map((o) =>
                signal === 'underline'
                  ? // EduMix range rule: underline ANYWHERE in the option's
                    // segment (whole-option underlining is a common teacher
                    // style) marks the option — the partition guard below
                    // still requires it to single out a proper subset.
                    o.segRuns.some((r) => r.text.trim().length > 0 && r.fmt.underline)
                  : segmentMajority(o.segRuns, (f) => boolFeature(f, signal))
              );
        const idxs: number[] = [];
        flags.forEach((f, i) => {
          if (f) idxs.push(i);
        });
        marked = idxs.length >= 1 && idxs.length <= n - 1 ? idxs : null;
      }
      if (validMarked(marked)) candidates.push({ signal, marked });
    }
    if (candidates.length) {
      const winner = candidates[0];
      const winnerKey = winner.marked.join(',');
      const conflicts = candidates.filter((c) => c.marked.join(',') !== winnerKey).length;
      return { winner, conflicts };
    }
  }
  return null;
}

// --- underline injection ------------------------------------------------------

function injectUnderline(run: RunInfo): void {
  const node = run.node;
  const doc = node.ownerDocument;
  if (!doc) return;
  let rPr: any = null;
  const children = node.childNodes || [];
  for (let i = 0; i < children.length; i++) {
    if (isElement(children[i]) && localTagOf(children[i]) === 'rpr') {
      rPr = children[i];
      break;
    }
  }
  if (!rPr) {
    rPr = doc.createElementNS(W_NS, 'w:rPr');
    if (node.firstChild) node.insertBefore(rPr, node.firstChild);
    else node.appendChild(rPr);
  }
  const kids = rPr.childNodes || [];
  for (let i = 0; i < kids.length; i++) {
    if (isElement(kids[i]) && localTagOf(kids[i]) === 'u') {
      kids[i].setAttribute('w:val', 'single');
      return;
    }
  }
  const u = doc.createElementNS(W_NS, 'w:u');
  u.setAttribute('w:val', 'single');
  rPr.appendChild(u);
}

// --- main pass ------------------------------------------------------------------

export function normalizeAnswerMarking(doc: any): AnswerSignalStats {
  const stats = emptyAnswerSignalStats();
  const paraNodes = doc.getElementsByTagName('w:p');
  const paras: ParaInfo[] = [];
  for (let i = 0; i < paraNodes.length; i++) paras.push(analyzeParagraph(paraNodes[i]));
  const consumed = new Array(paras.length).fill(false);

  const applyResult = (
    options: OptionInfo[],
    kind: 'p1' | 'p2'
  ): void => {
    const result = analyzeGroup(options, kind);
    if (!result) {
      if (kind === 'p1') stats.undeterminedPart1++;
      else stats.part2NoSignal++;
      return;
    }
    const { winner, conflicts } = result;
    if (conflicts > 0) stats.conflicts++;
    stats.bySignal[winner.signal]++;
    if (kind === 'p1') stats.part1Questions++;
    else stats.part2Groups++;
    if (winner.signal !== 'underline') {
      for (const idx of winner.marked) injectUnderline(options[idx].letterRun);
    }
  };

  for (let i = 0; i < paras.length; i++) {
    if (consumed[i]) continue;
    const para = paras[i];
    if (!para.text.trim()) continue;

    // Phần II group: four consecutive paragraphs starting a) b) c) d).
    const first = startsWithP2Marker(para.text);
    if (first === 'a' && i + 3 < paras.length) {
      const seq = ['a', 'b', 'c', 'd'];
      let ok = true;
      for (let k = 1; k < 4; k++) {
        if (consumed[i + k] || startsWithP2Marker(paras[i + k].text) !== seq[k]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        const options: OptionInfo[] = [];
        for (let k = 0; k < 4; k++) {
          const opt = optionFromOwnParagraph(paras[i + k]);
          if (!opt) {
            ok = false;
            break;
          }
          options.push(opt);
        }
        if (ok) {
          for (let k = 0; k < 4; k++) consumed[i + k] = true;
          applyResult(options, 'p2');
          i += 3;
          continue;
        }
      }
    }

    // Phần I, one paragraph holding the whole A–D chain.
    const chain = findFullOptionChain(para.text);
    if (chain) {
      const options = optionsFromChain(para, chain);
      if (options.length === 4) {
        consumed[i] = true;
        applyResult(options, 'p1');
        continue;
      }
    }

    // Phần I, options in four consecutive paragraphs.
    if (startsWithP1Marker(para.text) === 'A' && i + 3 < paras.length) {
      const seq = ['A', 'B', 'C', 'D'];
      let ok = true;
      for (let k = 1; k < 4; k++) {
        if (consumed[i + k] || startsWithP1Marker(paras[i + k].text) !== seq[k]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        const options: OptionInfo[] = [];
        for (let k = 0; k < 4; k++) {
          const opt = optionFromOwnParagraph(paras[i + k]);
          if (!opt) {
            ok = false;
            break;
          }
          options.push(opt);
        }
        if (ok) {
          for (let k = 0; k < 4; k++) consumed[i + k] = true;
          applyResult(options, 'p1');
          i += 3;
          continue;
        }
      }
    }
  }

  return stats;
}
