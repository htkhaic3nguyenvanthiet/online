import React, { useMemo, useRef, useState } from 'react';
import {
  Shuffle,
  Upload,
  FileText,
  FileDown,
  Package,
  Save,
  QrCode,
  ClipboardList,
  Printer,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Copy,
  ChevronDown,
} from 'lucide-react';
import { Quiz, ActiveTab } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';
import { parseDocxFile, ParsedExamResult } from '../utils/wordExamParser';
import {
  generateShuffledVariants,
  buildAnswerKeyText,
  extractBaseCode,
  ShuffledVariantResult,
} from '../utils/shuffleEngine';
import {
  DEFAULT_PAPER_META,
  PaperMeta,
  MixerVariantKey,
  buildMixerAnswerKey,
  exportVariantPaperDocx,
  exportVariantSolutionsDocx,
  exportAnswerKeyDocx,
  exportMixerBundleZip,
  makeVariantQrDataUrl,
  triggerDownload,
} from '../utils/paperExporter';
import { QRAppFormat, exportGradingExcelXlsx } from '../utils/mixerGrading';
import {
  PhieuQMCode,
  resolvePhieuQMInfo,
  loadPhieuQMDataUrl,
} from '../utils/phieuQm';

interface ExamMixerViewProps {
  quizzes: Quiz[];
  onSaveVariants?: (variants: Quiz[]) => void;
  onNavigate?: (tab: ActiveTab) => void;
}

interface MixerResult {
  result: ShuffledVariantResult;
  key: MixerVariantKey;
  keyText: string;
}

const labelCls = 'block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5';
const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white';
const panelCls = 'bg-white rounded-2xl border border-slate-200 shadow-sm p-5';

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none py-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-10 h-5.5 shrink-0 rounded-full transition-colors relative ${checked ? 'bg-teal-600' : 'bg-slate-300'}`}
        style={{ height: 22 }}
      >
        <span
          className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-all ${checked ? 'left-[20px]' : 'left-0.5'}`}
        />
      </button>
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

