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
  Sparkles
} from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface SharedContentStoreViewProps {
  onImportToMyLibrary: (title: string, subject: string, questionsCount: number) => void;
}

export const SharedContentStoreView: React.FC<SharedContentStoreViewProps> = ({
  onImportToMyLibrary
}) => {
  const [activeTab, setActiveTab] = useState<'2018' | 'game'>('2018');
  const [selectedGrade, setSelectedGrade] = useState<number | null>(12);
  const [searchQuery, setSearchQuery] = useState('');

  const grades = [6, 7, 8, 9, 10, 11, 12];

  const sharedQuizzes = [
    { id: 'sq1', grade: 12, title: 'Đề thi thử Tốt nghiệp THPT 2026 môn Sinh học - Đề số 1', date: '18/10/2026', questions: 40, subject: 'Sinh học', author: 'Sở GD&ĐT Vĩnh Long' },
    { id: 'sq2', grade: 12, title: 'Chuyên đề Công nghệ Nông nghiệp 12 - Công nghệ cao', date: '15/10/2026', questions: 35, subject: 'Công nghệ', author: 'Thầy Hồ Tấn Khải (THPT Mang Thít)' },
    { id: 'sq3', grade: 12, title: 'Ngân hàng 200 câu hỏi ôn tập Hóa học Hữu cơ 12', date: '12/10/2026', questions: 50, subject: 'Hóa học', author: 'Tổ Chuyên môn THPT Mang Thít' },
    { id: 'sq4', grade: 11, title: 'Kiểm tra giữa kỳ I Công nghệ 11 - Cơ khí & Điện tử', date: '05/10/2026', questions: 30, subject: 'Công nghệ', author: 'Tổ Công nghệ THPT Mang Thít' },
    { id: 'sq5', grade: 10, title: 'Khảo sát chất lượng đầu năm môn Toán 10', date: '28/09/2026', questions: 35, subject: 'Toán học', author: 'Test Online THPT Mang Thít' }
  ];

  const filtered = sharedQuizzes.filter(item => {
    const matchesGrade = selectedGrade ? item.grade === selectedGrade : true;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGrade && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Title & Tabs matching Screenshot 6 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Kho đề được chia sẻ bởi Test Online</h1>
          <p className="text-xs text-slate-500 mt-0.5">Tác giả: Hồ Tấn Khải - Trường THPT Mang Thít • Ngân hàng đề thi chuẩn CT GDPT 2018</p>
        </div>

        {/* Search */}
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
      </div>

      {/* Navigation Mode Pill Tabs matching Screenshot 6 */}
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
          <span>Cấu trúc 2018</span>
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
          <span>Game học tập</span>
        </button>
      </div>

      {/* Main Grid: Left Grade Tree & Right Shared Quizzes matching Screenshot 6 & 7 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Left: Kho chia sẻ grades list matching screenshot */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-800 pb-2 border-b border-slate-100">
            <Folder className="w-4 h-4 text-teal-600" />
            <span>Kho chia sẻ</span>
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
              </button>
            ))}
          </div>
        </div>

        {/* Right: Table matching Screenshot 6 */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <span className="font-extrabold text-sm text-slate-900">
              Đề thi chia sẻ: Lớp {selectedGrade || 'Tất cả'}
            </span>
            <span className="text-xs text-slate-500">{filtered.length} tài nguyên</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tên đề</th>
                  <th className="py-3 px-4 font-mono">Ngày xuất bản ↓</th>
                  <th className="py-3 px-4 text-center">Số câu</th>
                  <th className="py-3 px-4 text-center">Môn học</th>
                  <th className="py-3 px-4 text-right">Tải về kho</th>
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
                      <button
                        onClick={() => {
                          soundEffects.playCorrect();
                          onImportToMyLibrary(item.title, item.subject, item.questions);
                          alert(`Đã nhập đề: "${item.title}" vào Kho đề kiểm tra của Thầy Hồ Tấn Khải - THPT Mang Thít!`);
                        }}
                        className="btn-3d btn-3d-teal px-3 py-1 text-[11px] rounded-lg cursor-pointer inline-flex items-center gap-1 font-bold"
                      >
                        <Download className="w-3 h-3" />
                        <span>Lấy đề</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
