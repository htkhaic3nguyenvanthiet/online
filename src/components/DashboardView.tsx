import React from 'react';
import {
  Users,
  FolderKanban,
  Gamepad2,
  Send,
  FileText,
  Palette,
  Laptop,
  Newspaper,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Zap,
  ClipboardCheck
} from 'lucide-react';
import { ActiveTab, ConcurrentSystemMetrics } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';

interface DashboardViewProps {
  onNavigate: (tab: ActiveTab) => void;
  onOpenStudentExam: () => void;
  metrics: ConcurrentSystemMetrics;
  recentSubmissionsCount: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenStudentExam,
  metrics,
  recentSubmissionsCount
}) => {
  return (
    <div className="space-y-6">
      {/* High capacity system status banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full opacity-10 pointer-events-none">
          <Zap className="w-full h-full text-white" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="bg-white/20 backdrop-blur-xs text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Chống nghẽn 500 Slot
              </span>
              <span className="text-emerald-100 text-xs font-semibold">Tự động trả điểm Real-time</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
              Test Online • Trường THPT Mang Thít
            </h1>
            <p className="text-emerald-100 text-xs font-medium">
              Tác giả: Thầy Hồ Tấn Khải • Hệ thống khảo thí số & Đấu trường học tập tương tác chịu tải 500+ học sinh
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => {
                soundEffects.playClick();
                onNavigate('attendance-summary');
              }}
              className="btn-3d btn-3d-teal px-4 py-2 text-xs rounded-xl flex items-center gap-2 cursor-pointer font-bold"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Bảng Điểm & Điểm Danh</span>
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                onNavigate('live-monitor');
              }}
              className="btn-3d btn-3d-amber px-4 py-2 text-xs rounded-xl flex items-center gap-2 cursor-pointer font-bold"
            >
              <Zap className="w-4 h-4" />
              <span>Bảng Điểm Live ({recentSubmissionsCount})</span>
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                onOpenStudentExam();
              }}
              className="btn-3d btn-3d-pink px-4 py-2 text-xs rounded-xl flex items-center gap-2 cursor-pointer font-bold"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Vào Thi Thử Học Sinh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 1: Quản lý & Giảng dạy (3D Colorful Management Boxes) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 border-l-4 border-emerald-600 pl-3">
          <h2 className="text-base font-extrabold text-slate-800">Khu vực làm việc giáo viên</h2>
          <span className="text-xs text-slate-500 font-medium">Truy cập nhanh các nghiệp vụ khảo sát trực tuyến</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Kho đề kiểm tra (Teal 3D) */}
          <div
            onClick={() => {
              soundEffects.playClick();
              onNavigate('quizzes');
            }}
            className="card-3d card-3d-teal p-5 cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <FolderKanban className="w-6 h-6 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-teal-800 bg-teal-100 px-2.5 py-1 rounded-full border border-teal-300">
                Chuẩn TT 7991
              </span>
            </div>
            <div className="mt-4">
              <h3 className="font-black text-slate-900 text-sm group-hover:text-teal-700 transition-colors">
                Kho đề kiểm tra
              </h3>
              <p className="text-xs text-slate-600 mt-1">Upload Word .docx, soạn đề AI & biên tập câu hỏi</p>
            </div>
          </div>

          {/* Card 2: Giao đề Online (Indigo 3D) */}
          <div
            onClick={() => {
              soundEffects.playClick();
              onNavigate('online-sessions');
            }}
            className="card-3d card-3d-indigo p-5 cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Send className="w-6 h-6 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-indigo-800 bg-indigo-100 px-2.5 py-1 rounded-full border border-indigo-300">
                Giao đề
              </span>
            </div>
            <div className="mt-4">
              <h3 className="font-black text-slate-900 text-sm group-hover:text-indigo-700 transition-colors">
                Giao đề Online
              </h3>
              <p className="text-xs text-slate-600 mt-1">Lấy link thi, mã QR, cấu hình số lượt thi & hạn nộp</p>
            </div>
          </div>

          {/* Card 3: Bảng điểm & Điểm danh (Amber 3D) */}
          <div
            onClick={() => {
              soundEffects.playClick();
              onNavigate('attendance-summary');
            }}
            className="card-3d card-3d-amber p-5 cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <ClipboardCheck className="w-6 h-6 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
                Thông tư 22
              </span>
            </div>
            <div className="mt-4">
              <h3 className="font-black text-slate-900 text-sm group-hover:text-amber-700 transition-colors">
                Bảng điểm & Điểm danh
              </h3>
              <p className="text-xs text-slate-600 mt-1">Thống kê điểm số, danh sách học sinh đã làm / chưa làm</p>
            </div>
          </div>

          {/* Card 4: Quản lý lớp học (Sky 3D) */}
          <div
            onClick={() => {
              soundEffects.playClick();
              onNavigate('classes');
            }}
            className="card-3d card-3d-blue p-5 cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-sky-800 bg-sky-100 px-2.5 py-1 rounded-full border border-sky-300">
                Lớp học
              </span>
            </div>
            <div className="mt-4">
              <h3 className="font-black text-slate-900 text-sm group-hover:text-sky-700 transition-colors">
                Quản lý lớp học
              </h3>
              <p className="text-xs text-slate-600 mt-1">Lớp 12A5, danh sách học sinh & mã số định danh</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Tin tức & Hướng dẫn */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 border-l-4 border-slate-400 pl-3">
          <h2 className="text-base font-extrabold text-slate-800">Tin tức & Hướng dẫn Test Online</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-3">
              <Newspaper className="w-4 h-4 text-emerald-600" />
              <span>Tin tức Test Online - THPT Mang Thít</span>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li className="flex items-center gap-2 hover:text-emerald-700 cursor-pointer">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Hướng dẫn trộn đề trắc nghiệm môn Toán với Test Online</span>
              </li>
              <li className="flex items-center gap-2 hover:text-emerald-700 cursor-pointer">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Hướng dẫn trộn đề trắc nghiệm Tiếng Anh với Test Online</span>
              </li>
              <li className="flex items-center gap-2 hover:text-emerald-700 cursor-pointer">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Cấu hình phòng thi 500 học sinh đồng thời không gián đoạn kết nối mạng</span>
              </li>
              <li className="flex items-center gap-2 hover:text-emerald-700 cursor-pointer">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Máy tự động chấm trắc nghiệm & xuất bảng điểm Excel chuẩn Sở GD&ĐT</span>
              </li>
            </ul>
          </div>

          {/* Quick action card */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-100/60 rounded-2xl p-5 border border-emerald-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-1">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Bắt đầu nhanh</span>
              </div>
              <h4 className="font-extrabold text-sm text-slate-900">Tạo đề thi mới ngay</h4>
              <p className="text-xs text-slate-600 mt-1">
                Hỗ trợ nhập trực tiếp từ file Word (.docx) giữ nguyên công thức toán học và hình vẽ.
              </p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => {
                  soundEffects.playClick();
                  onNavigate('quizzes');
                }}
                className="btn-3d btn-3d-teal w-full py-2 text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Mở Kho Đề Kiểm Tra</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
