import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Shuffle,
  Download,
  Copy,
  CheckCircle2,
  FileCheck
} from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

export const PaperExamView: React.FC = () => {
  const [selectedExam, setSelectedExam] = useState('ON_CN12_HK2');
  const [examCodes, setExamCodes] = useState(['101', '102', '103', '104']);
  const [isShuffled, setIsShuffled] = useState(false);

  const handleShuffle = () => {
    soundEffects.playClick();
    setIsShuffled(true);
    setTimeout(() => {
      soundEffects.playCorrect();
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Giao đề Giấy & Trộn Đề Trắc Nghiệm</h1>
          <p className="text-xs text-slate-500 mt-0.5">Tự động xáo trộn câu hỏi và đáp án, xuất file PDF in ấn và phiếu tô trắc nghiệm</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              soundEffects.playClick();
              window.print();
            }}
            className="btn-3d btn-3d-teal px-4 py-2 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <Printer className="w-4 h-4" />
            <span>In Đề Thi & Đáp Án</span>
          </button>
        </div>
      </div>

      {/* Control Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Shuffle className="w-4 h-4 text-teal-600" />
            <span>Cấu hình trộn mã đề</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Chọn đề thi gốc:</label>
              <select
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs font-semibold"
              >
                <option value="ON_CN12_HK2">ÔN CN12-1-2-3 (Nông nghiệp công nghệ cao)</option>
                <option value="SINH11">2025_Sinh.docx (Sinh học 11)</option>
                <option value="DATTRONG">CHỦ ĐỀ 2 ĐẤT TRỒNG.docx</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Số lượng mã đề cần tạo:</label>
              <div className="flex gap-2">
                {['4 mã đề', '8 mã đề', '12 mã đề'].map((item, idx) => (
                  <button
                    key={item}
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
                className="btn-3d btn-3d-pink w-full py-2.5 text-xs rounded-xl font-bold cursor-pointer flex items-center justify-center gap-2"
              >
                <Shuffle className="w-4 h-4" />
                <span>Trộn đề ngay (Hoán vị đáp án)</span>
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

          {/* Visual Bubble Answer Grid Sheet Preview */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="text-center font-bold text-xs text-slate-800 pb-2 border-b border-slate-200">
              TRƯỜNG THPT MANG THÍT • TÁC GIẢ: HỒ TẤN KHẢI • PHIẾU TRẢ LỜI TRẮC NGHIỆM
            </div>
            <div className="grid grid-cols-5 gap-2 mt-3 text-center text-[10px] font-mono">
              {[1, 2, 3, 4, 5].map((num) => (
                <div key={num} className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs">
                  <div className="font-bold text-slate-700 mb-1">Câu {num}</div>
                  <div className="flex justify-center gap-1 text-[9px] font-bold">
                    <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-800 hover:text-white cursor-pointer">A</span>
                    <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-800 hover:text-white cursor-pointer">B</span>
                    <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-800 hover:text-white cursor-pointer">C</span>
                    <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-800 hover:text-white cursor-pointer">D</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
