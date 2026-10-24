import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
  Clock,
  Sparkles,
  Bot
} from 'lucide-react';
import { Quiz, Question, OptionKey } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';

interface EditQuizModalProps {
  quiz: Quiz | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedQuiz: Quiz) => void;
}

export const EditQuizModal: React.FC<EditQuizModalProps> = ({
  quiz,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !quiz) return null;

  const [title, setTitle] = useState(quiz.title);
  const [durationMinutes, setDurationMinutes] = useState(quiz.durationMinutes);
  const [subject, setSubject] = useState(quiz.subject);
  const [questions, setQuestions] = useState<Question[]>(
    quiz.questions && quiz.questions.length > 0
      ? quiz.questions
      : [
          {
            id: 'sample-q1',
            order: 1,
            content: 'Nội dung câu hỏi ôn tập chuyên đề?',
            options: [
              { key: 'A', text: 'Phương án A chính xác', isCorrect: true },
              { key: 'B', text: 'Phương án B', isCorrect: false },
              { key: 'C', text: 'Phương án C', isCorrect: false },
              { key: 'D', text: 'Phương án D', isCorrect: false },
            ],
            correctAnswer: 'A',
            explanation: 'Giải thích chi tiết phương án.',
            points: 1,
          },
        ]
  );

  const [newQuestionText, setNewQuestionText] = useState('');
  const [newOptA, setNewOptA] = useState('');
  const [newOptB, setNewOptB] = useState('');
  const [newOptC, setNewOptC] = useState('');
  const [newOptD, setNewOptD] = useState('');
  const [newCorrect, setNewCorrect] = useState<OptionKey>('A');

  const handleAddQuestion = () => {
    if (!newQuestionText.trim() || !newOptA.trim() || !newOptB.trim()) {
      alert('Vui lòng nhập nội dung câu hỏi và ít nhất 2 đáp án A, B!');
      return;
    }

    soundEffects.playClick();
    const newQ: Question = {
      id: 'custom-q-' + Date.now(),
      order: questions.length + 1,
      content: newQuestionText.trim(),
      options: [
        { key: 'A', text: newOptA.trim(), isCorrect: newCorrect === 'A' },
        { key: 'B', text: newOptB.trim(), isCorrect: newCorrect === 'B' },
        { key: 'C', text: newOptC.trim() || 'Phương án C', isCorrect: newCorrect === 'C' },
        { key: 'D', text: newOptD.trim() || 'Phương án D', isCorrect: newCorrect === 'D' },
      ],
      correctAnswer: newCorrect,
      explanation: 'Câu hỏi được giáo viên bổ sung trực tiếp trên hệ thống.',
      points: 1,
    };

    setQuestions((prev) => [...prev, newQ]);
    setNewQuestionText('');
    setNewOptA('');
    setNewOptB('');
    setNewOptC('');
    setNewOptD('');
    soundEffects.playCorrect();
  };

  const handleDeleteQuestion = (qId: string) => {
    soundEffects.playClick();
    setQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  const handleSaveAll = () => {
    soundEffects.playClick();
    const updated: Quiz = {
      ...quiz,
      title: title.trim(),
      durationMinutes,
      subject,
      questionCount: questions.length,
      breakdown: `${questions.length}-0-0-0`,
      questions,
    };
    onSave(updated);
    soundEffects.playCorrect();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-teal-700 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-white" />
            <div>
              <h3 className="font-extrabold text-base">Chỉnh Sửa Đề Thi: {quiz.title}</h3>
              <p className="text-xs text-blue-100">Thay đổi câu hỏi, đáp án đúng và thời gian thi</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs font-semibold flex-1">
          {/* Metadata Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 mb-1 font-bold">Tên đề thi:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:border-teal-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-bold">Thời gian (phút):</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 45)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:border-teal-500"
              />
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 text-sm">
                Danh sách câu hỏi trong đề ({questions.length} câu):
              </span>
            </div>

            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={q.id || idx} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-bold text-slate-900 text-xs">
                      Câu {idx + 1}: {q.content}
                    </div>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-lg cursor-pointer"
                      title="Xóa câu hỏi này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {q.options.map((opt) => (
                      <div
                        key={opt.key}
                        className={`p-2 rounded-xl border ${
                          opt.key === q.correctAnswer
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="font-mono font-bold mr-1">{opt.key}.</span> {opt.text}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add New Question Section */}
          <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-2xl space-y-3">
            <h4 className="font-extrabold text-teal-900 text-xs flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-teal-700" />
              <span>Thêm câu hỏi mới vào đề</span>
            </h4>

            <div>
              <label className="block text-slate-700 mb-1 font-bold">Nội dung câu hỏi:</label>
              <input
                type="text"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="Nhập nội dung câu hỏi trắc nghiệm mới..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 mb-0.5">Đáp án A:</label>
                <input
                  type="text"
                  value={newOptA}
                  onChange={(e) => setNewOptA(e.target.value)}
                  placeholder="Phương án A"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-0.5">Đáp án B:</label>
                <input
                  type="text"
                  value={newOptB}
                  onChange={(e) => setNewOptB(e.target.value)}
                  placeholder="Phương án B"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-0.5">Đáp án C:</label>
                <input
                  type="text"
                  value={newOptC}
                  onChange={(e) => setNewOptC(e.target.value)}
                  placeholder="Phương án C"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-0.5">Đáp án D:</label>
                <input
                  type="text"
                  value={newOptD}
                  onChange={(e) => setNewOptD(e.target.value)}
                  placeholder="Phương án D"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Đáp án đúng:</span>
                {(['A', 'B', 'C', 'D'] as OptionKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setNewCorrect(key)}
                    className={`w-7 h-7 rounded-lg font-bold text-xs cursor-pointer ${
                      newCorrect === key
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddQuestion}
                className="btn-3d btn-3d-teal px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
              >
                + Thêm vào đề
              </button>
            </div>
          </div>
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
            onClick={handleSaveAll}
            className="btn-3d btn-3d-teal px-6 py-2 text-xs rounded-xl cursor-pointer font-bold shadow-md"
          >
            Lưu Các Thay Đổi
          </button>
        </div>
      </div>
    </div>
  );
};
