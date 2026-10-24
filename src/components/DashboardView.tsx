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
  Zap
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
                <ShieldCheck className="w-3.5 h-3.5" /> Công nghệ Chống nghẽn 500 Slot
              </span>
              <span className="text-emerald-100 text-xs font-semibold">Tự động trả điểm Real-time</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
              Chào mừng Thầy Hồ Tấn Khải - Trường THPT Mang Thít
            </h1>
            <p className="text-emerald-50 text-xs leading-relaxed">
              Hệ thống Test Online đã sẵn sàng phục vụ kỳ thi với hạ tầng chịu tải cao 500 thí sinh truy cập đồng thời. Kết quả bài làm của học sinh sẽ tự động chấm và hiển thị trực tiếp lên bảng điều khiển ngay khi nộp bài.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => {
                soundEffects.playClick();
                onNavigate('live-monitor');
              }}
              className="btn-3d btn-3d-amber px-4 py-2 text-xs rounded-xl flex items-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>Xem Bảng Điểm Live ({recentSubmissionsCount})</span>
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                onOpenStudentExam();
              }}
              className="btn-3d btn-3d-pink px-4 py-2 text-xs rounded-xl flex items-center gap-2 cursor-pointer"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Vào Thi Thử Học Sinh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 1: Quản lý (Management Cards) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 border-l-4 border-emerald-600 pl-3">
          <h2 className="text-base font-extrabold text-slate-800">Quản lý</h2>
          <span className="text-xs text-slate-500 font-medium">Các tính năng quản lý cốt lõi của giáo viên</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card: Quản lý lớp */}
          <div
            onClick={() => {
              soundEffects.playClick();
              onNavigate('classes');
            }}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">2 Lớp</span>
            </div>
            <div className="mt-4">
              <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-emerald-700 transition-colors">Quản lý lớp</h3>
              <p className="text-xs text-slate-500 mt-1">Danh sách các lớp học của bạn</p>
            </div>
          </div>

          {/* Card: Kho đề kiểm tra */}
          <div
            onClick={() => {
              soundEffects.playClick();
              onNavigate('quizzes');
            }}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FolderKanban className="w-6 h-6 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md">32 Đề</span>
            </div>
            <div className="mt-4">
              <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-emerald-700 transition-colors">Kho đề kiểm tra</h3>
              <p className="text-xs text-slate-500 mt-1">Quản lý đề, bài tập của bạn</p>
            </div>
          </div>

          {/* Card: Game học tập (Highlighted Pink Theme) */}
          <div
            onClick={() => {
              soundEffects.playClick();
              onNavigate('game-arena');
            }}
            className="bg-rose-50/40 rounded-2xl p-5 border-2 border-rose-200 shadow-xs hover:shadow-md hover:border-rose-400 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute -right-2 -bottom-2 text-rose-100 pointer-events-none">
              <Sparkles className="w-16 h-16" />
            </div>
            <div className="flex items-start justify-between relative z-10">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Gamepad2 className="w-6 h-6 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Đấu trường
              </span>
            </div>
            <div className="mt-4 relative z-10">
              <h3 className="font-extrabold text-rose-800 text-sm group-hover:text-rose-900 transition-colors">Game học tập</h3>
              <p className="text-xs text-rose-600/80 mt-1">Các dạng câu hỏi tương tác trực tiếp</p>
            </div>
          </div>

          {/* Card: Bạn có (Statistics summary matching screenshot) */}
          <div className="bg-gradient-to-br from-slate-50 to-emerald-50/50 rounded-2xl p-5 border border-emerald-100/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Bạn có:</span>
            </div>
            <div className="mt-3 space-y-2 text-xs font-medium text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Lớp học:</span>
                <span className="font-bold text-slate-900">2 Lớp học</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Đề kiểm tra:</span>
                <span className="font-bold text-slate-900">32 Đề (30 cơ bản, 2 tương tác)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Phiên giao đề:</span>
                <span className="font-bold text-emerald-700">18 Phiên đang hoạt động</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/70 pt-1.5">
                <span className="text-slate-500">Sức chứa tối đa:</span>
                <span className="font-black text-emerald-800">500 Học sinh / phòng</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Phiên giao đề (Distribution modes matching screenshot) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 border-l-4 border-teal-600 pl-3">
          <h2 className="text-base font-extrabold text-slate-800">Phiên giao đề</h2>
          <span className="text-xs text-slate-500 font-medium">Đa dạng hình thức tổ chức thi và khảo sát</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Giao đề Online */}
          <div
            onClick={() => {
              soundEffects.playClick();
              onNavigate('online-sessions');
            }}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-teal-300 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
              <Send className="w-6 h-6 stroke-[2.2]" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-teal-700 transition-colors">Giao đề Online</h3>
            <p className="text-xs text-slate-500 mt-1">Danh sách phiên giao đề Online</p>
          </div>

          {/* 2. Giao đề Giấy */}
          <div
            onClick={() => {
              soundEffects.playClick();
              onNavigate('paper-exam');
            }}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-teal-300 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
              <FileText className="w-6 h-6 stroke-[2.2]" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-teal-700 transition-colors">Giao đề Giấy</h3>
            <p className="text-xs text-slate-500 mt-1">Danh sách phiên giao đề Giấy & Trộn đề</p>
          </div>

          {/* 3. Giao đề Thiếu nhi */}
          <div
            onClick={() => {
              soundEffects.playClick();
              onNavigate('kids-quiz');
            }}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-teal-300 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
              <Palette className="w-6 h-6 stroke-[2.2]" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-teal-700 transition-colors">Giao đề Thiếu nhi</h3>
            <p className="text-xs text-slate-500 mt-1">Danh sách phiên giao đề thiếu nhi</p>
          </div>

          {/* 4. Kiểm tra Offline */}
          <div
            onClick={() => {
              soundEffects.playClick();
              onNavigate('offline-exam');
            }}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-teal-300 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
              <Laptop className="w-6 h-6 stroke-[2.2]" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-teal-700 transition-colors">Kiểm tra Offline</h3>
            <p className="text-xs text-slate-500 mt-1">Chuẩn bị đề thi cho phòng máy Offline</p>
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
