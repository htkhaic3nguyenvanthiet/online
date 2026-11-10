import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Eye, PencilLine } from 'lucide-react';
import { Quiz, Question } from '../types/quiz';
import RichText, { richToPlain } from './RichText';
import { validatePart3Answer } from '../utils/wordExamParser';

// ============================================================
// Khung XEM & SỬA ĐỀ GỐC ngay trong mục Trộn đề.
// Mọi chỉnh sửa áp lên BẢN LÀM VIỆC (bản sao của đề đã chọn) —
// bản trong Kho đề kiểm tra KHÔNG bị sửa theo. Giáo viên sửa
// xong thì trộn từ chính bản làm việc này.
// ============================================================

interface MixerSourceEditorProps {
  source: Quiz;
  /** Cảnh báo toàn cục lúc đọc file (import warnings). */
  warnings: string[];
  onChange: (updated: Quiz) => void;
  /** Yêu cầu mở + cuộn tới một câu (từ danh sách lỗi của cổng chuẩn 100%). */
  focusRequest?: { index: number; nonce: number } | null;
}

const PART_LABEL: Record<string, string> = {
  part1_choice: 'Phần I',
  part2_true_false: 'Phần II',
  part3_short_answer: 'Phần III',
  part4_essay: 'Tự luận',
};

function isEmptyRich(text: string | undefined): boolean {
  const t = text || '';
  if (/⟦img:|⟦table⟧/.test(t)) return false; // có hình/bảng = có nội dung
  return richToPlain(t).trim() === '';
}

/** Danh sách vấn đề dữ liệu của một câu (để tô sáng chỗ cần sửa trước khi trộn). */
export function questionProblems(q: Question): string[] {
  const problems: string[] = [];
  if (isEmptyRich(q.content)) problems.push('Thiếu nội dung câu hỏi');
  const part = q.partType || (q.options?.length ? 'part1_choice' : undefined);
  if (part === 'part1_choice') {
    const opts = q.options || [];
    if (opts.length === 0) problems.push('Chưa có phương án');
    opts.forEach((o, i) => {
      if (isEmptyRich(o.text)) problems.push(`Phương án ${o.key || 'ABCD'[i] || ''} trống`);
    });
    const nCorrect = opts.filter((o) => o.isCorrect).length;
    if (opts.length > 0 && nCorrect === 0) problems.push('Chưa có đáp án đúng');
    if (nCorrect > 1) problems.push('Có nhiều hơn 1 đáp án đúng');
  } else if (part === 'part2_true_false') {
    const subs = q.subItems || [];
    if (subs.length !== 4) problems.push(`Mới có ${subs.length}/4 ý Đúng/Sai`);
    subs.forEach((s, i) => {
      if (isEmptyRich(s.content)) problems.push(`Ý ${s.key || 'abcd'[i] || ''} trống`);
    });
  } else if (part === 'part3_short_answer') {
    const ans = (q.shortAnswerCorrect ?? q.correctAnswer ?? '').toString().trim();
    if (!ans) problems.push('Chưa có đáp án');
    else {
      const v = validatePart3Answer(ans);
      if (v) problems.push(v);
    }
  }
  return problems;
}

const textareaCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white';

