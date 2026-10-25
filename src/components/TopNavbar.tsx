import React from 'react';
import { 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Users, 
  ShieldCheck, 
  Search, 
  GraduationCap, 
  Activity, 
  CheckCircle2,
  ChevronDown,
  Cloud
} from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface TopNavbarProps {
  appMode: 'teacher' | 'student';
  onSwitchMode: (mode: 'teacher' | 'student') => void;
  is500SimActive: boolean;
  onToggle500Sim: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onNavigateToLiveMonitor: () => void;
  onOpenCloudModal: () => void;
  autoBackupEnabled?: boolean;
  syncKey?: string;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  appMode,
  onSwitchMode,
  is500SimActive,
  onToggle500Sim,
  soundEnabled,
  onToggleSound,
  onNavigateToLiveMonitor,
  onOpenCloudModal,
  autoBackupEnabled = true,
  syncKey = 'THPT-MANGTHIT-KHAI-2026',
}) => {
  return (
    <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40 shadow-xs">
      {/* Top micro-bar: inspirational quote & real-time connection status */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-4 py-1.5 text-xs text-emerald-800 border-b border-emerald-100/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <span className="text-emerald-600">🌿</span>
          <span className="italic">
            &ldquo;Công nghệ hiện đại nhất cũng không thể thay thế hơi ấm từ lời động viên của người thầy.&rdquo; 🌱
          </span>
        </div>

        {/* 500-concurrency health telemetry badge */}
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={onNavigateToLiveMonitor}
            className="flex items-center gap-1.5 bg-emerald-600/10 text-emerald-700 px-2.5 py-0.5 rounded-full font-semibold hover:bg-emerald-600/20 transition-colors"
            title="Xem chi tiết hạ tầng chịu tải 500 học sinh đồng thời"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${is500SimActive ? 'bg-rose-400' : 'bg-emerald-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${is500SimActive ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span>Hạ tầng 500 slot: {is500SimActive ? 'Đang chịu tải cao (480 req/s)' : 'Sẵn sàng 100%'}</span>
          </button>

          <span className="text-slate-300">|</span>
          <span className="text-slate-500 flex items-center gap-1 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Chống sập mạng • RAM Buffer Active
          </span>
        </div>
      </div>

      {/* Main navigation toolbar */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => onSwitchMode('teacher')}>
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-md border-2 border-emerald-400">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight text-emerald-800">Test Online</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-bold tracking-wide uppercase">2026 Pro</span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium">Tác giả: Hồ Tấn Khải - Trường THPT Mang Thít</p>
            </div>
          </div>

          {/* Quick search input */}
          <div className="hidden lg:flex items-center relative ml-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm nhanh đề thi, lớp học, mã học sinh..."
              className="pl-9 pr-4 py-1.5 bg-slate-100 hover:bg-slate-200/70 focus:bg-white text-xs text-slate-700 rounded-lg border border-transparent focus:border-emerald-500 focus:outline-none w-64 transition-all"
            />
          </div>
        </div>

        {/* Center/Right: Action Bar with 3D Tactile Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mode switch: Teacher Studio */}
          <button
            onClick={() => {
              soundEffects.playClick();
              onSwitchMode('teacher');
            }}
            className={`btn-3d px-3.5 py-1.5 text-xs rounded-lg flex items-center gap-1.5 cursor-pointer ${
              appMode === 'teacher'
                ? 'btn-3d-teal font-bold'
                : 'btn-3d-slate text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Giao Diện Giáo Viên</span>
          </button>

          {/* Mode switch: Student Exam Arena */}
          <button
            onClick={() => {
              soundEffects.playClick();
              onSwitchMode('student');
            }}
            className={`btn-3d px-3.5 py-1.5 text-xs rounded-lg flex items-center gap-1.5 cursor-pointer ${
              appMode === 'student'
                ? 'btn-3d-pink font-bold'
                : 'btn-3d-slate text-slate-600'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Phòng Thi Học Sinh</span>
            <span className="text-[10px] bg-white/20 text-white px-1 rounded-sm">Hot</span>
          </button>

          {/* 500-Student Concurrency Simulator 3D Button */}
          <button
            onClick={() => {
              soundEffects.playClick();
              onToggle500Sim();
            }}
            className={`btn-3d px-3.5 py-1.5 text-xs rounded-lg flex items-center gap-1.5 cursor-pointer ${
              is500SimActive
                ? 'btn-3d-orange font-bold text-white'
                : 'btn-3d-amber'
            }`}
            title="Kích hoạt giả lập 500 học sinh đồng thời nộp bài tự động không sập mạng"
          >
            <Activity className={`w-3.5 h-3.5 ${is500SimActive ? 'animate-spin' : ''}`} />
            <span>{is500SimActive ? '⚡ Đang Chạy Tải 500 HS' : '🚀 Test Tải 500 Học Sinh'}</span>
          </button>

          {/* Cloud & Drive Center 3D Button */}
          <button
            onClick={() => {
              soundEffects.playClick();
              onOpenCloudModal();
            }}
            className="btn-3d btn-3d-blue px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 cursor-pointer font-bold shadow-xs"
            title={`Đồng bộ đám mây & Google Drive (Mã Key: ${syncKey}) • Tự động sao lưu: ${autoBackupEnabled ? 'BẬT' : 'TẮT'}`}
          >
            <Cloud className="w-3.5 h-3.5 text-blue-200" />
            <span>Đám Mây & Drive</span>
            <span
              className={`w-2 h-2 rounded-full ${autoBackupEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}
              title={autoBackupEnabled ? 'Tự động sao lưu: BẬT' : 'Tự động sao lưu: TẮT'}
            ></span>
          </button>

          {/* Sound Synthesizer toggle */}
          <button
            onClick={onToggleSound}
            className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title={soundEnabled ? 'Tắt âm thanh hiệu ứng' : 'Bật âm thanh 3D'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          {/* User profile dropdown chip */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-bold text-xs flex items-center justify-center ring-2 ring-emerald-500/30">
              K
            </div>
            <div className="hidden xl:block text-left text-xs">
              <div className="font-bold text-slate-800 leading-tight">Thầy Hồ Tấn Khải</div>
              <div className="text-[10px] text-slate-500 font-medium">Trường THPT Mang Thít</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>
      </div>
    </header>
  );
};
