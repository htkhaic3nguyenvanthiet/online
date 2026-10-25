import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  Upload,
  Sparkles,
  FileText,
  CheckCircle2,
  Trash2,
  Wand2,
  Edit3,
  Bot,
  FileCheck,
  HelpCircle,
  Check,
  AlertCircle
} from 'lucide-react';
import { Quiz, Question, OptionKey } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';
import { aiService } from '../services/aiService';
import {
  parseDocxFile,
  parseCircular7991Html,
  getSampleCircular7991Template,
  ParsedExamResult
} from '../utils/wordExamParser';

interface CreateQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveQuiz: (newQuiz: Quiz) => void;
}

export const CreateQuizModal: React.FC<CreateQuizModalProps> = ({
  isOpen,
  onClose,
  onSaveQuiz,
}) => {
  const [activeTab, setActiveTab] = useState<'word' | 'ai' | 'paste'>('word');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common fields
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Công nghệ 12');
  const [grade, setGrade] = useState('Lớp 12');
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [isInteractive, setIsInteractive] = useState(true);

  // Circular 7991 stats
  const [partBreakdown, setPartBreakdown] = useState({ part1: 0, part2: 0, part3: 0 });
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isParsingWord, setIsParsingWord] = useState(false);

  // AI Generation inputs
  const [aiTopic, setAiTopic] = useState('Đất phèn, đất mặn và biện pháp cải tạo đất trồng');
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState('Thông hiểu & Vận dụng');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Raw text paste input
  const [rawText, setRawText] = useState('');

  // Generated / edited questions list
  const [questions, setQuestions] = useState<Question[]>([]);

  if (!isOpen) return null;

  // Handle Word .docx file upload
  const handleWordFileUpload = async (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.docx')) {
      alert('Vui lòng chọn tệp định dạng Word (.docx)!');
      return;
    }

    soundEffects.playClick();
    setIsParsingWord(true);
    setUploadedFileName(file.name);

    try {
      const parsed: ParsedExamResult = await parseDocxFile(file);

      setTitle(parsed.title || file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
      setQuestions(parsed.questions);
      setPartBreakdown({
        part1: parsed.part1Count,
        part2: parsed.part2Count,
        part3: parsed.part3Count
      });
      setDurationMinutes(parsed.durationMinutes || 50);

      soundEffects.playCorrect();
    } catch (err: any) {
      console.error('Lỗi đọc file Word:', err);
      alert('Không thể đọc file Word: ' + (err?.message || 'Vui lòng kiểm tra định dạng tệp .docx'));
    } finally {
      setIsParsingWord(false);
    }
  };

  // Load sample Circular 7991 template
  const handleLoadSample7991 = () => {
    soundEffects.playClick();
    const sampleTemplate = getSampleCircular7991Template();
    const parsed = parseCircular7991Html(sampleTemplate, 'ĐỀ THI MẪU THÔNG TƯ 7991 - CÔNG NGHỆ 12');

    setTitle(parsed.title);
    setQuestions(parsed.questions);
    setPartBreakdown({
      part1: parsed.part1Count,
      part2: parsed.part2Count,
      part3: parsed.part3Count
    });
    setUploadedFileName('De_Mau_Chuan_TT7991_CongNghe12.docx');
    soundEffects.playCorrect();
  };

  // AI Generate Action
  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) {
      alert('Vui lòng nhập chủ đề ôn tập cần tạo!');
      return;
    }

    soundEffects.playClick();
    setIsAiLoading(true);

    try {
      const generated = await aiService.generateQuiz({
        topic: aiTopic.trim(),
        subject,
        grade,
        questionCount: aiQuestionCount,
        difficulty: aiDifficulty,
      });

      setTitle(generated.quizTitle || `ÔN TẬP: ${aiTopic.toUpperCase()}`);

      const mappedQuestions: Question[] = generated.questions.map((q, idx) => ({
        id: 'gen-q-' + (idx + 1) + '-' + Date.now(),
        order: q.order || idx + 1,
        partType: 'part1_choice',
        content: q.content,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || 'Lời giải thích chuẩn theo chương trình SGK GDPT 2018.',
        points: 0.25,
      }));

      setQuestions(mappedQuestions);
      setPartBreakdown({ part1: mappedQuestions.length, part2: 0, part3: 0 });
      soundEffects.playCorrect();
    } catch (err: any) {
      alert('Lỗi tạo đề AI: ' + err?.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Parse Raw Text Action
  const handleParseText = () => {
    if (!rawText.trim()) {
      alert('Vui lòng dán văn bản câu hỏi vào khung!');
      return;
    }

    soundEffects.playClick();

    // Try circular 7991 parser first if text contains "PHẦN" or 3 parts
    if (/PHẦN\s*[I|1|II|2|III|3]/i.test(rawText)) {
      const parsed = parseCircular7991Html(rawText, title || 'ĐỀ DÁN VĂN BẢN THEO THÔNG TƯ 7991');
      if (parsed.questions.length > 0) {
        setQuestions(parsed.questions);
        setTitle(title || parsed.title);
        setPartBreakdown({
          part1: parsed.part1Count,
          part2: parsed.part2Count,
          part3: parsed.part3Count
        });
        soundEffects.playCorrect();
        alert(`Bóc tách Thông tư 7991 thành công: ${parsed.part1Count} câu Phần I, ${parsed.part2Count} câu Phần II, ${parsed.part3Count} câu Phần III!`);
        return;
      }
    }

    // Standard single-choice fallback
    const blocks = rawText.split(/(?:Câu\s*\d+[:.]|\n\s*\d+[:.])/i).filter(b => b.trim());
    const parsed: Question[] = [];

    blocks.forEach((blk, idx) => {
      const lines = blk.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length >= 2) {
        const questionText = lines[0];
        const optLines = lines.slice(1);
        const options = [
          { key: 'A' as OptionKey, text: optLines[0]?.replace(/^[A-Da-d][:.)]\s*/, '') || 'Đáp án A', isCorrect: true },
          { key: 'B' as OptionKey, text: optLines[1]?.replace(/^[A-Da-d][:.)]\s*/, '') || 'Đáp án B', isCorrect: false },
          { key: 'C' as OptionKey, text: optLines[2]?.replace(/^[A-Da-d][:.)]\s*/, '') || 'Đáp án C', isCorrect: false },
          { key: 'D' as OptionKey, text: optLines[3]?.replace(/^[A-Da-d][:.)]\s*/, '') || 'Đáp án D', isCorrect: false },
        ];

        parsed.push({
          id: 'parsed-q-' + (idx + 1) + '-' + Date.now(),
          order: idx + 1,
          partType: 'part1_choice',
          content: questionText,
          options,
          correctAnswer: 'A',
          explanation: 'Nhận diện tự động từ văn bản nạp vào.',
          points: 0.25,
        });
      }
    });

    if (parsed.length > 0) {
      setQuestions(parsed);
      setPartBreakdown({ part1: parsed.length, part2: 0, part3: 0 });
      setTitle(title || `ĐỀ TỰ ĐỘNG NHẬN DIỆN (${parsed.length} CÂU)`);
      soundEffects.playCorrect();
      alert(`Đã nhận diện thành công ${parsed.length} câu hỏi trắc nghiệm!`);
    } else {
      alert('Không nhận diện được câu hỏi. Hãy đảm bảo format dạng: "Câu 1: ... A. ... B. ... C. ... D. ..."');
    }
  };

  // Save Quiz
  const handleFinalSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Vui lòng nhập tên đề thi!');
      return;
    }

    soundEffects.playCorrect();

    const totalQ = questions.length;
    const bd = `${partBreakdown.part1}-${partBreakdown.part2}-${partBreakdown.part3}-0`;

    const created: Quiz = {
      id: 'quiz-' + Date.now(),
      title: title.trim(),
      fileName: (uploadedFileName || title.trim().replace(/\s+/g, '_').slice(0, 40)) + (uploadedFileName ? '' : '.docx'),
      subject,
      grade,
      createdAt: new Date().toLocaleDateString('vi-VN'),
      questionCount: totalQ || 28,
      breakdown: bd,
      durationMinutes,
      totalPoints: 10,
      folder: subject.toUpperCase(),
      isInteractive,
      questions: questions.length > 0 ? questions : [],
    };

    onSaveQuiz(created);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-700 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FileCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base">Tạo Đề Thi Mới Chuẩn Thông Tư 7991</h3>
                <span className="bg-emerald-400/30 text-emerald-100 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300/40">
                  3 Phần Chuẩn BGD&ĐT 2025
                </span>
              </div>
              <p className="text-xs text-teal-100">
                Nhận dạng đề Word (.docx) • Tự động bóc tách đáp án gạch chân • Trường THPT Mang Thít
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-200 shrink-0 bg-slate-50">
          <button
            onClick={() => setActiveTab('word')}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'word'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Tải File Word (.docx) Thông tư 7991</span>
          </button>

          <button
            onClick={() => setActiveTab('paste')}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'paste'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Edit3 className="w-4 h-4 text-blue-600" />
            <span>Dán Văn Bản Đề Thi</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'ai'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bot className="w-4 h-4 text-purple-600" />
            <span>AI Gemini Soạn Đề Tự Động</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs font-semibold flex-1">
          {/* TAB 1: WORD UPLOAD WITH CIRCULAR 7991 PARSER */}
          {activeTab === 'word' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleWordFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-teal-400 bg-teal-50/60 hover:bg-teal-50 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".docx"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleWordFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <div className="font-extrabold text-teal-950 text-sm">
                    {uploadedFileName ? `Tệp đã chọn: ${uploadedFileName}` : 'Bấm để chọn tệp Word (.docx) hoặc kéo thả vào đây'}
                  </div>
                  <p className="text-[11px] text-teal-700 mt-0.5">
                    Tự động nhận diện cấu trúc 3 phần theo <strong>Thông tư 7991</strong> của Bộ Giáo Dục & Đào Tạo
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                    <Check className="w-3 h-3 text-emerald-600" /> Phần I: Gạch chân <u>A.</u> <u>B.</u> <u>C.</u> <u>D.</u>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                    <Check className="w-3 h-3 text-emerald-600" /> Phần II: Gạch chân <u>a)</u> <u>b)</u> <u>c)</u> <u>d)</u>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                    <Check className="w-3 h-3 text-emerald-600" /> Phần III: Số 4 ký tự (A.1234)
                  </span>
                </div>
              </div>

              {/* Quick Sample Loader */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] text-slate-600">
                  Chưa có sẵn file Word trên máy? Bạn có thể nạp ngay đề thi mẫu chuẩn:
                </div>
                <button
                  type="button"
                  onClick={handleLoadSample7991}
                  className="btn-3d btn-3d-teal px-3 py-1.5 text-[11px] rounded-lg font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Nạp Đề Mẫu Chuẩn Thông Tư 7991</span>
                </button>
              </div>

              {/* Status indicator after parsing */}
              {questions.length > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-extrabold text-emerald-900">
                        Đã nhận diện thành công {questions.length} câu hỏi theo Thông tư 7991:
                      </span>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-emerald-700 font-bold">
                        <span>• Phần I: {partBreakdown.part1} câu</span>
                        <span>• Phần II (Đúng/Sai): {partBreakdown.part2} câu</span>
                        <span>• Phần III (Trả lời ngắn): {partBreakdown.part3} câu</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-200/70 text-emerald-900 px-2 py-1 rounded-md font-bold">
                    Mã tỉ lệ: {partBreakdown.part1}-{partBreakdown.part2}-{partBreakdown.part3}-0
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PASTE TEXT */}
          {activeTab === 'paste' && (
            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Dán nội dung văn bản đề thi (hỗ trợ cả định dạng Thông tư 7991):
                </label>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`PHẦN I. Câu hỏi trắc nghiệm nhiều phương án lựa chọn.
Câu 1: Biện pháp cải tạo đất phèn hiệu quả nhất?
A. Rải sỏi trắng
B. Bón vôi khử chua và thau rửa nước ngọt
C. Phun thuốc trừ sâu
D. Đốt rơm rạ

PHẦN II. Câu hỏi trắc nghiệm đúng sai.
Câu 1: Khi nghiên cứu đất trồng:
a) Đất có pH < 5 là đất chua.
b) Đất phù sa luôn có độ mặn cao.

PHẦN III. Câu hỏi trắc nghiệm trả lời ngắn.
Câu 1: Nhập mã số van điện tử an toàn 4 ký tự số:
A. 1234`}
                  className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 bg-slate-50 focus:bg-white"
                ></textarea>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleParseText}
                  className="btn-3d btn-3d-blue flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tự Động Bóc Tách Câu Hỏi & Đáp Án</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadSample7991}
                  className="btn-3d btn-3d-slate px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Dán Đề Mẫu
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: AI GEMINI GENERATOR */}
          {activeTab === 'ai' && (
            <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-teal-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>Ra đề nhanh với AI Gemini</span>
                </span>
                <span className="text-[10px] bg-teal-200/60 text-teal-900 font-mono font-bold px-2 py-0.5 rounded-md">
                  Gemini 3.8 Flash
                </span>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">Chủ đề / Bài học ôn tập:</label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="Ví dụ: Đất phèn, đất mặn và kỹ thuật cải tạo đất trồng nông nghiệp"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Số lượng câu hỏi:</label>
                  <select
                    value={aiQuestionCount}
                    onChange={(e) => setAiQuestionCount(parseInt(e.target.value, 10) || 5)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500"
                  >
                    <option value={3}>3 câu hỏi nhanh</option>
                    <option value={5}>5 câu hỏi tiêu chuẩn</option>
                    <option value={10}>10 câu hỏi kiểm tra 15p</option>
                    <option value={18}>18 câu chuẩn Phần I</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Mức độ phân hóa:</label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500"
                  >
                    <option value="Nhận biết & Thông hiểu">Nhận biết & Thông hiểu</option>
                    <option value="Thông hiểu & Vận dụng">Thông hiểu & Vận dụng</option>
                    <option value="Vận dụng cao">Vận dụng cao</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAIGenerate}
                disabled={isAiLoading}
                className="btn-3d btn-3d-teal w-full py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Wand2 className={`w-4 h-4 ${isAiLoading ? 'animate-spin' : ''}`} />
                <span>{isAiLoading ? 'AI đang biên soạn câu hỏi & đáp án...' : 'AI Gemini Biên Soạn Ngay'}</span>
              </button>
            </div>
          )}

          {/* Common Exam Settings */}
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <div>
              <label className="block text-slate-700 mb-1 font-bold">Tên đề thi hiển thị:</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: ÔN TẬP CÔNG NGHỆ NÔNG NGHIỆP 12"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Môn học:</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500"
                >
                  <option value="Công nghệ 12">Công nghệ 12</option>
                  <option value="Công nghệ 10">Công nghệ 10</option>
                  <option value="Sinh học 11">Sinh học 11</option>
                  <option value="Sinh học 12">Sinh học 12</option>
                  <option value="Toán học 12">Toán học 12</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">Thời gian làm bài:</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 50)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500"
                  />
                  <span className="text-slate-500">phút</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <input
                type="checkbox"
                id="isInteractiveModal"
                checked={isInteractive}
                onChange={(e) => setIsInteractive(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded"
              />
              <label htmlFor="isInteractiveModal" className="text-xs text-slate-700 cursor-pointer">
                Kích hoạt chế độ <strong>Game học tập tương tác 3D</strong> (cho phép học sinh đấu trường)
              </label>
            </div>
          </div>

          {/* Generated Questions Preview conformed to Thông tư 7991 */}
          {questions.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-xs">
                  Danh sách câu hỏi đã nhận diện ({questions.length} câu):
                </span>
                <span className="text-[10px] text-teal-800 font-bold bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                  Đáp án nhận diện qua gạch chân
                </span>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-slate-900">
                        <span className="text-teal-700 font-black mr-1">Câu {idx + 1}:</span>
                        {q.content}
                      </div>
                      <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded-sm bg-slate-200 text-slate-700 shrink-0">
                        {q.partType === 'part1_choice'
                          ? 'Phần I'
                          : q.partType === 'part2_true_false'
                          ? 'Phần II (Đ/S)'
                          : 'Phần III (4 số)'}
                      </span>
                    </div>

                    {/* Phần I Options */}
                    {q.partType === 'part1_choice' && q.options && (
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                        {q.options.map((opt) => (
                          <div
                            key={opt.key}
                            className={`p-1.5 rounded-lg border ${
                              opt.key === q.correctAnswer
                                ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950 font-bold'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <span className="font-black mr-1">{opt.key}.</span>
                            {opt.text}
                            {opt.key === q.correctAnswer && (
                              <span className="ml-1 text-[10px] text-emerald-800 font-black">
                                (Đúng - Gạch chân)
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Phần II Sub-items (Đúng / Sai) */}
                    {q.partType === 'part2_true_false' && q.subItems && (
                      <div className="space-y-1 text-[11px]">
                        {q.subItems.map((si) => (
                          <div
                            key={si.key}
                            className={`p-1.5 rounded-lg border flex items-center justify-between ${
                              si.isCorrect
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <div>
                              <span className="font-black mr-1.5">{si.key})</span>
                              {si.content}
                            </div>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                si.isCorrect ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {si.isCorrect ? 'ĐÚNG (Gạch chân)' : 'SAI'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Phần III Short answer (4 characters numeric) */}
                    {q.partType === 'part3_short_answer' && (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-[11px]">
                        <span className="text-blue-900">
                          Đáp án số 4 ký tự: <strong className="font-mono text-sm">{q.shortAnswerCorrect || '1234'}</strong>
                        </span>
                        <span className="text-[10px] bg-blue-200/60 text-blue-900 font-bold px-2 py-0.5 rounded-md">
                          Mặc định A.1234
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-3d btn-3d-slate px-4 py-2 text-xs rounded-xl cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleFinalSave}
            className="btn-3d btn-3d-teal px-6 py-2 text-xs rounded-xl cursor-pointer font-bold shadow-md flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Lưu & Xuất Bản Đề Thi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
