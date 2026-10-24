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
  Download
} from 'lucide-react';
import { Quiz } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';

interface QuizManagementViewProps {
  quizzes: Quiz[];
  onCreateQuiz: () => void;
  onDeployQuiz: (quiz: Quiz) => void;
  onPreviewQuiz: (quiz: Quiz) => void;
  onDeleteQuiz: (quizId: string) => void;
}

export const QuizManagementView: React.FC<QuizManagementViewProps> = ({
  quizzes,
  onCreateQuiz,
  onDeployQuiz,
  onPreviewQuiz,
  onDeleteQuiz
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const filteredQuizzes = quizzes.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFolder = selectedFolder ? q.folder === selectedFolder : true;
    return matchesSearch && matchesFolder;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Search Bar Matching Screenshot 2 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Quản lý đề kiểm tra</h1>
          <p className="text-xs text-slate-500 mt-0.5">Kho lưu trữ đề thi, bài tập và ngân hàng câu hỏi</p>
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
              className="bg-white border border-slate-300 rounded-l-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500 w-44 sm:w-56"
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
              alert('Tính năng: Đã tạo thư mục mới để phân loại đề thi theo khối lớp!');
            }}
            className="btn-3d btn-3d-slate px-3.5 py-1.5 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-teal-600" />
            <span>Tạo mới thư mục</span>
          </button>

          {/* 3D Button: Tạo mới đề */}
          <button
            onClick={() => {
              soundEffects.playClick();
              onCreateQuiz();
            }}
            className="btn-3d btn-3d-teal px-4 py-1.5 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
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
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900">Tất cả đề thi</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {filteredQuizzes.length} mục
            </span>
          </div>

          {selectedFolder && (
            <button
              onClick={() => setSelectedFolder(null)}
              className="text-xs text-teal-600 hover:underline font-semibold"
            >
              ← Quay lại thư mục gốc
            </button>
          )}
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
              {/* Folder entry matching screenshot: "CÔNG NGHỆ 12" */}
              {!selectedFolder && (
                <tr
                  onClick={() => {
                    soundEffects.playClick();
                    setSelectedFolder('CÔNG NGHỆ 12');
                  }}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer font-bold"
                >
                  <td className="py-3.5 px-5 flex items-center gap-2.5 text-slate-900">
                    <Folder className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>CÔNG NGHỆ 12</span>
                  </td>
                  <td className="py-3.5 px-5 text-slate-400">—</td>
                  <td className="py-3.5 px-5 text-slate-400">—</td>
                  <td className="py-3.5 px-5 text-right">
                    <button className="p-1 text-slate-400 hover:text-slate-600">
                      <MoreVertical className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              )}

              {/* Quizzes items matching screenshot 2 */}
              {filteredQuizzes.map((quiz) => (
                <tr key={quiz.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-900 hover:text-teal-700 cursor-pointer" onClick={() => onPreviewQuiz(quiz)}>
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
                  <td className="py-3.5 px-5 font-mono font-semibold text-teal-800">{quiz.breakdown}</td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          onDeployQuiz(quiz);
                        }}
                        className="btn-3d btn-3d-teal px-2.5 py-1 text-[11px] rounded-lg cursor-pointer flex items-center gap-1"
                        title="Giao đề cho học sinh"
                      >
                        <Send className="w-3 h-3" />
                        <span>Giao đề</span>
                      </button>
                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          onPreviewQuiz(quiz);
                        }}
                        className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Xem câu hỏi"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          onDeleteQuiz(quiz.id);
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
    </div>
  );
};
