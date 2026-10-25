import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Shuffle,
  Download,
  Copy,
  CheckCircle2,
  FileCheck,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface PaperExamItem {
  id: string;
  code: string;
  title: string;
  subject: string;
  questionsCount: number;
  codesGenerated: string[];
  createdAt: string;
}

export const PaperExamView: React.FC = () => {
  const [paperExams, setPaperExams] = useState<PaperExamItem[]>([
    {
      id: 'pe-1',
      code: 'ON_CN12_HK2',
      title: 'ÔN TẬP CÔNG NGHỆ 12 - THÔNG TƯ 7991 (NÔNG NGHIỆP CÔNG NGHỆ CAO)',
      subject: 'Công nghệ 12',
      questionsCount: 28,
      codesGenerated: ['101', '102', '103', '104'],
      createdAt: '24/10/2026'
    },
    {
      id: 'pe-2',
      code: 'SINH11_GK1',
      title: 'ĐỀ THI GIỮA KỲ 1 SINH HỌC 11 - CƠ KHÍ & ĐIỆN TỬ SINH HỌC',
      subject: 'Sinh học 11',
      questionsCount: 28,
      codesGenerated: ['201', '202', '203', '204'],
      createdAt: '22/10/2026'
    },
    {
      id: 'pe-3',
      code: 'DATTRONG_12',
      title: 'CHỦ ĐỀ 2 ĐẤT TRỒNG & PHÂN BÓN - THPT MANG THÍT',
      subject: 'Công nghệ 12',
      questionsCount: 28,
      codesGenerated: ['301', '302', '303', '304'],
      createdAt: '18/10/2026'
    }
  ]);

  const [selectedExamId, setSelectedExamId] = useState<string>('pe-1');
  const [examCodes, setExamCodes] = useState(['101', '102', '103', '104']);
  const [isShuffled, setIsShuffled] = useState(false);

  // Modal create
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('Công nghệ 12');
  const [newCount, setNewCount] = useState(28);

  const selectedExam = paperExams.find(e => e.id === selectedExamId) || paperExams[0];

  const handleShuffle = () => {
    soundEffects.playClick();
    setIsShuffled(true);
    // Generate new randomized codes
    const baseNum = Math.floor(100 + Math.random() * 800);
    const newCodes = [String(baseNum), String(baseNum + 1), String(baseNum + 2), String(baseNum + 3)];
    setExamCodes(newCodes);

    // Update current selected exam
    if (selectedExam) {
      setPaperExams(prev =>
        prev.map(item => item.id === selectedExam.id ? { ...item, codesGenerated: newCodes } : item)
      );
    }

    setTimeout(() => {
      soundEffects.playCorrect();
    }, 400);
  };

  const handleCreateNewPaperExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    soundEffects.playClick();
    const baseCode = Math.floor(100 + Math.random() * 800);
    const created: PaperExamItem = {
      id: 'pe-' + Date.now(),
      code: 'DE_' + Date.now().toString().slice(-4),
      title: newTitle.trim().toUpperCase(),
      subject: newSubject,
      questionsCount: newCount,
      codesGenerated: [String(baseCode), String(baseCode + 1), String(baseCode + 2), String(baseCode + 3)],
      createdAt: new Date().toLocaleDateString('vi-VN')
    };

    setPaperExams(prev => [created, ...prev]);
    setSelectedExamId(created.id);
    setExamCodes(created.codesGenerated);
    setIsCreateModalOpen(false);
    setNewTitle('');
    soundEffects.playCorrect();
  };

  const handleDeletePaperExam = (id: string, title: string) => {
    soundEffects.playClick();
    if (confirm(`Bạn có chắc chắn muốn xóa đề giấy: "${title}" khỏi kho đề?`)) {
      setPaperExams(prev => prev.filter(e => e.id !== id));
      if (selectedExamId === id && paperExams.length > 1) {
        const remaining = paperExams.filter(e => e.id !== id);
        setSelectedExamId(remaining[0].id);
      }
      soundEffects.playCorrect();
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Kho Đề Thi Giấy & Trộn Đề Trắc Nghiệm</h1>
          <p className="text-xs text-slate-500 mt-0.5">Tự động xáo trộn câu hỏi và đáp án, xuất file PDF in ấn và phiếu tô trắc nghiệm Thông tư 7991</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              soundEffects.playClick();
              setIsCreateModalOpen(true);
            }}
            className="btn-3d btn-3d-teal px-4 py-2 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo mới đề giấy</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              window.print();
            }}
            className="btn-3d btn-3d-slate px-4 py-2 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <Printer className="w-4 h-4 text-teal-600" />
            <span>In Đề Thi & Đáp Án</span>
          </button>
        </div>
      </div>

      {/* Repository Table of Paper Exams with Delete buttons */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900">Danh mục kho đề thi giấy</span>
            <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
              {paperExams.length} đề
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 font-bold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Tên đề thi</th>
                <th className="py-3 px-4 text-center">Môn học</th>
                <th className="py-3 px-4 text-center">Số câu</th>
                <th className="py-3 px-4 text-center">Mã đề đã trộn</th>
                <th className="py-3 px-4 font-mono">Ngày tạo</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paperExams.map((pe) => (
                <tr
                  key={pe.id}
                  onClick={() => {
                    setSelectedExamId(pe.id);
                    setExamCodes(pe.codesGenerated);
                  }}
                  className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                    selectedExamId === pe.id ? 'bg-teal-50/50 font-bold' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                      <span className="text-slate-900">{pe.title}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                      {pe.subject}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-teal-800">
                    {pe.questionsCount} câu
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1 font-mono text-[11px]">
                      {pe.codesGenerated.map(c => (
                        <span key={c} className="bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs font-bold text-slate-800">
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">{pe.createdAt}</td>
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDeletePaperExam(pe.id, pe.title)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Xóa đề giấy này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Control Configuration Grid & Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Shuffle className="w-4 h-4 text-teal-600" />
            <span>Cấu hình trộn mã đề: {selectedExam?.code}</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Đề thi đang chọn:</label>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-bold truncate">
                {selectedExam?.title}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Số lượng mã đề cần tạo:</label>
              <div className="flex gap-2">
                {['4 mã đề', '8 mã đề', '12 mã đề'].map((item, idx) => (
                  <button
                    key={item}
                    onClick={() => soundEffects.playClick()}
                    className={`btn-3d flex-1 py-1.5 rounded-lg text-xs cursor-pointer ${
                      idx === 0 ? 'btn-3d-teal' : 'btn-3d-slate'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleShuffle}
                className="btn-3d btn-3d-teal w-full py-2.5 text-xs rounded-xl font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                <Shuffle className="w-4 h-4" />
                <span>Trộn đề ngay (Hoán vị đáp án Thông tư 7991)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Paper answer sheet preview */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Xem trước phiếu trả lời trắc nghiệm & Mã đề</span>
            </h3>
            <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Chuẩn chấm máy quét tự động
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {examCodes.map((code) => (
              <div
                key={code}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center space-y-1 hover:border-teal-400 transition-colors"
              >
                <div className="text-[10px] uppercase font-bold text-slate-400">Mã đề thi</div>
                <div className="text-xl font-black text-slate-900 font-mono">{code}</div>
                <div className="text-[10px] text-teal-700 font-semibold flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Đã tạo đáp án
                </div>
              </div>
            ))}
          </div>

          {/* Visual Bubble Answer Grid Sheet Preview matching 3 parts */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
            <div className="text-center font-bold text-xs text-slate-800 pb-2 border-b border-slate-200">
              TRƯỜNG THPT MANG THÍT • TÁC GIẢ: HỒ TẤN KHẢI • PHIẾU TRẢ LỜI TRẮC NGHIỆM THÔNG TƯ 7991
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 text-[10px]">
              {/* Phần I bubble */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="font-bold text-teal-800 border-b pb-1">Phần I: 4 lựa chọn</div>
                {[1, 2, 3].map(n => (
                  <div key={n} className="flex items-center justify-between text-[9px] font-mono">
                    <span className="font-bold">C.{n}</span>
                    <div className="flex gap-1">
                      {['A', 'B', 'C', 'D'].map(k => (
                        <span key={k} className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center font-bold">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Phần II True / False bubble */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="font-bold text-blue-800 border-b pb-1">Phần II: Đúng / Sai</div>
                <div className="text-[9px] font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">C.1: a)</span>
                    <span className="text-emerald-700 font-bold">[Đ] [S]</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">C.1: b)</span>
                    <span className="text-emerald-700 font-bold">[Đ] [S]</span>
                  </div>
                </div>
              </div>

              {/* Phần III Short answer bubble */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="font-bold text-purple-800 border-b pb-1">Phần III: 4 số</div>
                <div className="text-[9px] font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">C.1:</span>
                    <div className="flex gap-0.5">
                      {['1', '2', '3', '4'].map((d, i) => (
                        <span key={i} className="w-3.5 h-4 bg-slate-100 border border-slate-300 flex items-center justify-center font-bold">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Tạo mới đề giấy */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">Tạo Đề Thi Giấy Mới</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewPaperExam} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Tên đề thi giấy:</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: ĐỀ KIỂM TRA ĐỊNH KỲ HỌC KỲ 2 - MÔN CÔNG NGHỆ 12"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-teal-500 font-bold uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Môn học:</label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-teal-500 font-medium"
                  >
                    <option value="Công nghệ 12">Công nghệ 12</option>
                    <option value="Sinh học 11">Sinh học 11</option>
                    <option value="Sinh học 12">Sinh học 12</option>
                    <option value="Toán học 12">Toán học 12</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Số lượng câu:</label>
                  <input
                    type="number"
                    value={newCount}
                    onChange={(e) => setNewCount(parseInt(e.target.value, 10) || 28)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
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
                  Tạo Đề Giấy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
