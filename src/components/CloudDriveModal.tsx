import React, { useState } from 'react';
import {
  Cloud,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  Trash2,
  X,
  FileSpreadsheet,
  KeyRound,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Laptop
} from 'lucide-react';
import { Quiz, Classroom, ExamSession, StudentSubmission } from '../types/quiz';
import { cloudStorageService } from '../services/cloudStorageService';
import { soundEffects } from '../utils/soundEffects';

interface CloudDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizzes: Quiz[];
  classrooms: Classroom[];
  sessions: ExamSession[];
  submissions: StudentSubmission[];
  autoBackupEnabled: boolean;
  onToggleAutoBackup: (enabled: boolean) => void;
  currentSyncKey: string;
  onChangeSyncKey: (key: string) => void;
  onDataRestored: (data: {
    quizzes: Quiz[];
    classrooms: Classroom[];
    sessions: ExamSession[];
  }) => void;
  onClearJunkData: () => void;
}

export const CloudDriveModal: React.FC<CloudDriveModalProps> = ({
  isOpen,
  onClose,
  quizzes,
  classrooms,
  sessions,
  submissions,
  autoBackupEnabled,
  onToggleAutoBackup,
  currentSyncKey,
  onChangeSyncKey,
  onDataRestored,
  onClearJunkData,
}) => {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Sync Key input for other computer
  const [remoteKeyInput, setRemoteKeyInput] = useState('');
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);

  // Edit custom key
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState(currentSyncKey);

  if (!isOpen) return null;

  const handleSyncCloud = async () => {
    soundEffects.playClick();
    setSyncing(true);
    setSyncStatus('Đang mã hóa và đẩy toàn bộ đề thi lên máy chủ đám mây...');

    const res = await cloudStorageService.syncToCloud(
      {
        quizzes,
        classrooms,
        sessions,
        submissions,
      },
      currentSyncKey
    );

    setSyncing(false);
    setSyncStatus(res.message);
    soundEffects.playCorrect();
  };

  const handleCopySyncKey = () => {
    soundEffects.playClick();
    navigator.clipboard?.writeText(currentSyncKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleApplyCustomKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customKeyInput.trim()) return;

    soundEffects.playClick();
    const updated = cloudStorageService.setSyncKey(customKeyInput);
    onChangeSyncKey(updated);
    setIsEditingKey(false);
    setSyncStatus(`Đã đổi Mã Khóa Đồng Bộ thành: ${updated}`);
    soundEffects.playCorrect();
  };

  const handleFetchFromRemoteKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = remoteKeyInput.trim().toUpperCase();
    if (!key) {
      alert('Vui lòng nhập Mã Khóa Đồng Bộ!');
      return;
    }

    soundEffects.playClick();
    setIsFetchingRemote(true);
    setSyncStatus(`Đang kết nối tới máy chủ để tải dữ liệu của Key [${key}]...`);

    const data = await cloudStorageService.fetchFromCloud(key);
    setIsFetchingRemote(false);

    if (data && (data.quizzes || data.classrooms || data.sessions)) {
      onDataRestored({
        quizzes: data.quizzes || [],
        classrooms: data.classrooms || [],
        sessions: data.sessions || [],
      });
      cloudStorageService.setSyncKey(key);
      onChangeSyncKey(key);
      soundEffects.playCorrect();
      setSyncStatus(`✓ Đồng bộ thành công ${data.quizzes?.length || 0} đề thi, ${data.classrooms?.length || 0} lớp từ máy chủ!`);
      alert(`Đã nạp toàn bộ dữ liệu từ máy chủ thành công với Mã Khóa [${key}]! Không bị mất dữ liệu.`);
      setRemoteKeyInput('');
    } else {
      soundEffects.playWarning();
      setSyncStatus(`Không tìm thấy dữ liệu trên máy chủ cho Mã Khóa [${key}]!`);
      alert(`Không tìm thấy dữ liệu trên máy chủ cho Mã Khóa [${key}]. Vui lòng kiểm tra lại chính xác mã khóa.`);
    }
  };

  const handleExportDrive = () => {
    soundEffects.playClick();
    cloudStorageService.exportToGoogleDriveBackup({
      version: '2.5.0',
      syncKey: currentSyncKey,
      lastSyncedAt: new Date().toLocaleString('vi-VN'),
      quizzes,
      classrooms,
      sessions,
      submissions,
    });
    soundEffects.playCorrect();
  };

  const handleExportExcel = () => {
    soundEffects.playClick();
    cloudStorageService.exportClassroomsToExcel(classrooms);
    soundEffects.playCorrect();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.quizzes && parsed.classrooms) {
          onDataRestored({
            quizzes: parsed.quizzes,
            classrooms: parsed.classrooms,
            sessions: parsed.sessions || [],
          });
          if (parsed.syncKey) {
            cloudStorageService.setSyncKey(parsed.syncKey);
            onChangeSyncKey(parsed.syncKey);
          }
          soundEffects.playCorrect();
          alert('Khôi phục dữ liệu từ tệp sao lưu thành công 100%!');
          onClose();
        } else {
          alert('Tệp sao lưu không đúng định dạng của Test Online');
        }
      } catch (err) {
        alert('Không thể đọc tệp sao lưu JSON!');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-teal-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base">Máy Chủ Lưu Trữ & Đồng Bộ Google Drive</h3>
                <span className="bg-emerald-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  v2.5 Pro
                </span>
              </div>
              <p className="text-xs text-blue-100">Lưu dữ liệu câu hỏi lên máy chủ • Không sợ mất đề thi khi đổi máy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 text-xs font-semibold max-h-[80vh] overflow-y-auto">
          {/* SECTION 1: NÚT TÍCH TỰ ĐỘNG SAO LƯU (User requirement) */}
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={(e) => {
                    soundEffects.playClick();
                    onToggleAutoBackup(e.target.checked);
                    if (e.target.checked) {
                      soundEffects.playCorrect();
                    }
                  }}
                  className="w-5 h-5 mt-0.5 text-teal-600 rounded-md border-slate-300 focus:ring-teal-500 cursor-pointer shrink-0 accent-teal-600"
                />
                <div>
                  <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <span>Tự động sao lưu dữ liệu lên máy chủ</span>
                    <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full">
                      Khuyên Dùng
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-normal mt-1 leading-relaxed">
                    Khi bật tính năng này, mỗi khi Thầy/Cô nạp câu hỏi Word, tạo đề mới, sửa đề hoặc giao bài cho học sinh, hệ thống sẽ <strong className="text-emerald-800">ngay lập tức lưu trữ lên máy chủ</strong>. Học sinh khi mở link bài thi ở bất kỳ điện thoại hay máy tính nào đều lập tức nhìn thấy câu hỏi để làm bài.
                  </p>
                </div>
              </label>

              <button
                onClick={handleSyncCloud}
                disabled={syncing}
                className="btn-3d btn-3d-teal px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm font-bold"
                title="Bấm để đồng bộ dữ liệu ngay lập tức"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Đang lưu...' : 'Sao Lưu Ngay'}</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: KEY ĐỒNG BỘ ĐỔI MÁY (User requirement) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span>Mã Khóa Đồng Bộ Của Bạn (Sync Key):</span>
              </div>
              <button
                onClick={() => setIsEditingKey(!isEditingKey)}
                className="text-[11px] text-teal-600 hover:text-teal-800 font-bold underline cursor-pointer"
              >
                {isEditingKey ? 'Hủy đổi' : 'Đổi mã khóa'}
              </button>
            </div>

            {/* Current Sync Key Badge and Copy button */}
            {!isEditingKey ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-300 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-mono text-sm sm:text-base font-black text-indigo-700 tracking-wider">
                    {currentSyncKey}
                  </span>
                </div>
                <button
                  onClick={handleCopySyncKey}
                  className="btn-3d btn-3d-slate px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 font-bold cursor-pointer"
                  title="Sao chép mã khóa"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? 'Đã sao chép!' : 'Sao chép Key'}</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCustomKey} className="flex gap-2">
                <input
                  type="text"
                  value={customKeyInput}
                  onChange={(e) => setCustomKeyInput(e.target.value)}
                  placeholder="Nhập mã khóa mới (VD: THPT-MANGTHIT-2026)"
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold uppercase"
                />
                <button
                  type="submit"
                  className="btn-3d btn-3d-teal px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Lưu Key
                </button>
              </form>
            )}

            {/* SYNC FROM ANOTHER COMPUTER */}
            <div className="pt-2 border-t border-slate-200">
              <div className="text-[11px] text-slate-700 font-bold mb-2 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-blue-600" />
                <span>Khi Thầy/Cô sang máy tính khác: Nhập mã khóa để nạp đề thi về:</span>
              </div>
              <form onSubmit={handleFetchFromRemoteKey} className="flex gap-2">
                <input
                  type="text"
                  value={remoteKeyInput}
                  onChange={(e) => setRemoteKeyInput(e.target.value)}
                  placeholder="Dán mã khóa từ máy cũ vào đây..."
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs uppercase"
                />
                <button
                  type="submit"
                  disabled={isFetchingRemote}
                  className="btn-3d btn-3d-blue px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 font-bold cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingRemote ? 'animate-spin' : ''}`} />
                  <span>{isFetchingRemote ? 'Đang tải...' : 'Đồng Bộ Từ Máy Chủ'}</span>
                </button>
              </form>
              <p className="text-[10px] text-slate-500 mt-1.5">
                Hệ thống sẽ tải toàn bộ {quizzes.length} đề thi, danh sách câu hỏi và lớp học từ máy chủ về máy mới ngay lập tức, hoàn toàn không bị mất dữ liệu.
              </p>
            </div>
          </div>

          {/* Sync Status Banner */}
          {syncStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{syncStatus}</span>
            </div>
          )}

          {/* SECTION 3: ĐỒNG BỘ LÊN TÀI KHOẢN GOOGLE DRIVE */}
          <div className="border border-blue-200 bg-blue-50/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-900 font-extrabold text-sm">
                <HardDrive className="w-4 h-4 text-blue-600" />
                <span>Đồng bộ lên tài khoản Google Drive</span>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                Google Drive Storage
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              Sao lưu dự phòng an toàn lên Google Drive của giáo viên. Bạn có thể tải tệp về để lưu vào Google Drive hoặc nạp lại bất cứ lúc nào.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleExportDrive}
                className="btn-3d btn-3d-blue w-full py-2.5 text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer font-bold"
              >
                <Download className="w-4 h-4" />
                <span>Xuất Bản Sao Lưu Drive (.json)</span>
              </button>

              <label className="btn-3d btn-3d-slate w-full py-2.5 text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer font-bold text-slate-700">
                <Upload className="w-4 h-4 text-teal-600" />
                <span>Nạp Lại Từ File Drive (.json)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* SECTION 4: EXCEL & DỌN DẸP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleExportExcel}
              className="btn-3d btn-3d-slate py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer font-bold text-slate-700"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Xuất Bảng Điểm & Học Sinh Excel</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onClearJunkData();
                soundEffects.playCorrect();
                alert('Đã dọn dẹp các bộ nhớ đệm rác không cần thiết!');
              }}
              className="btn-3d btn-3d-rose py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer font-bold"
            >
              <Trash2 className="w-4 h-4" />
              <span>Dọn Dẹp Dữ Liệu Rác Cục Bộ</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 font-mono">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Mã hóa bảo mật • THPT Mang Thít (Hồ Tấn Khải)</span>
          </div>
          <button
            onClick={onClose}
            className="btn-3d btn-3d-slate px-4 py-1.5 text-xs rounded-xl cursor-pointer font-bold"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
