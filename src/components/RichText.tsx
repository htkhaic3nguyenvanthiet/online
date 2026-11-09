import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * RichText — the ONE renderer for question/option/sub-item text (Phase B).
 *
 * Text stored on a Question is plain text plus inline markers:
 *   \(...\)        LaTeX (OMML converted at import) → rendered with KaTeX
 *   ⟦img:N⟧        image N of the owning question (`images` prop)
 *   ⟦table⟧        the question's structured table (`table` prop)
 *   ⟦sub:x⟧/⟦sup:x⟧  subscript / superscript runs
 *
 * Safety: plain segments render as React text nodes (auto-escaped). The only
 * HTML injected is KaTeX's own renderToString output for a math segment —
 * the standard safe pattern; raw user HTML never reaches the DOM.
 *
 * Missing data stays VISIBLE: an image marker with no data renders a dashed
 * warning box, a table marker without rows renders a note — content is never
 * silently dropped and never replaced with invented content.
 */

interface RichTextProps {
  text?: string | null;
  images?: string[];
  table?: string[][];
  className?: string;
  /** Compact mode for small previews (smaller images, tighter table). */
  compact?: boolean;
}

type Segment =
  | { type: 'text'; value: string }
  | { type: 'math'; value: string }
  | { type: 'image'; index: number }
  | { type: 'table' }
  | { type: 'sub'; value: string }
  | { type: 'sup'; value: string };

const TOKEN_RE = /\\\(([\s\S]*?)\\\)|⟦img:(\d+)⟧|⟦table⟧|⟦sub:([\s\S]*?)⟧|⟦sup:([\s\S]*?)⟧/g;

export function splitRichSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', value: text.slice(last, m.index) });
    if (m[1] !== undefined) segments.push({ type: 'math', value: m[1] });
    else if (m[2] !== undefined) segments.push({ type: 'image', index: Number(m[2]) });
    else if (m[4] !== undefined) segments.push({ type: 'sub', value: m[4] });
    else if (m[5] !== undefined) segments.push({ type: 'sup', value: m[5] });
    else segments.push({ type: 'table' });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}

/** Plain-text rendering of a rich string (titles, tooltips, search). */
export function richToPlain(text: string): string {
  return text
    .replace(/\\\(([\s\S]*?)\\\)/g, '$1')
    .replace(/⟦img:\d+⟧/g, '[Hình ảnh]')
    .replace(/⟦table⟧/g, '[Bảng số liệu]')
    .replace(/⟦sub:([\s\S]*?)⟧/g, '$1')
    .replace(/⟦sup:([\s\S]*?)⟧/g, '$1');
}

function renderTextWithBreaks(value: string, keyPrefix: string): React.ReactNode[] {
  const parts = value.split('\n');
  return parts.map((part, i) => (
    <React.Fragment key={`${keyPrefix}-${i}`}>
      {i > 0 && <br />}
      {part}
    </React.Fragment>
  ));
}

export const RichText: React.FC<RichTextProps> = ({ text, images, table, className, compact }) => {
  const value = text || '';
  if (!value) return null;
  const segments = splitRichSegments(value);
  const imgClass = compact ? 'max-h-40' : 'max-h-80';

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'text':
            return <React.Fragment key={i}>{renderTextWithBreaks(seg.value, `t${i}`)}</React.Fragment>;
          case 'math': {
            let html: string | null = null;
            try {
              html = katex.renderToString(seg.value, { throwOnError: false, strict: false });
            } catch {
              html = null;
            }
            if (html) {
              return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
            }
            // KaTeX failed entirely — show the raw LaTeX visibly, never hide it.
            return (
              <code key={i} className="rounded bg-amber-100 px-1 text-[0.9em] text-amber-900">
                {seg.value}
              </code>
            );
          }
          case 'image': {
            const uri = images?.[seg.index];
            if (uri) {
              return (
                <img
                  key={i}
                  src={uri}
                  alt={`Hình ảnh ${seg.index + 1} của câu hỏi`}
                  className={`my-2 block ${imgClass} max-w-full rounded-lg border border-slate-300 bg-white object-contain p-1`}
                  loading="lazy"
                />
              );
            }
            return (
              <span
                key={i}
                className="my-2 block rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700"
              >
                ⚠ Hình ảnh không đọc được từ file Word — Thầy kiểm tra lại đề gốc giúp em.
              </span>
            );
          }
          case 'table': {
            if (table && table.length > 0) {
              return (
                <span key={i} className="my-2 block overflow-x-auto">
                  <table className="w-full border-collapse overflow-hidden rounded-lg text-[0.92em]">
                    <tbody>
                      {table.map((row, r) => (
                        <tr key={r} className={r === 0 ? 'bg-slate-700/60 font-semibold text-white' : ''}>
                          {row.map((cell, c) => (
                            <td key={c} className="border border-slate-400/60 px-2 py-1 align-top">
                              <RichText text={cell} images={images} compact={compact} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </span>
              );
            }
            return (
              <span key={i} className="my-2 block rounded-lg border border-dashed border-slate-400 px-3 py-2 text-sm text-slate-500">
                [Bảng số liệu không đọc được]
              </span>
            );
          }
          case 'sub':
            return <sub key={i}>{seg.value}</sub>;
          case 'sup':
            return <sup key={i}>{seg.value}</sup>;
          default:
            return null;
        }
      })}
    </span>
  );
};

export default RichText;
