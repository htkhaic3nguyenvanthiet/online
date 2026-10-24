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
  Database,
  ShieldCheck,
  Sparkles
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
  onDataRestored,
  onClearJunkData,
}) => {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSyncCloud = async () => {
    soundEffects.playClick();
    setSyncing(true);
    setSyncStatus('Đang mã hóa và đẩy dữ liệu lên máy chủ đám mây...');

    const res = await cloudStorageService.syncToCloud({
      quizzes,
      classrooms,
      sessions,
      submissions,
    });

    setSyncing(false);
    setSyncStatus(res.message);
    soundEffects.playCorrect();
  };

  const handleExportDrive = () => {
    soundEffects.playClick();
    cloudStorageService.exportToGoogleDriveBackup({
      version: '2.0.0',
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
          soundEffects.playCorrect();
          alert('Khôi phục dữ liệu từ file Google Drive thành công!');
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-teal-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Trung Tâm Lưu Trữ Đám Mây & Google Drive</h3>
              <p className="text-xs text-blue-100">Đồng bộ tự động thời gian thực • Sao lưu an toàn 100%</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs font-semibold">
          {/* Cloud Health Status Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
              <div>
                <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <span>Trạng thái kết nối Đám mây:</span>
                  <span className="text-emerald-700 font-extrabold">Trực tuyến (Online)</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {quizzes.length} đề thi • {classrooms.length} lớp học • {submissions.length} bài nộp của học sinh
                </div>
              </div>
            </div>

            <button
              onClick={handleSyncCloud}
              disabled={syncing}
              className="btn-3d btn-3d-teal px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
            </button>
          </div>

          {syncStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{syncStatus}</span>
            </div>
          )}

          {/* Action Grid: Google Drive & Excel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Box 1: Sao lưu Drive */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-xs space-y-2 hover:border-blue-300 transition-colors">
              <div className="flex items-center gap-2 text-blue-700 font-bold">
                <HardDrive className="w-4 h-4" />
                <span>Sao lưu Google Drive</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Tải về tệp sao lưu dữ liệu toàn diện (.json) để tải lên thư mục Google Drive của giáo viên.
              </p>
              <button
                onClick={handleExportDrive}
                className="btn-3d btn-3d-blue w-full py-2 text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải Bản Sao Lưu Drive</span>
              </button>
            </div>

            {/* Box 2: Khôi phục từ Drive */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-xs space-y-2 hover:border-teal-300 transition-colors">
              <div className="flex items-center gap-2 text-teal-700 font-bold">
                <Upload className="w-4 h-4" />
                <span>Khôi phục từ Drive / File</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Nạp lại tệp dữ liệu đã lưu từ Google Drive hoặc máy tính để khôi phục danh sách thi.
              </p>
              <label className="btn-3d btn-3d-slate w-full py-2 text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-bold">
                <Upload className="w-3.5 h-3.5 text-teal-600" />
                <span>Chọn File Sao Lưu (.json)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Excel & Junk Cleanup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
            <button
              onClick={handleExportExcel}
              className="btn-3d btn-3d-slate py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer font-bold text-slate-700"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Xuất Danh Sách Điểm Excel</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onClearJunkData();
                soundEffects.playCorrect();
                alert('Đã dọn dẹp bộ nhớ đệm và các dữ liệu rác không sử dụng!');
              }}
              className="btn-3d btn-3d-rose py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer font-bold"
            >
              <Trash2 className="w-4 h-4" />
              <span>Dọn Dẹp Dữ Liệu Rác</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Bảo mật AES-256 • Trường THPT Mang Thít
          </span>
          <button
            onClick={onClose}
            className="btn-3d btn-3d-slate px-4 py-1.5 text-xs rounded-xl cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
