import React, { useState } from 'react';
import {
  Laptop,
  Download,
  WifiOff,
  Server,
  Usb,
  ShieldCheck,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

export const OfflineExamView: React.FC = () => {
  const [downloadProgress, setDownloadProgress] = useState(false);

  const handleExportOfflinePackage = () => {
    soundEffects.playClick();
    setDownloadProgress(true);
    setTimeout(() => {
      setDownloadProgress(false);
      soundEffects.playCorrect();
      alert('Đã đóng gói thành công gói thi Offline (TestOnline-Offline-THPT-MangThit.zip) cho 50 máy tính phòng học!');
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Title matching Screenshot 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Kiểm tra Offline Phòng Máy</h1>
          <p className="text-xs text-slate-500 mt-0.5">Giải pháp thi trắc nghiệm trong phòng tin học nội bộ không phụ thuộc vào đường truyền Internet ngoài</p>
        </div>

        <button
          onClick={handleExportOfflinePackage}
          disabled={downloadProgress}
          className="btn-3d btn-3d-teal px-4 py-2 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold"
        >
          <Download className="w-4 h-4" />
          <span>{downloadProgress ? 'Đang xuất gói Offline...' : 'Xuất Gói Thi Phòng Máy (LAN/USB)'}</span>
        </button>
      </div>

      {/* Grid of features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <WifiOff className="w-5 h-5 stroke-[2.2]" />
          </div>
          <h3 className="font-extrabold text-sm text-slate-900">Hoạt động 100% Offline</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Không lo đứt cáp quang hay nghẽn băng thông trường học. Giáo viên chỉ cần cắm 1 USB hoặc khởi động máy chủ mini cục bộ (Localhost IP).
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <h3 className="font-extrabold text-sm text-slate-900">Chống gian lận tuyệt đối</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Tự động khóa toàn màn hình máy trạm (Kiosk mode), ngăn chặn mở tab Google hay trao đổi file qua mạng cục bộ.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Server className="w-5 h-5 stroke-[2.2]" />
          </div>
          <h3 className="font-extrabold text-sm text-slate-900">Tự động trả điểm ngay</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Sau khi hết giờ làm bài, máy chủ tự gom bài thi của toàn bộ 40-50 máy con về máy tính giáo viên và xuất bảng điểm Excel ngay tức thì.
          </p>
        </div>
      </div>
    </div>
  );
};
