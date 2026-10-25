import React, { useState } from 'react';
import {
  Folder,
  FileText,
  Search,
  Download,
  Share2,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Plus,
  Trash2,
  X,
  Upload
} from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface SharedContentStoreViewProps {
  onImportToMyLibrary: (title: string, subject: string, questionsCount: number) => void;
}

interface SharedQuizItem {
  id: string;
  grade: number;
  title: string;
  date: string;
  questions: number;
  subject: string;
  author: string;
}

export const SharedContentStoreView: React.FC<SharedContentStoreViewProps> = ({
  onImportToMyLibrary
}) => {
  const [activeTab, setActiveTab] = useState<'2018' | 'game'>('2018');
  const [selectedGrade, setSelectedGrade] = useState<number | null>(12);
  const [searchQuery, setSearchQuery] = useState('');

  const grades = [6, 7, 8, 9, 10, 11, 12];

  const [sharedQuizzes, setSharedQuizzes] = useState<SharedQuizItem[]>([
    { id: 'sq1', grade: 12, title: 'Đề thi thử Tốt nghiệp THPT 2026 môn Sinh học - Đề số 1', date: '18/10/2026', questions: 28, subject: 'Sinh học', author: 'Sở GD&ĐT Vĩnh Long' },
    { id: 'sq2', grade: 12, title: 'Chuyên đề Công nghệ Nông nghiệp 12 - Thông tư 7991', date: '15/10/2026', questions: 28, subject: 'Công nghệ', author: 'Thầy Hồ Tấn Khải (THPT Mang Thít)' },
    { id: 'sq3', grade: 12, title: 'Ngân hàng 200 câu hỏi ôn tập Hóa học Hữu cơ 12', date: '12/10/2026', questions: 50, subject: 'Hóa học', author: 'Tổ Chuyên môn THPT Mang Thít' },
    { id: 'sq4', grade: 11, title: 'Kiểm tra giữa kỳ I Công nghệ 11 - Cơ khí & Điện tử', date: '05/10/2026', questions: 30, subject: 'Công nghệ', author: 'Tổ Công nghệ THPT Mang Thít' },
    { id: 'sq5', grade: 10, title: 'Khảo sát chất lượng đầu năm môn Toán 10', date: '28/09/2026', questions: 35, subject: 'Toán học', author: 'Test Online THPT Mang Thít' }
  ]);

  // Modal create state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('Công nghệ 12');
  const [newGrade, setNewGrade] = useState(12);
  const [newQuestionsCount, setNewQuestionsCount] = useState(28);

  const filtered = sharedQuizzes.filter(item => {
    const matchesGrade = selectedGrade ? item.grade === selectedGrade : true;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGrade && matchesSearch;
  });

  const handleCreateNewShared = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    soundEffects.playClick();
    const created: SharedQuizItem = {
      id: 'sq-' + Date.now(),
      grade: newGrade,
      title: newTitle.trim(),
      date: new Date().toLocaleDateString('vi-VN'),
      questions: newQuestionsCount,
      subject: newSubject,
      author: 'Thầy Hồ Tấn Khải (THPT Mang Thít)'
    };

    setSharedQuizzes(prev => [created, ...prev]);
    setIsCreateModalOpen(false);
    setNewTitle('');
    soundEffects.playCorrect();
  };

  const handleDeleteShared = (id: string, title: string) => {
    soundEffects.playClick();
    if (confirm(`Bạn có chắc chắn muốn xóa đề "${title}" khỏi Kho chia sẻ?`)) {
      setSharedQuizzes(prev => prev.filter(q => q.id !== id));
      soundEffects.playCorrect();
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Kho đề được chia sẻ bởi Test Online</h1>
          <p className="text-xs text-slate-500 mt-0.5">Tác giả: Hồ Tấn Khải - Trường THPT Mang Thít • Ngân hàng đề thi chuẩn CT GDPT 2018 & TT 7991</p>
        </div>

        {/* Action Buttons: Tìm kiếm + Tạo mới */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên..."
              className="bg-white border border-slate-300 rounded-l-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500 w-44 sm:w-56"
            />
            <button
              onClick={() => soundEffects.playClick()}
              className="btn-3d btn-3d-teal px-3 py-1.5 text-xs rounded-r-xl rounded-l-none cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              soundEffects.playClick();
              setIsCreateModalOpen(true);
            }}
            className="btn-3d btn-3d-teal px-4 py-1.5 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo mới đề vào kho</span>
          </button>
        </div>
      </div>

      {/* Navigation Mode Pill Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            soundEffects.playClick();
            setActiveTab('2018');
          }}
          className={`btn-3d px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
            activeTab === '2018' ? 'btn-3d-teal' : 'btn-3d-slate text-slate-600'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Cấu trúc 2018 & Thông tư 7991</span>
        </button>

        <button
          onClick={() => {
            soundEffects.playClick();
            setActiveTab('game');
          }}
          className={`btn-3d px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'game' ? 'btn-3d-pink' : 'btn-3d-slate text-slate-600'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Game học tập tương tác</span>
        </button>
      </div>

      {/* Main Grid: Left Grade Tree & Right Shared Quizzes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Left: Kho chia sẻ grades list */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-800 pb-2 border-b border-slate-100">
            <Folder className="w-4 h-4 text-teal-600" />
            <span>Kho chia sẻ theo khối</span>
          </div>

          <div className="space-y-1">
            {grades.map((g) => (
              <button
                key={g}
                onClick={() => {
                  soundEffects.playClick();
                  setSelectedGrade(g);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                  selectedGrade === g
                    ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <Folder className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Lớp {g}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {sharedQuizzes.filter(q => q.grade === g).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Table */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <span className="font-extrabold text-sm text-slate-900">
              Đề thi chia sẻ: Lớp {selectedGrade || 'Tất cả'}
            </span>
            <span className="text-xs text-slate-500 font-bold">{filtered.length} tài nguyên</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tên đề</th>
                  <th className="py-3 px-4 font-mono">Ngày xuất bản ↓</th>
                  <th className="py-3 px-4 text-center">Số câu</th>
                  <th className="py-3 px-4 text-center">Môn học</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                        <div>
                          <div>{item.title}</div>
                          <div className="text-[10px] text-slate-400 font-normal">Tác giả: {item.author}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">{item.date}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-teal-800">{item.questions} câu</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                        {item.subject}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            soundEffects.playCorrect();
                            onImportToMyLibrary(item.title, item.subject, item.questions);
                            alert(`Đã nhập đề: "${item.title}" vào Kho đề kiểm tra của Thầy Hồ Tấn Khải - THPT Mang Thít!`);
                          }}
                          className="btn-3d btn-3d-teal px-3 py-1 text-[11px] rounded-lg cursor-pointer inline-flex items-center gap-1 font-bold"
                          title="Lấy đề về kho cá nhân"
                        >
                          <Download className="w-3 h-3" />
                          <span>Lấy đề</span>
                        </button>
                        <button
                          onClick={() => handleDeleteShared(item.id, item.title)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Xóa đề khỏi kho chia sẻ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal: Tạo mới đề vào kho chia sẻ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">Tạo Đề Mới Vào Kho Chia Sẻ</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewShared} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Tên đề thi chia sẻ:</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: ĐỀ KHẢO SÁT CHẤT LƯỢNG THPT 2026 THEO TT 7991"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-teal-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Môn học:</label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-teal-500"
                  >
                    <option value="Công nghệ 12">Công nghệ 12</option>
                    <option value="Sinh học 11">Sinh học 11</option>
                    <option value="Sinh học 12">Sinh học 12</option>
                    <option value="Toán học 12">Toán học 12</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Khối lớp:</label>
                  <select
                    value={newGrade}
                    onChange={(e) => setNewGrade(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-teal-500 font-bold"
                  >
                    {grades.map(g => (
                      <option key={g} value={g}>Lớp {g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">Số lượng câu hỏi:</label>
                <input
                  type="number"
                  value={newQuestionsCount}
                  onChange={(e) => setNewQuestionsCount(parseInt(e.target.value, 10) || 28)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn-3d btn-3d-slate px-4 py-1.5 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-3d btn-3d-teal px-4 py-1.5 rounded-xl font-bold cursor-pointer"
                >
                  Xuất Bản Vào Kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
