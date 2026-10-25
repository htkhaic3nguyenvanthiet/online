import React, { useState } from 'react';
import {
  Laptop,
  Download,
  WifiOff,
  Server,
  Usb,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Plus,
  Trash2,
  X,
  FileText
} from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface OfflinePackageItem {
  id: string;
  name: string;
  subject: string;
  targetRoom: string;
  maxClients: number;
  sizeMb: number;
  createdAt: string;
  status: 'ready' | 'deployed';
}

export const OfflineExamView: React.FC = () => {
  const [downloadProgress, setDownloadProgress] = useState(false);
  const [packages, setPackages] = useState<OfflinePackageItem[]>([
    {
      id: 'pkg-1',
      name: 'GÓI THI OFFLINE - CÔNG NGHỆ 12 THPT MANG THÍT (TT 7991)',
      subject: 'Công nghệ 12',
      targetRoom: 'Phòng Máy Tính 1 (45 máy)',
      maxClients: 50,
      sizeMb: 18.4,
      createdAt: '24/10/2026',
      status: 'ready'
    },
    {
      id: 'pkg-2',
      name: 'GÓI THI OFFLINE - SINH HỌC 11 HỌC KỲ 1',
      subject: 'Sinh học 11',
      targetRoom: 'Phòng Máy Tính 2 (40 máy)',
      maxClients: 45,
      sizeMb: 15.2,
      createdAt: '20/10/2026',
      status: 'deployed'
    }
  ]);

  // Modal create package
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('Công nghệ 12');
  const [newRoom, setNewRoom] = useState('Phòng Tin Học Số 1');
  const [newClients, setNewClients] = useState(50);

  const handleExportOfflinePackage = (pkgName?: string) => {
    soundEffects.playClick();
    setDownloadProgress(true);
    setTimeout(() => {
      setDownloadProgress(false);
      soundEffects.playCorrect();
      alert(`Đã đóng gói thành công gói thi Offline [${pkgName || 'TestOnline-Offline-THPT-MangThit.zip'}] cho phòng máy tính trường THPT Mang Thít!`);
    }, 1200);
  };

  const handleCreatePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    soundEffects.playClick();
    const created: OfflinePackageItem = {
      id: 'pkg-' + Date.now(),
      name: newName.trim().toUpperCase(),
      subject: newSubject,
      targetRoom: newRoom,
      maxClients: newClients,
      sizeMb: parseFloat((12 + Math.random() * 8).toFixed(1)),
      createdAt: new Date().toLocaleDateString('vi-VN'),
      status: 'ready'
    };

    setPackages(prev => [created, ...prev]);
    setIsCreateModalOpen(false);
    setNewName('');
    soundEffects.playCorrect();
  };

  const handleDeletePackage = (id: string, name: string) => {
    soundEffects.playClick();
    if (confirm(`Bạn có chắc chắn muốn xóa gói thi offline: "${name}"?`)) {
      setPackages(prev => prev.filter(p => p.id !== id));
      soundEffects.playCorrect();
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Kiểm tra Offline Phòng Máy</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Giải pháp thi trắc nghiệm trong phòng tin học nội bộ không phụ thuộc Internet • Tác giả: Hồ Tấn Khải - THPT Mang Thít
          </p>
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
            <span>Tạo mới gói thi</span>
          </button>

          <button
            onClick={() => handleExportOfflinePackage()}
            disabled={downloadProgress}
            className="btn-3d btn-3d-slate px-4 py-2 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <Download className="w-4 h-4 text-teal-600" />
            <span>{downloadProgress ? 'Đang xuất gói Offline...' : 'Xuất Gói Máy Chủ (LAN/USB)'}</span>
          </button>
        </div>
      </div>

      {/* Repository Table of Offline Packages */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900">Danh mục gói đề thi phòng máy offline</span>
            <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
              {packages.length} gói
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 font-bold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Tên gói đề thi</th>
                <th className="py-3 px-4 text-center">Môn học</th>
                <th className="py-3 px-4">Phòng máy áp dụng</th>
                <th className="py-3 px-4 text-center">Dung lượng</th>
                <th className="py-3 px-4 font-mono">Ngày tạo</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {packages.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-teal-600 shrink-0" />
                      <div>
                        <div>{pkg.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">Hỗ trợ tối đa {pkg.maxClients} máy con (Clients)</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                      {pkg.subject}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 font-medium">{pkg.targetRoom}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-teal-800">
                    {pkg.sizeMb} MB
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-500">{pkg.createdAt}</td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleExportOfflinePackage(pkg.name)}
                        className="btn-3d btn-3d-teal px-2.5 py-1 text-[11px] rounded-lg cursor-pointer inline-flex items-center gap-1 font-bold"
                        title="Tải gói về USB"
                      >
                        <Download className="w-3 h-3" />
                        <span>Tải về</span>
                      </button>
                      <button
                        onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Xóa gói thi này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {/* Modal: Tạo mới gói thi Offline */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">Tạo Gói Thi Offline Phòng Máy</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Tên gói đề thi:</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ví dụ: GÓI THI OFFLINE HK2 CÔNG NGHỆ 12"
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
                  <label className="block text-slate-700 mb-1 font-bold">Số lượng máy:</label>
                  <input
                    type="number"
                    value={newClients}
                    onChange={(e) => setNewClients(parseInt(e.target.value, 10) || 50)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">Phòng máy đích:</label>
                <input
                  type="text"
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  placeholder="Ví dụ: Phòng Tin Học Số 1 (Lầu 2)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-teal-500"
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
                  Đóng Gói Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
