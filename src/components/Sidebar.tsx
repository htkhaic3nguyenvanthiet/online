import React from 'react';
import {
  Home,
  Users,
  FolderKanban,
  Send,
  FileText,
  Palette,
  Gamepad2,
  BookOpen,
  Laptop,
  User,
  Activity,
  CheckCircle2,
  Award
} from 'lucide-react';
import { ActiveTab } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';

interface SidebarProps {
  currentTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  pendingSubmissionsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingSubmissionsCount
}) => {
  const menuItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string; badgeColor?: string; isSpecial?: boolean }[] = [
    { id: 'dashboard', label: 'Trang chủ', icon: <Home className="w-5 h-5" /> },
    { id: 'classes', label: 'Quản lý lớp', icon: <Users className="w-5 h-5" /> },
    { id: 'quizzes', label: 'Kho đề kiểm tra', icon: <FolderKanban className="w-5 h-5" /> },
    { id: 'online-sessions', label: 'Giao đề Online', icon: <Send className="w-5 h-5" />, badge: '18', badgeColor: 'bg-emerald-500' },
    { id: 'paper-exam', label: 'Giao đề giấy', icon: <FileText className="w-5 h-5" /> },
    { id: 'kids-quiz', label: 'Giao đề Thiếu nhi', icon: <Palette className="w-5 h-5" /> },
    { 
      id: 'game-arena', 
      label: 'Game học tập', 
      icon: <Gamepad2 className="w-5 h-5 text-rose-300 group-hover:text-white" />,
      badge: 'Đấu trường',
      badgeColor: 'bg-rose-500',
      isSpecial: true
    },
    { id: 'shared-store', label: 'Kho nội dung chia sẻ', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'offline-exam', label: 'Kiểm tra Offline', icon: <Laptop className="w-5 h-5" /> },
    {
      id: 'live-monitor',
      label: 'Bảng điểm Real-time',
      icon: <Activity className="w-5 h-5 text-amber-300" />,
      badge: pendingSubmissionsCount > 0 ? `${pendingSubmissionsCount} bài mới` : 'Live',
      badgeColor: 'bg-amber-500 animate-pulse'
    },
    { id: 'account', label: 'Tài khoản', icon: <User className="w-5 h-5" /> }
  ];

  return (
    <aside className="w-64 bg-teal-800 text-teal-50 flex flex-col shrink-0 select-none min-h-[calc(100vh-65px)]">
      {/* Brand logo top badge on sidebar */}
      <div className="p-4 border-b border-teal-700/60 flex items-center justify-center">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg border-2 border-teal-300 mb-2">
            <CheckCircle2 className="w-9 h-9 text-teal-700 stroke-[2.5]" />
          </div>
          <span className="font-extrabold text-white text-base tracking-wide uppercase">TEST ONLINE</span>
          <span className="text-[11px] text-teal-200 font-semibold">Tác giả: Hồ Tấn Khải</span>
          <span className="text-[10px] text-teal-300/80">Trường THPT Mang Thít</span>
        </div>
      </div>

      {/* Navigation Links list */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                soundEffects.playClick();
                onSelectTab(item.id);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group cursor-pointer ${
                isActive
                  ? 'bg-white text-teal-800 shadow-md font-bold translate-x-1'
                  : 'text-teal-100 hover:bg-teal-700/70 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-teal-700' : 'text-teal-200'}>
                  {item.icon}
                </span>
                <span className="text-left">{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white shadow-xs ${item.badgeColor || 'bg-teal-600'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* School info card footer */}
      <div className="p-3 m-3 bg-teal-900/60 rounded-xl border border-teal-700/50 text-[11px]">
        <div className="flex items-center gap-2 mb-1.5 font-bold text-teal-100">
          <Award className="w-4 h-4 text-amber-400" />
          <span>Hệ thống trường học</span>
        </div>
        <p className="text-teal-200 text-[10px] leading-relaxed">
          Trường THPT Mang Thít - Tác giả: Hồ Tấn Khải. Hệ thống thi trắc nghiệm tốc độ cao.
        </p>
      </div>
    </aside>
  );
};
