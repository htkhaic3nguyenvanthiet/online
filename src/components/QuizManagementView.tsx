import React, { useState } from 'react';
import {
  Folder,
  FileText,
  Search,
  FolderPlus,
  Plus,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
  Trash2,
  Sparkles,
  CheckCircle,
  Upload,
  Download,
  Copy,
  Edit3
} from 'lucide-react';
import { Quiz } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';

interface QuizManagementViewProps {
  quizzes: Quiz[];
  onCreateQuiz: () => void;
  onDeployQuiz: (quiz: Quiz) => void;
  onPreviewQuiz: (quiz: Quiz) => void;
  onEditQuiz: (quiz: Quiz) => void;
  onDuplicateQuiz: (quiz: Quiz) => void;
  onDeleteQuiz: (quizId: string) => void;
}

export const QuizManagementView: React.FC<QuizManagementViewProps> = ({
  quizzes,
  onCreateQuiz,
  onDeployQuiz,
  onPreviewQuiz,
  onEditQuiz,
  onDuplicateQuiz,
  onDeleteQuiz
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [customFolders, setCustomFolders] = useState<string[]>([
    'CÔNG NGHỆ 12',
    'CÔNG NGHỆ 10',
    'SINH HỌC 11',
    'TOÁN HỌC 12'
  ]);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const filteredQuizzes = quizzes.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFolder = selectedFolder ? q.folder === selectedFolder : true;
    return matchesSearch && matchesFolder;
  });

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    soundEffects.playClick();
    const formatted = newFolderName.trim().toUpperCase();
    if (!customFolders.includes(formatted)) {
      setCustomFolders((prev) => [...prev, formatted]);
    }
    setSelectedFolder(formatted);
    setNewFolderName('');
    setIsFolderModalOpen(false);
    soundEffects.playCorrect();
  };

  const handleDownloadQuizFile = (quiz: Quiz) => {
    soundEffects.playClick();
    const content = `TRƯỜNG THPT MANG THÍT - ĐỀ THI TRẮC NGHIỆM
Tác giả: Hồ Tấn Khải
Tên đề: ${quiz.title}
Môn học: ${quiz.subject} (${quiz.grade})
Thời gian làm bài: ${quiz.durationMinutes} phút
Tổng số câu: ${quiz.questionCount} câu

${quiz.questions?.map((q, idx) => `
Câu ${idx + 1}: ${q.content}
${q.options ? q.options.map(o => `  ${o.key}. ${o.text}`).join('\n') : q.subItems ? q.subItems.map(si => `  ${si.key}) ${si.content} [${si.isCorrect ? 'ĐÚNG' : 'SAI'}]`).join('\n') : `  Đáp án 4 ký tự: ${q.shortAnswerCorrect || '1234'}`}
=> Đáp án chuẩn: ${q.correctAnswer || q.shortAnswerCorrect || 'A'}
=> Hướng dẫn giải: ${q.explanation || 'Theo Thông tư 7991 BGD&ĐT.'}
`).join('\n----------------------------------------\n') || 'Nội dung câu hỏi đang được biên tập.'}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz.fileName.replace('.docx', '')}_THPT_MangThit.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    soundEffects.playCorrect();
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Search Bar Matching Screenshot 2 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Quản lý đề kiểm tra</h1>
          <p className="text-xs text-slate-500 mt-0.5">Kho lưu trữ đề thi, bài tập và ngân hàng câu hỏi • Tác giả: Hồ Tấn Khải</p>
        </div>

        {/* Action Bar with 3D buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search box with 3D button */}
          <div className="flex items-center">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nhập tên đề..."
              className="bg-white border border-slate-300 rounded-l-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500 w-44 sm:w-56 font-medium"
            />
            <button
              onClick={() => soundEffects.playClick()}
              className="btn-3d btn-3d-teal px-3 py-1.5 text-xs rounded-r-xl rounded-l-none cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* 3D Button: Tạo mới thư mục */}
          <button
            onClick={() => {
              soundEffects.playClick();
              setIsFolderModalOpen(true);
            }}
            className="btn-3d btn-3d-slate px-3.5 py-1.5 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <FolderPlus className="w-4 h-4 text-teal-600" />
            <span>Tạo mới thư mục</span>
          </button>

          {/* 3D Button: Tải file Word */}
          <button
            onClick={() => {
              soundEffects.playClick();
              onCreateQuiz();
            }}
            className="btn-3d btn-3d-slate px-3.5 py-1.5 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold border border-emerald-300 text-emerald-800 bg-emerald-50"
            title="Tải lên tệp Word (.docx) nhận dạng 3 phần Thông tư 7991"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Upload Word 7991</span>
          </button>

          {/* 3D Button: Tạo mới đề */}
          <button
            onClick={() => {
              soundEffects.playClick();
              onCreateQuiz();
            }}
            className="btn-3d btn-3d-teal px-4 py-1.5 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo mới đề</span>
          </button>
        </div>
      </div>

      {/* Section: Được đề xuất (Featured Carousel matching screenshot 2) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Được đề xuất</span>
          <div className="flex items-center gap-1 text-slate-400">
            <button className="p-1 hover:text-slate-700"><ChevronLeft className="w-4 h-4" /></button>
            <button className="p-1 hover:text-slate-700"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {quizzes.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="card-3d card-3d-blue p-4 flex flex-col justify-between group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-xs text-slate-800 truncate group-hover:text-teal-700 transition-colors" title={item.title}>
                    {item.title}
                  </h4>
                  <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                    <div>Ngày tạo: {item.createdAt}</div>
                    <div className="font-mono text-teal-700 font-semibold">Số câu: {item.breakdown}</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                  {item.subject}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      onEditQuiz(item);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600 rounded-md cursor-pointer"
                    title="Chỉnh sửa câu hỏi"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      onPreviewQuiz(item);
                    }}
                    className="p-1 text-slate-400 hover:text-teal-600 rounded-md cursor-pointer"
                    title="Xem chi tiết"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      onDeployQuiz(item);
                    }}
                    className="btn-3d btn-3d-teal px-2 py-0.5 text-[11px] rounded-lg flex items-center gap-1 cursor-pointer"
                    title="Giao đề trực tuyến"
                  >
                    <Send className="w-3 h-3" />
                    <span>Giao đề</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Tất cả (Table matching Screenshot 2) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900">
              {selectedFolder ? `Thư mục: ${selectedFolder}` : 'Tất cả đề thi'}
            </span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {filteredQuizzes.length} đề
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedFolder && (
              <button
                onClick={() => setSelectedFolder(null)}
                className="text-xs text-teal-600 hover:underline font-semibold"
              >
                ← Xem toàn bộ
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-5">Tên đề ↑</th>
                <th className="py-3 px-5">Ngày tạo</th>
                <th className="py-3 px-5">Số câu</th>
                <th className="py-3 px-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {/* Folder list when at root */}
              {!selectedFolder && customFolders.map((folderName) => (
                <tr
                  key={folderName}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer font-bold"
                >
                  <td
                    onClick={() => {
                      soundEffects.playClick();
                      setSelectedFolder(folderName);
                    }}
                    className="py-3.5 px-5 flex items-center gap-2.5 text-slate-900"
                  >
                    <Folder className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>{folderName}</span>
                  </td>
                  <td className="py-3.5 px-5 text-slate-400">—</td>
                  <td className="py-3.5 px-5 text-slate-400 font-mono">
                    {quizzes.filter(q => q.folder === folderName).length} đề
                  </td>
                  <td className="py-3.5 px-5 text-right text-slate-400 text-[11px]">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEffects.playClick();
                          setSelectedFolder(folderName);
                        }}
                        className="text-teal-600 hover:underline font-semibold"
                      >
                        Mở thư mục →
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEffects.playClick();
                          if (confirm(`Bạn có chắc chắn muốn xóa thư mục "${folderName}"?`)) {
                            setCustomFolders((prev) => prev.filter((f) => f !== folderName));
                            soundEffects.playCorrect();
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Xóa thư mục này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Quizzes items */}
              {filteredQuizzes.map((quiz) => (
                <tr key={quiz.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                      <div>
                        <span
                          className="font-semibold text-slate-900 hover:text-teal-700 cursor-pointer"
                          onClick={() => onPreviewQuiz(quiz)}
                        >
                          {quiz.fileName}
                        </span>
                        {quiz.isInteractive && (
                          <span className="ml-2 text-[10px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded-sm">
                            Tương tác 3D
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-slate-600 font-mono">{quiz.createdAt}</td>
                  <td className="py-3.5 px-5">
                    <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="text-emerald-700 font-black">
                        {(quiz.questions && quiz.questions.length > 0) ? quiz.questions.length : quiz.questionCount} câu
                      </span>
                      <span className="text-[10px] bg-teal-50 text-teal-700 font-mono px-1.5 py-0.5 rounded-md border border-teal-200">
                        {quiz.breakdown || `${quiz.questionCount}-0-0-0`}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          onDeployQuiz(quiz);
                        }}
                        className="btn-3d btn-3d-teal px-2.5 py-1 text-[11px] rounded-lg cursor-pointer flex items-center gap-1 font-bold"
                        title="Giao đề cho học sinh"
                      >
                        <Send className="w-3 h-3" />
                        <span>Giao đề</span>
                      </button>

                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          onEditQuiz(quiz);
                        }}
                        className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Chỉnh sửa câu hỏi"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          onDuplicateQuiz(quiz);
                        }}
                        className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Nhân bản đề này"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDownloadQuizFile(quiz)}
                        className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Tải tệp đề thi (.txt / Word)"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          onPreviewQuiz(quiz);
                        }}
                        className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Làm thử / Xem câu hỏi"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          if (confirm(`Bạn có chắc chắn muốn xóa đề thi: "${quiz.title}"?`)) {
                            onDeleteQuiz(quiz.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Xóa đề"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">Tạo Thư Mục Đề Thi Mới</h3>
            <form onSubmit={handleCreateFolder} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Tên thư mục:</label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ví dụ: CÔNG NGHỆ 11 HK2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-teal-500 uppercase font-bold"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="btn-3d btn-3d-slate px-3.5 py-1.5 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-3d btn-3d-teal px-4 py-1.5 rounded-xl font-bold cursor-pointer"
                >
                  Tạo Thư Mục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
