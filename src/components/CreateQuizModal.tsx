import React, { useState } from 'react';
import {
  X,
  Plus,
  Upload,
  Sparkles,
  FileText,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { Quiz, Question, OptionKey } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';

interface CreateQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveQuiz: (newQuiz: Quiz) => void;
}

export const CreateQuizModal: React.FC<CreateQuizModalProps> = ({
  isOpen,
  onClose,
  onSaveQuiz
}) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Công nghệ 12');
  const [grade, setGrade] = useState('Lớp 12');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [isInteractive, setIsInteractive] = useState(true);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    soundEffects.playCorrect();

    const created: Quiz = {
      id: 'quiz-' + Date.now(),
      title: title.trim(),
      fileName: title.trim().replace(/\s+/g, '_') + '.docx',
      subject,
      grade,
      createdAt: new Date().toLocaleDateString('vi-VN'),
      questionCount: 30,
      breakdown: '25-5-0-0',
      durationMinutes,
      totalPoints: 10,
      folder: subject.toUpperCase(),
      isInteractive,
      questions: []
    };

    onSaveQuiz(created);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-gradient-to-r from-teal-700 to-emerald-700 p-5 text-white flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base">Tạo Mới Đề Thi & Kiểm Tra</h3>
            <p className="text-xs text-teal-100">Hỗ trợ nhập trực tiếp hoặc tải file Word .docx</p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs font-semibold">
          <div>
            <label className="block text-slate-700 mb-1 font-bold">Tên đề thi / Bài kiểm tra:</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: ÔN TẬP ĐẤT TRỒNG VÀ PHÂN BÓN HỌC KỲ II"
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
                <option value="Hóa học 11">Hóa học 11</option>
                <option value="Toán học 12">Toán học 12</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-bold">Thời gian làm bài:</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 45)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500"
                />
                <span className="text-slate-500">phút</span>
              </div>
            </div>
          </div>

          {/* Word Docx Upload Box */}
          <div className="border-2 border-dashed border-teal-300 bg-teal-50/50 rounded-2xl p-4 text-center cursor-pointer hover:bg-teal-50 transition-colors">
            <Upload className="w-6 h-6 text-teal-600 mx-auto mb-1" />
            <div className="font-bold text-teal-900">Kéo thả file Word (.docx) vào đây</div>
            <div className="text-[11px] text-teal-600 mt-0.5">Tự động nhận diện câu hỏi, 4 đáp án và bảng đáp án</div>
          </div>

          {/* Interactive Checkbox */}
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              id="isInteractive"
              checked={isInteractive}
              onChange={(e) => setIsInteractive(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded"
            />
            <label htmlFor="isInteractive" className="text-xs text-slate-700 cursor-pointer">
              Bật chế độ <strong>Game học tập tương tác 3D</strong> (cho phép học sinh đấu trường thời gian thực)
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-3d-slate px-4 py-2 text-xs rounded-xl cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn-3d btn-3d-teal px-5 py-2 text-xs rounded-xl cursor-pointer font-bold"
            >
              Lưu & Xuất Bản Đề
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