export const ExamMixerView: React.FC<ExamMixerViewProps> = ({ quizzes, onSaveVariants }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<Quiz | null>(null);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);

  const [variantCount, setVariantCount] = useState(4);
  const [baseCodeText, setBaseCodeText] = useState('101');
  const [shuffleP1, setShuffleP1] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [shuffleP2Items, setShuffleP2Items] = useState(true);
  const [shuffleP3, setShuffleP3] = useState(false);

  const [meta, setMeta] = useState<PaperMeta>({ ...DEFAULT_PAPER_META });
  const [embedPhieu, setEmbedPhieu] = useState(true);
  const [phieuCode, setPhieuCode] = useState<PhieuQMCode>('AUTO');
  const [qrFormat, setQrFormat] = useState<QRAppFormat>('QM2025');
  const [embedQr, setEmbedQr] = useState(true);

  const [results, setResults] = useState<MixerResult[]>([]);
  const [busyAction, setBusyAction] = useState<string>('');
  const [error, setError] = useState('');

  const counts = useMemo(() => {
    if (!source) return null;
    const qs = source.questions || [];
    return {
      p1: qs.filter((q) => q.partType === 'part1_choice' || (!q.partType && q.options?.length)).length,
      p2: qs.filter((q) => q.partType === 'part2_true_false').length,
      p3: qs.filter((q) => q.partType === 'part3_short_answer').length,
      p4: qs.filter((q) => q.partType === 'part4_essay').length,
      total: qs.length,
    };
  }, [source]);

  const applySource = (quiz: Quiz, warnings: string[] = []) => {
    setSource(quiz);
    setSourceWarnings(warnings);
    setResults([]);
    setError('');
    setBaseCodeText(String(extractBaseCode(quiz)));
    setMeta((m) => ({
      ...m,
      subjectName: quiz.subject || m.subjectName,
      durationMinutes: quiz.durationMinutes || m.durationMinutes,
      examSubtitle: quiz.title || m.examSubtitle,
    }));
  };

  const handleUpload = async (file: File) => {
    setParsing(true);
    try {
      const parsed: ParsedExamResult = await parseDocxFile(file);
      if (!parsed.questions || parsed.questions.length === 0) {
        setError('Không đọc được câu hỏi nào từ file Word này.');
        return;
      }
      const p4 = parsed.questions.filter((q) => q.partType === 'part4_essay').length;
      const quiz: Quiz = {
        id: 'quiz-mixer-' + Date.now(),
        title: parsed.title || file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
        fileName: file.name,
        subject: parsed.subject || 'Khác',
        grade: '',
        createdAt: new Date().toLocaleDateString('vi-VN'),
        questionCount: parsed.questions.length,
        breakdown: `${parsed.part1Count}-${parsed.part2Count}-${parsed.part3Count}-${p4}`,
        durationMinutes: parsed.durationMinutes || 50,
        totalPoints: 10,
        folder: 'TRỘN ĐỀ',
        questions: parsed.questions,
      };
      applySource(quiz, parsed.importWarnings || []);
      soundEffects.playCorrect();
    } catch (err: any) {
      setError('Không thể đọc file Word: ' + (err?.message || 'vui lòng kiểm tra định dạng .docx'));
    } finally {
      setParsing(false);
    }
  };

  const parseBaseCode = (): number => {
    const t = baseCodeText.trim();
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    const digits = t.match(/\d+/);
    return digits ? parseInt(digits[0], 10) : 101;
  };

  const handleGenerate = () => {
    if (!source) {
      setError('Thầy chọn đề gốc trước khi trộn nhé.');
      return;
    }
    try {
      const generated = generateShuffledVariants(source, {
        count: Math.min(12, Math.max(1, variantCount || 1)),
        baseCode: parseBaseCode(),
        shufflePart1Questions: shuffleP1,
        shuffleOptions,
        shufflePart2Items: shuffleP2Items,
        shufflePart3Questions: shuffleP3,
      });
      setResults(
        generated.map((result) => ({
          result,
          key: buildMixerAnswerKey(result),
          keyText: buildAnswerKeyText(source.title, [result]),
        }))
      );
      setError('');
      soundEffects.playCorrect();
    } catch (err: any) {
      setError('Trộn đề lỗi: ' + (err?.message || 'không rõ nguyên nhân'));
    }
  };

  const getPhieu = async () => {
    if (!embedPhieu || !source) return { phieuInfo: null, phieuDataUrl: null };
    const info = resolvePhieuQMInfo(phieuCode, meta.subjectName || source.subject);
    const dataUrl = await loadPhieuQMDataUrl(info);
    return { phieuInfo: info, phieuDataUrl: dataUrl };
  };

  const withBusy = async (name: string, fn: () => Promise<void>) => {
    setBusyAction(name);
    try {
      await fn();
    } catch (err: any) {
      setError('Xuất file lỗi: ' + (err?.message || 'không rõ nguyên nhân'));
    } finally {
      setBusyAction('');
    }
  };

  const downloadPaper = (item: MixerResult) =>
    withBusy('paper-' + item.result.code, async () => {
      const { phieuDataUrl } = await getPhieu();
      const blob = await exportVariantPaperDocx(item.result, meta, {
        qrFormat,
        embedQrInPaper: embedQr,
        phieu: phieuDataUrl
          ? { dataUrl: phieuDataUrl, widthEmu: 5943600, heightEmu: 2952750 }
          : null,
      });
      triggerDownload(blob, `De_${item.result.code}.docx`);
    });

  const downloadSolutions = (item: MixerResult) =>
    withBusy('sol-' + item.result.code, async () => {
      const blob = await exportVariantSolutionsDocx(item.result, meta, {});
      triggerDownload(blob, `De_${item.result.code}_Co_dap_an.docx`);
    });

  const downloadQr = (item: MixerResult) =>
    withBusy('qr-' + item.result.code, async () => {
      const dataUrl = await makeVariantQrDataUrl(item.key, qrFormat);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Ma_QR_De_${item.result.code}.png`;
      a.click();
    });

  const downloadBundle = () =>
    withBusy('bundle', async () => {
      if (!source) return;
      const { phieuInfo, phieuDataUrl } = await getPhieu();
      const blob = await exportMixerBundleZip(source, String(extractBaseCode(source)), results.map((r) => r.result), meta, {
        qrFormat,
        embedQrInPaper: embedQr,
        phieuInfo,
        phieuDataUrl,
      });
      triggerDownload(blob, `Bo_de_giay_${meta.subjectName.replace(/\s+/g, '_')}_${results[0]?.result.code}-${results[results.length - 1]?.result.code}.zip`);
      soundEffects.playCorrect();
    });

  const downloadAnswerKey = () =>
    withBusy('answerkey', async () => {
      const blob = await exportAnswerKeyDocx(results.map((r) => r.key), meta);
      triggerDownload(blob, 'Dap_an_chuan.docx');
    });

  const downloadExcel = () =>
    withBusy('excel', async () => {
      const blob = await exportGradingExcelXlsx(results.map((r) => r.key), 'QM2025');
      triggerDownload(blob, 'Excel_QM_2025.xlsx');
    });

  const downloadPhieu = () =>
    withBusy('phieu', async () => {
      if (!source) return;
      const info = resolvePhieuQMInfo(phieuCode, meta.subjectName || source.subject);
      const dataUrl = await loadPhieuQMDataUrl(info);
      if (!dataUrl) {
        setError('Không tải được mẫu phiếu trả lời.');
        return;
      }
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'Phieu_tra_loi_trac_nghiem.jpg';
      a.click();
    });

  const saveToLibrary = () => {
    if (!onSaveVariants || results.length === 0) return;
    onSaveVariants(results.map((r) => r.result.quiz));
    soundEffects.playCorrect();
  };

  const copyKeyText = (item: MixerResult) => {
    navigator.clipboard?.writeText(item.keyText).catch(() => {});
    soundEffects.playClick();
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Tiêu đề mục */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-700 flex items-center justify-center shrink-0">
          <Shuffle className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Trộn đề</h1>
          <p className="text-sm text-slate-500 font-medium">
            Tạo bộ đề giấy nhiều mã để in — dùng cho kiểm tra thật trên lớp: đề Word từng mã, file đáp án chuẩn,
            mã QR chấm thi và phiếu trả lời trắc nghiệm, đúng combo như trang trộn đề EduMix.
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-2 inline-block font-medium">
            Khác với <b>Giao đề Online</b> (học sinh làm bài trên máy, đề tự xáo theo từng em) — mục này sản xuất
            <b> bộ đề GIẤY để in và phát trên lớp</b>.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm font-medium">
          <AlertTriangle className="w-4.5 h-4.5 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Đề gốc */}
        <section className={panelCls}>
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-teal-700" /> 1. Chọn đề gốc
          </h2>
          <label className={labelCls}>Từ Kho đề kiểm tra</label>
          <select
            className={inputCls}
            value={source && quizzes.some((q) => q.id === source.id) ? source.id : ''}
            onChange={(e) => {
              const q = quizzes.find((x) => x.id === e.target.value);
              if (q) applySource(q);
            }}
          >
            <option value="">— Chọn một đề trong kho —</option>
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title} ({q.questionCount} câu)
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-bold text-slate-400">HOẶC</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
            className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-teal-300 text-teal-700 font-bold text-sm py-3 hover:bg-teal-50 transition disabled:opacity-50"
          >
            {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Tải file Word (.docx) từ máy — tự nhận đáp án, công thức, hình ảnh
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = '';
            }}
          />
          {source && counts && (
            <div className="mt-4 bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <p className="font-bold text-slate-800">{source.title}</p>
              <p className="text-slate-500 text-xs mt-1">
                Môn: {source.subject} • Thời gian: {source.durationMinutes} phút • Tổng {counts.total} câu —
                Phần I: {counts.p1}, Phần II: {counts.p2}, Phần III: {counts.p3}
                {counts.p4 > 0 ? `, Tự luận: ${counts.p4}` : ''}
              </p>
              {sourceWarnings.length > 0 && (
                <p className="text-amber-600 text-xs mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {sourceWarnings.length} cảnh báo khi đọc file — kiểm tra
                  lại trong Kho đề nếu cần.
                </p>
              )}
            </div>
          )}
        </section>

        {/* 2. Cấu hình trộn */}
        <section className={panelCls}>
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2 mb-3">
            <Shuffle className="w-5 h-5 text-teal-700" /> 2. Cấu hình trộn
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Số lượng mã đề</label>
              <input
                type="number"
                min={1}
                max={12}
                className={inputCls}
                value={variantCount}
                onChange={(e) => setVariantCount(parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div>
              <label className={labelCls}>Mã đề bắt đầu</label>
              <input
                type="text"
                className={inputCls}
                value={baseCodeText}
                onChange={(e) => setBaseCodeText(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-2 divide-y divide-slate-100">
            <Toggle checked={shuffleP1} onChange={setShuffleP1} label="Xáo trộn thứ tự câu hỏi Phần I" />
            <Toggle checked={shuffleOptions} onChange={setShuffleOptions} label="Xáo trộn phương án A/B/C/D" hint="Đáp án được bám theo nội dung — không lệch khóa." />
            <Toggle checked={shuffleP2Items} onChange={setShuffleP2Items} label="Xáo trộn ý a/b/c/d trong câu Đúng/Sai" hint="Thứ tự câu Phần II giữ nguyên như EduMix." />
            <Toggle checked={shuffleP3} onChange={setShuffleP3} label="Xáo trộn câu hỏi Phần III (trả lời ngắn)" hint="Mặc định tắt như EduMix." />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Mỗi mã đề có <b>seed</b> riêng (hiển thị ở kết quả): cùng đề gốc + cùng cấu hình sẽ tái lập đúng bộ mã đó.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!source}
            className="mt-4 w-full bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white font-extrabold rounded-xl py-3 flex items-center justify-center gap-2 transition"
          >
            <Shuffle className="w-5 h-5" /> TRỘN ĐỀ NGAY
          </button>
        </section>
      </div>

      {/* 3. Thông tin in trên đề */}
      <section className={panelCls}>
        <h2 className="font-extrabold text-slate-800 flex items-center gap-2 mb-3">
          <Printer className="w-5 h-5 text-teal-700" /> 3. Thông tin in trên tờ đề &amp; phiếu
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Sở / Phòng</label>
            <input className={inputCls} value={meta.departmentName} onChange={(e) => setMeta({ ...meta, departmentName: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Trường</label>
            <input className={inputCls} value={meta.schoolName} onChange={(e) => setMeta({ ...meta, schoolName: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Năm học</label>
            <input className={inputCls} value={meta.schoolYear} onChange={(e) => setMeta({ ...meta, schoolYear: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Tên kỳ kiểm tra</label>
            <input className={inputCls} value={meta.examTitle} onChange={(e) => setMeta({ ...meta, examTitle: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Môn thi</label>
            <input className={inputCls} value={meta.subjectName} onChange={(e) => setMeta({ ...meta, subjectName: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Thời gian làm bài (phút)</label>
            <input type="number" min={1} className={inputCls} value={meta.durationMinutes} onChange={(e) => setMeta({ ...meta, durationMinutes: parseInt(e.target.value, 10) || 50 })} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Dòng phụ (tên đề / chủ đề)</label>
            <input className={inputCls} value={meta.examSubtitle} onChange={(e) => setMeta({ ...meta, examSubtitle: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Giáo viên ra đề</label>
            <input className={inputCls} value={meta.teacherName || ''} onChange={(e) => setMeta({ ...meta, teacherName: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className={labelCls}>Phiếu trả lời QM 2025</label>
            <select className={inputCls} value={phieuCode} onChange={(e) => setPhieuCode(e.target.value as PhieuQMCode)}>
              <option value="AUTO">Tự động theo môn</option>
              <option value="TOAN">Phiếu Toán (12-4-6)</option>
              <option value="KHTN_DIA">Phiếu KHTN &amp; Địa (18-4-6)</option>
              <option value="NGOAI_NGU">Phiếu Ngoại ngữ (40 câu)</option>
              <option value="KHXH_CN_TIN">Phiếu KHXH, Công nghệ, Tin (24-6-0)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Định dạng QR chấm thi</label>
            <select className={inputCls} value={qrFormat} onChange={(e) => setQrFormat(e.target.value as QRAppFormat)}>
              <option value="QM2025">QM 2025 (mặc định)</option>
              <option value="TNMAKER">TNMaker</option>
              <option value="AZOTA">Azota</option>
              <option value="UNT">UnT Dạy Học</option>
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <Toggle checked={embedPhieu} onChange={setEmbedPhieu} label="Nhúng phiếu trả lời vào trang 1 của đề" />
            <Toggle checked={embedQr} onChange={setEmbedQr} label="Nhúng QR đáp án vào ô mã đề" hint="QR chứa khóa của mã đề đó — phục vụ chấm bằng app." />
          </div>
        </div>
      </section>

      {/* 4. Kết quả */}
      {results.length > 0 && (
        <section className={panelCls}>
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-5 h-5 text-teal-700" /> 4. Bộ đề đã trộn — {results.length} mã đề
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Tải từng mã hoặc tải trọn bộ ZIP (Thư mục đề + Thư mục đáp án như EduMix). Đáp án của từng mã đã bám theo
            nội dung sau khi xáo — kiểm chứng bằng bản “Có đáp án”.
          </p>

          <div className="space-y-3">
            {results.map((item) => (
              <div key={item.result.code} className="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50/60">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg font-extrabold text-blue-900 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1">
                    MÃ {item.result.code}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">seed: {item.result.seed}</span>
                  <span className="text-xs text-slate-500">
                    Phân bố đáp án Phần I: A {item.result.distribution.A} • B {item.result.distribution.B} • C{' '}
                    {item.result.distribution.C} • D {item.result.distribution.D}
                  </span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => downloadPaper(item)}
                    disabled={busyAction !== ''}
                    className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg px-3 py-2 disabled:opacity-50"
                  >
                    {busyAction === 'paper-' + item.result.code ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                    Đề Word
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSolutions(item)}
                    disabled={busyAction !== ''}
                    className="flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg px-3 py-2 disabled:opacity-50"
                  >
                    {busyAction === 'sol-' + item.result.code ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    Bản có đáp án
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadQr(item)}
                    disabled={busyAction !== ''}
                    className="flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg px-3 py-2 disabled:opacity-50"
                  >
                    <QrCode className="w-3.5 h-3.5" /> QR mã đề
                  </button>
                </div>
                <details className="mt-2 group">
                  <summary className="text-xs font-bold text-teal-700 cursor-pointer flex items-center gap-1 select-none">
                    <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition" /> Xem khóa đáp án mã {item.result.code}
                  </summary>
                  <div className="relative mt-2">
                    <pre className="text-xs bg-white border border-slate-200 rounded-lg p-3 whitespace-pre-wrap font-mono text-slate-700 max-h-56 overflow-auto">
                      {item.keyText}
                    </pre>
                    <button
                      type="button"
                      onClick={() => copyKeyText(item)}
                      className="absolute top-2 right-2 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold rounded-md px-2 py-1"
                    >
                      <Copy className="w-3 h-3" /> Sao chép
                    </button>
                  </div>
                </details>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mt-5">
            <button
              type="button"
              onClick={downloadBundle}
              disabled={busyAction !== ''}
              className="flex items-center gap-2 bg-blue-800 hover:bg-blue-900 text-white font-extrabold rounded-xl px-5 py-3 text-sm disabled:opacity-50"
            >
              {busyAction === 'bundle' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              Tải trọn bộ ZIP (đề + đáp án + QR + Excel + phiếu)
            </button>
            <button
              type="button"
              onClick={downloadAnswerKey}
              disabled={busyAction !== ''}
              className="flex items-center gap-2 bg-white border-2 border-blue-800 text-blue-800 hover:bg-blue-50 font-bold rounded-xl px-4 py-3 text-sm disabled:opacity-50"
            >
              {busyAction === 'answerkey' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
              File đáp án chuẩn (.docx)
            </button>
            <button
              type="button"
              onClick={downloadExcel}
              disabled={busyAction !== ''}
              className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl px-4 py-3 text-sm disabled:opacity-50"
            >
              Excel QM 2025
            </button>
            <button
              type="button"
              onClick={downloadPhieu}
              disabled={busyAction !== ''}
              className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl px-4 py-3 text-sm disabled:opacity-50"
            >
              Phiếu trả lời (.jpg)
            </button>
            {onSaveVariants && (
              <button
                type="button"
                onClick={saveToLibrary}
                className="flex items-center gap-2 bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-bold rounded-xl px-4 py-3 text-sm"
              >
                <Save className="w-4 h-4" /> Lưu các mã vào Kho đề
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
