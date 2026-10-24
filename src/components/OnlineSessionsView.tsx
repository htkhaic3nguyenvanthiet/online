import React, { useState } from 'react';
import {
  Send,
  Search,
  Filter,
  Copy,
  Share2,
  Eye,
  Trash2,
  StopCircle,
  Plus,
  QrCode,
  Check,
  Activity,
  Users
} from 'lucide-react';
import { ExamSession } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';

interface OnlineSessionsViewProps {
  sessions: ExamSession[];
  onCreateSession: () => void;
  onOpenLiveMonitor: (session: ExamSession) => void;
  onOpenStudentExam: (sessionId: string) => void;
}

export const OnlineSessionsView: React.FC<OnlineSessionsViewProps> = ({
  sessions,
  onCreateSession,
  onOpenLiveMonitor,
  onOpenStudentExam
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeQrModal, setActiveQrModal] = useState<ExamSession | null>(null);

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatusFilter === 'all' || s.status === selectedStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCopyLink = (session: ExamSession) => {
    soundEffects.playClick();
    navigator.clipboard?.writeText(session.shareUrl);
    setCopiedId(session.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Matching Screenshot 3 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Các phiên giao đề Online</h1>
          <p className="text-xs text-slate-500 mt-0.5">Theo dõi các phòng thi đang diễn ra và tự động nhận điểm trực tiếp</p>
        </div>

        <button
          onClick={() => {
            soundEffects.playClick();
            onCreateSession();
          }}
          className="btn-3d btn-3d-teal px-4 py-2 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo phiên giao đề mới</span>
        </button>
      </div>

      {/* Filter Bar matching Screenshot 3 */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Tìm theo tên đề thi:</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nhập tên đề thi"
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Lọc theo lớp học:</label>
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
          >
            <option value="all">Tất cả lớp học</option>
            <option value="12a5">Lớp 12A5</option>
            <option value="cnnn">Ôn thi tốt nghiệp CNNN</option>
            <option value="cn12">Ôn thi tốt nghiệp Công nghệ 12</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Trạng thái:</label>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang diễn ra</option>
            <option value="completed">Đã kết thúc</option>
          </select>
        </div>
      </div>

      {/* Sessions Table matching Screenshot 3 */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 font-bold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 min-w-[220px]">Tên</th>
                <th className="py-3 px-4 text-center">Đường dẫn</th>
                <th className="py-3 px-4 text-center">Hành động</th>
                <th className="py-3 px-4">Lớp học</th>
                <th className="py-3 px-4 font-mono">Ngày bắt đầu</th>
                <th className="py-3 px-4 font-mono">Ngày kết thúc</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredSessions.map((sess) => (
                <tr key={sess.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Tên */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 leading-snug">{sess.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 italic">(Đề kiểm tra: {sess.title})</div>
                  </td>

                  {/* Đường dẫn */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => handleCopyLink(sess)}
                        className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                        title="Sao chép link làm bài"
                      >
                        {copiedId === sess.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          setActiveQrModal(sess);
                        }}
                        className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                        title="Xem mã QR quét phòng thi"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </div>
                  </td>

                  {/* Hành động (Xem, Xóa, Hủy) matching screenshot */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          onOpenLiveMonitor(sess);
                        }}
                        className="px-2 py-0.5 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 cursor-pointer"
                        title="Theo dõi bảng điểm thời gian thực"
                      >
                        Xem
                      </button>
                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          onOpenStudentExam(sess.id);
                        }}
                        className="px-2 py-0.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 cursor-pointer"
                        title="Vào thi"
                      >
                        Vào thi
                      </button>
                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          alert(`Đã tạm dừng nhận bài của phiên: ${sess.title}`);
                        }}
                        className="px-2 py-0.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 cursor-pointer"
                      >
                        Huỷ
                      </button>
                    </div>
                  </td>

                  {/* Lớp học */}
                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                    {sess.className || 'N/A'}
                  </td>

                  {/* Ngày bắt đầu */}
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                    {sess.startTime}
                  </td>

                  {/* Ngày kết thúc */}
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                    {sess.endTime}
                  </td>

                  {/* Trạng thái */}
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Đang diễn ra
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Code Share Modal */}
      {activeQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100 space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">Quét mã QR để vào phòng thi</h3>
            <p className="text-xs text-slate-500">{activeQrModal.title}</p>

            {/* Simulated QR Code Canvas */}
            <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-teal-300 inline-block">
              <div className="w-48 h-48 bg-white border border-slate-300 p-2 flex flex-col items-center justify-center rounded-xl shadow-inner">
                <QrCode className="w-36 h-36 text-slate-800" />
                <span className="text-[10px] font-mono text-slate-500 font-bold mt-1">ID: {activeQrModal.id}</span>
              </div>
            </div>

            <div className="p-2.5 bg-teal-50 rounded-xl text-teal-800 text-xs font-mono break-all text-left">
              {activeQrModal.shareUrl}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleCopyLink(activeQrModal)}
                className="btn-3d btn-3d-teal flex-1 py-2 text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép Link</span>
              </button>
              <button
                onClick={() => setActiveQrModal(null)}
                className="btn-3d btn-3d-slate px-4 py-2 text-xs rounded-xl cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
