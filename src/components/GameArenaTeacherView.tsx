import React from 'react';
import {
  Gamepad2,
  Sparkles,
  Plus,
  Play,
  Share2,
  Eye,
  Award,
  Layers,
  CheckCircle2,
  Zap,
  ArrowRight
} from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface GameArenaTeacherViewProps {
  onStartStudentExam: (examName: string) => void;
  onOpenLiveMonitor: () => void;
}

export const GameArenaTeacherView: React.FC<GameArenaTeacherViewProps> = ({
  onStartStudentExam,
  onOpenLiveMonitor
}) => {
  return (
    <div className="space-y-6">
      {/* Top Banner Pink Themed matching Screenshot 4 */}
      <div className="bg-gradient-to-r from-rose-500 via-pink-600 to-rose-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-72 h-full opacity-15 pointer-events-none">
          <Gamepad2 className="w-full h-full text-white" />
        </div>
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Đấu trường trò chơi học tập tương tác
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            Game Học Tập & Đấu Trường Trực Tuyến
          </h1>
          <p className="text-xs text-rose-100 leading-relaxed">
            Biến mỗi buổi kiểm tra thành một đấu trường kịch tính. Nút bấm 3D đa sắc màu, phản hồi trực quan, thi đấu đồng thời tới 500 học sinh với máy tự động chấm và trả bảng xếp hạng thời gian thực!
          </p>
          <div className="pt-2 flex flex-wrap gap-2.5">
            <button
              onClick={() => {
                soundEffects.playClick();
                onStartStudentExam('ÔN CN12-1-2-3');
              }}
              className="btn-3d btn-3d-slate px-4 py-2 text-xs rounded-xl flex items-center gap-2 cursor-pointer font-bold text-rose-700"
            >
              <Play className="w-4 h-4 fill-rose-600 text-rose-600" />
              <span>Chạy Thử Đấu Trường ÔN CN12</span>
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                onOpenLiveMonitor();
              }}
              className="btn-3d btn-3d-amber px-4 py-2 text-xs rounded-xl flex items-center gap-2 cursor-pointer font-bold text-amber-900"
            >
              <Zap className="w-4 h-4" />
              <span>Bảng Điểm Xếp Hạng Trực Tiếp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 1: Đề tương tác gần đây (matching Screenshot 4) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 border-l-4 border-rose-500 pl-3">
            <h2 className="text-base font-extrabold text-slate-800">Đề tương tác gần đây</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => soundEffects.playClick()}
              className="text-xs text-rose-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Quản lý kho đề</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                alert('Mở trình tạo đề trắc nghiệm tương tác 3D');
              }}
              className="btn-3d btn-3d-pink px-3.5 py-1.5 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Tạo đề tương tác</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card: ÔN CN12-1-2-3 */}
          <div className="bg-white border-2 border-rose-100 rounded-2xl p-4 shadow-xs hover:border-rose-400 hover:shadow-md transition-all flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Layers className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 group-hover:text-rose-600 transition-colors">
                  ÔN CN12-1-2-3
                </h4>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Ngày tạo: 27/10/2025 • <span className="font-bold text-rose-700">Số câu: 112</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                soundEffects.playClick();
                onStartStudentExam('ÔN CN12-1-2-3');
              }}
              className="btn-3d btn-3d-pink px-3 py-1.5 text-xs rounded-xl flex items-center gap-1 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Chơi</span>
            </button>
          </div>

          {/* Card: CHỦ ĐỀ 1 CN10 */}
          <div className="bg-white border-2 border-rose-100 rounded-2xl p-4 shadow-xs hover:border-rose-400 hover:shadow-md transition-all flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Layers className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 group-hover:text-rose-600 transition-colors">
                  CHỦ ĐỀ 1 CN10
                </h4>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Ngày tạo: 24/10/2025 • <span className="font-bold text-rose-700">Số câu: 37</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                soundEffects.playClick();
                onStartStudentExam('CHỦ ĐỀ 1 CN10');
              }}
              className="btn-3d btn-3d-pink px-3 py-1.5 text-xs rounded-xl flex items-center gap-1 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Chơi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: Phiên giao đề đang hoạt động (matching Screenshot 4) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 border-l-4 border-pink-500 pl-3">
            <h2 className="text-base font-extrabold text-slate-800">Phiên giao đề đang hoạt động</h2>
          </div>
          <button className="text-xs text-pink-600 font-bold hover:underline flex items-center gap-1">
            <span>Quản lý các phiên</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Tên đề thi</th>
                <th className="py-3 px-4">Lớp học</th>
                <th className="py-3 px-4 font-mono">Ngày bắt đầu</th>
                <th className="py-3 px-4 font-mono">Ngày kết thúc</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4">Đường dẫn</th>
                <th className="py-3 px-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3.5 px-4 font-bold text-slate-900">ÔN CN12-1-2-3</td>
                <td className="py-3.5 px-4 text-slate-500">Không gắn lớp</td>
                <td className="py-3.5 px-4 font-mono text-[11px]">20:37 27/10/2025</td>
                <td className="py-3.5 px-4 font-mono text-[11px]">20:37 27/07/2028</td>
                <td className="py-3.5 px-4 text-center">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Đang diễn ra
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <span className="text-teal-700 font-mono text-[11px] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    https://youngtest.vn/quiz-advance/take/aCyafW
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center">
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      onOpenLiveMonitor();
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold text-pink-700 bg-pink-50 border border-pink-200 rounded-md hover:bg-pink-100 cursor-pointer"
                  >
                    Xem Live
                  </button>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3.5 px-4 font-bold text-slate-900">CHỦ ĐỀ 1 CN10</td>
                <td className="py-3.5 px-4 text-slate-500">Không gắn lớp</td>
                <td className="py-3.5 px-4 font-mono text-[11px]">16:40 24/10/2025</td>
                <td className="py-3.5 px-4 font-mono text-[11px]">16:41 24/07/2027</td>
                <td className="py-3.5 px-4 text-center">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Đang diễn ra
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <span className="text-teal-700 font-mono text-[11px] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    https://youngtest.vn/quiz-advance/take/bXzkL9
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center">
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      onOpenLiveMonitor();
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold text-pink-700 bg-pink-50 border border-pink-200 rounded-md hover:bg-pink-100 cursor-pointer"
                  >
                    Xem Live
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Xem trước dạng câu hỏi (matching Screenshot 4 bottom) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-l-4 border-rose-500 pl-3">
          <h2 className="text-base font-extrabold text-slate-800">Xem trước dạng câu hỏi</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card: Lựa chọn 4 đáp án màu sắc */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Lựa chọn 4 đáp án 3D</span>
              <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-md">Lựa chọn</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-slate-800">Nội dung câu hỏi trắc nghiệm</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="btn-3d btn-3d-blue py-1.5 px-2 text-center rounded-lg text-[11px]">A. Đáp án 1</div>
                <div className="btn-3d btn-3d-emerald py-1.5 px-2 text-center rounded-lg text-[11px]">B. Đáp án 2</div>
                <div className="btn-3d btn-3d-orange py-1.5 px-2 text-center rounded-lg text-[11px]">C. Đáp án 3</div>
                <div className="btn-3d btn-3d-purple py-1.5 px-2 text-center rounded-lg text-[11px]">D. Đáp án 4</div>
              </div>
            </div>
          </div>

          {/* Card: Phân nhóm kéo thả */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Kéo thả & Phân nhóm</span>
              <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-md">Phân nhóm</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-slate-800">Phân loại cây trồng theo nhóm sinh thái</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="border border-dashed border-rose-300 bg-rose-50/60 p-2 rounded-lg text-center font-bold text-rose-700">
                  Nhóm ưa sáng
                </div>
                <div className="border border-dashed border-teal-300 bg-teal-50/60 p-2 rounded-lg text-center font-bold text-teal-700">
                  Nhóm ưa bóng
                </div>
              </div>
            </div>
          </div>

          {/* Card: Điền khuyết & Khớp nối */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Ghép nối & Nối từ</span>
              <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-md">Tương tác</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-slate-800">Nối các kỹ thuật nông nghiệp công nghệ cao</div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-slate-200">
                  <span>Tưới nhỏ giọt</span>
                  <span className="text-emerald-600 font-bold">↔ Tiết kiệm nước</span>
                </div>
                <div className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-slate-200">
                  <span>Nhà màng</span>
                  <span className="text-emerald-600 font-bold">↔ Ngăn sâu bệnh</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