export const MixerSourceEditor: React.FC<MixerSourceEditorProps> = ({ source, warnings, onChange, focusRequest }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const questions = source.questions || [];

  // Mở + cuộn tới câu được yêu cầu từ danh sách lỗi đạt chuẩn.
  useEffect(() => {
    if (!focusRequest) return;
    setOpenIdx(focusRequest.index);
    const t = setTimeout(() => {
      rowRefs.current[focusRequest.index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    return () => clearTimeout(t);
  }, [focusRequest]);

  const numbering = useMemo(() => {
    const counters: Record<string, number> = {};
    return questions.map((q) => {
      const part = q.partType || (q.options?.length ? 'part1_choice' : 'part4_essay');
      counters[part] = (counters[part] || 0) + 1;
      return { part, num: counters[part] };
    });
  }, [questions]);

  const problemCounts = useMemo(() => questions.map((q) => questionProblems(q).length), [questions]);
  const badCount = questions.filter(
    (q, i) => problemCounts[i] > 0 || (q.parseWarnings || []).length > 0
  ).length;

  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    const next = questions.map((q, i) => (i === idx ? { ...q, ...patch } : q));
    onChange({ ...source, questions: next });
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h2 className="font-extrabold text-slate-800 flex items-center gap-2 mb-1">
        <Eye className="w-5 h-5 text-teal-700" /> Đề gốc (bản làm việc để trộn) — xem &amp; chỉnh sửa
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        Đây là <b>bản làm việc</b> dùng để trộn: sửa ở đây KHÔNG làm thay đổi đề trong Kho đề kiểm tra. Bấm vào
        từng câu để xem đầy đủ (công thức, hình ảnh, bảng số liệu) và sửa trực tiếp nếu thiếu dữ liệu, sai đáp án
        hay lỗi chữ — trộn đề sẽ dùng đúng bản đã sửa.
        {badCount > 0 ? (
          <span className="block mt-1 text-amber-700 font-semibold">
            Có {badCount} câu đang thiếu/sai dữ liệu hoặc còn cảnh báo chưa xác nhận (đánh dấu ⚠ bên dưới) — cần
            sửa/xác nhận xong mới trộn được (cổng chuẩn 100%).
          </span>
        ) : (
          <span className="block mt-1 text-teal-700 font-semibold">
            Tất cả các câu đều đủ đáp án, phương án và không còn cảnh báo chờ xác nhận.
          </span>
        )}
      </p>

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-xs font-medium space-y-1 mb-3">
          {warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {questions.map((q, idx) => {
          const { part, num } = numbering[idx];
          const problems = questionProblems(q);
          const parseWarns = q.parseWarnings || [];
          const isOpen = openIdx === idx;
          const snippet = (q.contentPlain || richToPlain(q.content || '')).replace(/\s+/g, ' ').trim();
          return (
            <div
              key={q.id || idx}
              ref={(el) => {
                rowRefs.current[idx] = el;
              }}
              className={`border rounded-xl overflow-hidden ${
                problems.length > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-slate-50/40'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left"
              >
                <span className="text-sm font-extrabold text-blue-900 bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5 shrink-0">
                  Câu {num}
                </span>
                <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0">
                  {PART_LABEL[part] || part}
                </span>
                <span className="text-sm text-slate-700 truncate flex-1">{snippet || '(chưa có nội dung)'}</span>
                {parseWarns.length > 0 && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-md px-1.5 py-0.5 shrink-0">
                    {parseWarns.length} cảnh báo đọc file
                  </span>
                )}
                {problems.length > 0 ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" /> {problems[0]}
                    {problems.length > 1 ? ` (+${problems.length - 1})` : ''}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-teal-700 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đủ dữ liệu
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="px-3.5 pb-3.5 pt-1 bg-white border-t border-slate-200 space-y-3">
                  {parseWarns.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-xs font-medium space-y-1.5">
                      {parseWarns.map((w, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span className="flex-1">{w}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const remaining = parseWarns.filter((_, wi) => wi !== i);
                              updateQuestion(idx, {
                                parseWarnings: remaining,
                                acknowledgedParseWarnings: [
                                  ...(q.acknowledgedParseWarnings || []),
                                  w,
                                ],
                              });
                            }}
                            className="shrink-0 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 font-bold rounded-md px-2 py-1 text-[11px]"
                            title="Chỉ xác nhận sau khi đã xem trước câu này và thấy nội dung hiển thị ổn"
                          >
                            Đã kiểm tra — xác nhận ổn
                          </button>
                        </div>
                      ))}
                      <p className="text-[11px] text-amber-600">
                        Cảnh báo chưa xác nhận sẽ chặn nút trộn đề (cổng chuẩn 100%). Hãy xem phần Xem trước của
                        câu — nếu nội dung hiển thị đúng thì bấm xác nhận.
                      </p>
                    </div>
                  )}
                  {(q.acknowledgedParseWarnings || []).length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 text-slate-500 rounded-lg px-3 py-2 text-xs space-y-0.5">
                      {(q.acknowledgedParseWarnings || []).map((w, i) => (
                        <p key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-teal-600" />
                          <span className="line-through decoration-slate-300">{w}</span>
                          <span className="font-bold text-teal-700 shrink-0">Đã xác nhận</span>
                        </p>
                      ))}
                    </div>
                  )}
                  {problems.length > 0 && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-xs font-semibold">
                      Cần sửa: {problems.join(' • ')}
                    </div>
                  )}

                  {/* Xem trước đúng như học sinh sẽ thấy */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-800">
                    <p className="text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> Xem trước
                    </p>
                    <div className="font-semibold">
                      <RichText text={q.content} images={q.images} table={q.table} />
                    </div>
                    {part === 'part1_choice' &&
                      (q.options || []).map((o) => (
                        <p key={o.key} className="mt-1">
                          <span className={`font-bold ${o.isCorrect ? 'text-teal-700' : 'text-slate-600'}`}>
                            {o.key}.
                          </span>{' '}
                          <RichText text={o.text} images={q.images} />
                          {o.isCorrect && (
                            <span className="ml-2 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5">
                              ĐÁP ÁN ĐÚNG
                            </span>
                          )}
                        </p>
                      ))}
                    {part === 'part2_true_false' &&
                      (q.subItems || []).map((s) => (
                        <p key={s.key} className="mt-1">
                          <span className="font-bold text-slate-600">{s.key})</span>{' '}
                          <RichText text={s.content} images={q.images} />{' '}
                          <span
                            className={`text-[11px] font-bold rounded px-1.5 py-0.5 border ${
                              s.isCorrect
                                ? 'text-teal-700 bg-teal-50 border-teal-200'
                                : 'text-rose-700 bg-rose-50 border-rose-200'
                            }`}
                          >
                            {s.isCorrect ? 'ĐÚNG' : 'SAI'}
                          </span>
                        </p>
                      ))}
                    {part === 'part3_short_answer' && (
                      <p className="mt-1 text-slate-600">
                        Đáp án:{' '}
                        <b className="text-teal-700">
                          {(q.shortAnswerCorrect ?? q.correctAnswer ?? '').toString() || '(chưa có)'}
                        </b>
                      </p>
                    )}
                  </div>

                  {/* Khu vực sửa trực tiếp */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <PencilLine className="w-3.5 h-3.5" /> Nội dung câu hỏi
                    </label>
                    <textarea
                      className={textareaCls}
                      rows={3}
                      value={q.content || ''}
                      onChange={(e) =>
                        updateQuestion(idx, {
                          content: e.target.value,
                          contentPlain: richToPlain(e.target.value),
                        })
                      }
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Giữ nguyên các mã ⟦img:…⟧, ⟦table⟧ và công thức \(...\) trong nội dung — đó là hình ảnh,
                      bảng và công thức của câu hỏi.
                    </p>
                  </div>

                  {part === 'part1_choice' && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Phương án &amp; đáp án đúng (chọn nút tròn để đổi đáp án)
                      </p>
                      {(q.options || []).map((o, oi) => (
                        <div key={o.key || oi} className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name={`mixer-correct-${idx}`}
                            checked={!!o.isCorrect}
                            onChange={() =>
                              updateQuestion(idx, {
                                options: (q.options || []).map((x, xi) => ({
                                  ...x,
                                  isCorrect: xi === oi,
                                })),
                                correctAnswer: o.key,
                              })
                            }
                            className="mt-2.5 w-4 h-4 accent-teal-700 shrink-0"
                          />
                          <span className="mt-2 text-sm font-extrabold text-slate-700 w-5 shrink-0">{o.key}.</span>
                          <textarea
                            className={textareaCls}
                            rows={2}
                            value={o.text || ''}
                            onChange={(e) =>
                              updateQuestion(idx, {
                                options: (q.options || []).map((x, xi) =>
                                  xi === oi ? { ...x, text: e.target.value } : x
                                ),
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {part === 'part2_true_false' && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Các ý &amp; Đúng/Sai (bấm để đổi)
                      </p>
                      {(q.subItems || []).map((s, si) => (
                        <div key={s.key || si} className="flex items-start gap-2.5">
                          <span className="mt-2 text-sm font-extrabold text-slate-700 w-5 shrink-0">{s.key})</span>
                          <textarea
                            className={textareaCls}
                            rows={2}
                            value={s.content || ''}
                            onChange={(e) => {
                              const subs = (q.subItems || []).map((x, xi) =>
                                xi === si ? { ...x, content: e.target.value } : x
                              );
                              updateQuestion(idx, { subItems: subs });
                            }}
                          />
                          <div className="flex rounded-lg border border-slate-300 overflow-hidden shrink-0 mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const subs = (q.subItems || []).map((x, xi) =>
                                  xi === si ? { ...x, isCorrect: true } : x
                                );
                                updateQuestion(idx, {
                                  subItems: subs,
                                  correctAnswer: subs
                                    .map((x) => `${x.key}:${x.isCorrect ? 'Đ' : 'S'}`)
                                    .join(' '),
                                });
                              }}
                              className={`px-2.5 py-1.5 text-xs font-bold ${
                                s.isCorrect ? 'bg-teal-600 text-white' : 'bg-white text-slate-500'
                              }`}
                            >
                              Đúng
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const subs = (q.subItems || []).map((x, xi) =>
                                  xi === si ? { ...x, isCorrect: false } : x
                                );
                                updateQuestion(idx, {
                                  subItems: subs,
                                  correctAnswer: subs
                                    .map((x) => `${x.key}:${x.isCorrect ? 'Đ' : 'S'}`)
                                    .join(' '),
                                });
                              }}
                              className={`px-2.5 py-1.5 text-xs font-bold ${
                                !s.isCorrect ? 'bg-rose-600 text-white' : 'bg-white text-slate-500'
                              }`}
                            >
                              Sai
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {part === 'part3_short_answer' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                        Đáp án (chỉ con số, tối đa 4 ký tự — ví dụ: 3000, 0,6, -2,5)
                      </label>
                      <input
                        type="text"
                        className={`${textareaCls} max-w-xs`}
                        value={(q.shortAnswerCorrect ?? q.correctAnswer ?? '').toString()}
                        onChange={(e) =>
                          updateQuestion(idx, {
                            shortAnswerCorrect: e.target.value,
                            correctAnswer: e.target.value,
                          })
                        }
                      />
                      {(() => {
                        const ans = (q.shortAnswerCorrect ?? q.correctAnswer ?? '').toString().trim();
                        const v = ans ? validatePart3Answer(ans) : null;
                        return v ? (
                          <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> {v}
                          </p>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default MixerSourceEditor;
