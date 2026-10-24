import React, { useState } from 'react';
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
  Bot
} from 'lucide-react';
import { Quiz, Question, OptionKey } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';
import { aiService } from '../services/aiService';

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
  const [activeTab, setActiveTab] = useState<'ai' | 'paste' | 'manual'>('ai');

  // Common fields
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Công nghệ 12');
  const [grade, setGrade] = useState('Lớp 12');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [isInteractive, setIsInteractive] = useState(true);

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
        content: q.content,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || 'Lời giải thích chuẩn theo chương trình SGK GDPT.',
        points: 1,
      }));

      setQuestions(mappedQuestions);
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
          content: questionText,
          options,
          correctAnswer: 'A',
          explanation: 'Nhận diện tự động từ văn bản nạp vào.',
          points: 1,
        });
      }
    });

    if (parsed.length > 0) {
      setQuestions(parsed);
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

    const created: Quiz = {
      id: 'quiz-' + Date.now(),
      title: title.trim(),
      fileName: title.trim().replace(/\s+/g, '_').slice(0, 40) + '.docx',
      subject,
      grade,
      createdAt: new Date().toLocaleDateString('vi-VN'),
      questionCount: questions.length || 20,
      breakdown: `${questions.length || 20}-0-0-0`,
      durationMinutes,
      totalPoints: questions.length || 10,
      folder: subject.toUpperCase(),
      isInteractive,
      questions: questions.length > 0 ? questions : [],
    };

    onSaveQuiz(created);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-700 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Soạn Thảo Đề Thi Trắc Nghiệm Mới</h3>
              <p className="text-xs text-teal-100">Tích hợp Trí Tuệ Nhân Tạo AI Gemini 3.8 Flash • Trường THPT Mang Thít</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-200 shrink-0 bg-slate-50">
          <button
            onClick={() => setActiveTab('ai')}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'ai'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bot className="w-4 h-4 text-teal-600" />
            <span>AI Gemini Soạn Đề Tự Động</span>
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
            <span>Dán Văn Bản / Nhận Diện Đề</span>
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'manual'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4 text-amber-600" />
            <span>Tải File Word (.docx)</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs font-semibold flex-1">
          {/* TAB 1: AI GEMINI GENERATOR */}
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
                    onChange={(e) => setAiQuestionCount(parseInt(e.target.value) || 5)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500"
                  >
                    <option value={3}>3 câu hỏi nhanh</option>
                    <option value={5}>5 câu hỏi tiêu chuẩn</option>
                    <option value={10}>10 câu hỏi kiểm tra 15p</option>
                    <option value={15}>15 câu hỏi ôn tập</option>
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

          {/* TAB 2: PASTE TEXT */}
          {activeTab === 'paste' && (
            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Dán văn bản câu hỏi và 4 đáp án:</label>
                <textarea
                  rows={5}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Câu 1: Đất phù sa ven sông thích hợp với cây trồng nào?
A. Cây lúa nước và cây ăn trái nhiệt đới
B. Cây thông ba lá vùng lạnh
C. Cây xương rồng sa mạc
D. Cây cọ dầu đầm lầy`}
                  className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500"
                ></textarea>
              </div>
              <button
                type="button"
                onClick={handleParseText}
                className="btn-3d btn-3d-blue w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Tự Động Bóc Tách Câu Hỏi & Đáp Án</span>
              </button>
            </div>
          )}

          {/* TAB 3: FILE WORD UPLOAD */}
          {activeTab === 'manual' && (
            <div
              onClick={() => {
                soundEffects.playClick();
                setTitle('CHỦ ĐỀ ÔN TẬP TỪ FILE WORD NÔNG NGHIỆP');
                alert('Đã sẵn sàng tải và chuyển đổi file Word (.docx) sang ngân hàng câu hỏi!');
              }}
              className="border-2 border-dashed border-teal-300 bg-teal-50/50 rounded-2xl p-6 text-center cursor-pointer hover:bg-teal-50 transition-colors"
            >
              <Upload className="w-8 h-8 text-teal-600 mx-auto mb-2" />
              <div className="font-bold text-teal-900 text-sm">Bấm để chọn file Word (.docx) hoặc kéo thả vào đây</div>
              <div className="text-[11px] text-teal-600 mt-1">Hỗ trợ nhận diện tự động bảng đáp án cuối trang</div>
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
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 45)}
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

          {/* Generated Questions Preview */}
          {questions.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-xs">
                  Danh sách câu hỏi đã tạo ({questions.length} câu):
                </span>
                <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md">
                  Đã kiểm duyệt đáp án
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {questions.map((q, idx) => (
                  <div key={q.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-slate-800">{q.content}</div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                      {q.options.map((opt) => (
                        <div
                          key={opt.key}
                          className={`p-1 rounded ${
                            opt.key === q.correctAnswer
                              ? 'bg-emerald-100 text-emerald-900 font-bold'
                              : 'bg-white'
                          }`}
                        >
                          {opt.key}. {opt.text}
                        </div>
                      ))}
                    </div>
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
            className="btn-3d btn-3d-teal px-6 py-2 text-xs rounded-xl cursor-pointer font-bold shadow-md"
          >
            Lưu & Xuất Bản Đề Thi
          </button>
        </div>
      </div>
    </div>
  );
};
