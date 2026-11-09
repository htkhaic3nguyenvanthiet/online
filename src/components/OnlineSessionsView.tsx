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
  Users,
  PlayCircle,
  Clock,
  X,
  Settings,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Calendar,
  Lock,
  Layers,
  ClipboardCheck,
  Award,
  Sliders,
  CheckCircle2,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { ExamSession, Quiz, AntiCheatConfig } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';
import { getStudentExamShareUrl } from '../utils/urlHelper';

interface OnlineSessionsViewProps {
  sessions: ExamSession[];
  quizzes?: Quiz[];
  onCreateSession: () => void;
  onOpenLiveMonitor: (session: ExamSession) => void;
  onOpenStudentExam: (sessionId: string) => void;
  onOpenAttendanceSummary?: (session: ExamSession) => void;
  onToggleSessionStatus?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onAddNewSession?: (newSession: ExamSession) => void;
  onUpdateSession?: (updatedSession: ExamSession) => void;
}

export const OnlineSessionsView: React.FC<OnlineSessionsViewProps> = ({
  sessions,
  quizzes = [],
  onCreateSession,
  onOpenLiveMonitor,
  onOpenStudentExam,
  onOpenAttendanceSummary,
  onToggleSessionStatus,
  onDeleteSession,
  onAddNewSession,
  onUpdateSession
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeQrModal, setActiveQrModal] = useState<ExamSession | null>(null);

  // Configure / Assign Modal State
  const [configModalSession, setConfigModalSession] = useState<ExamSession | null>(null);
  const [configModalTab, setConfigModalTab] = useState<'scoring' | 'timing' | 'answer-key' | 'proctoring'>('scoring');

  // New Session Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newModalTab, setNewModalTab] = useState<'basic' | 'scoring' | 'answer-key' | 'proctoring'>('basic');
  const [selectedQuizId, setSelectedQuizId] = useState<string>(() => quizzes[0]?.id || '');
  const [newTitle, setNewTitle] = useState(() => quizzes[0]?.title || '');
  const [newClass, setNewClass] = useState('Tất cả lớp học (Khối 12)');
  const [newDuration, setNewDuration] = useState(() => quizzes[0]?.durationMinutes || 50);
  const [newAttempts, setNewAttempts] = useState(1);
  const [newStartTime, setNewStartTime] = useState(
    new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN')
  );
  const [newEndTime, setNewEndTime] = useState('23:59 31/12/2026');
  const [newMaxTabSwitches, setNewMaxTabSwitches] = useState(3);
  const [newRequireFullscreen, setNewRequireFullscreen] = useState(false);
  const [newPreventCopyPaste, setNewPreventCopyPaste] = useState(true);

  // New Session Scoring Config (Circular 22 10-point scale)
  const [newPart1PerQ, setNewPart1PerQ] = useState(0.25);
  const [newPart2PerQ, setNewPart2PerQ] = useState(1.0);
  const [newPart3PerQ, setNewPart3PerQ] = useState(0.25);
  const [newAllowViewKey, setNewAllowViewKey] = useState(true);
  const [newMinScore, setNewMinScore] = useState(4.0);
  const [newAllowAiTutor, setNewAllowAiTutor] = useState(true);

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatusFilter === 'all' || s.status === selectedStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCopyLink = (session: ExamSession) => {
    soundEffects.playClick();
    const link = getStudentExamShareUrl(session.id);
    navigator.clipboard?.writeText(link);
    setCopiedId(session.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateNewSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundEffects.playClick();

    const chosenQuiz = quizzes.find((q) => q.id === selectedQuizId) || quizzes[0];
    const totalQCount = (chosenQuiz?.questions && chosenQuiz.questions.length > 0)
      ? chosenQuiz.questions.length
      : (chosenQuiz?.questionCount || 28);

    const newId = 'sess-' + Math.floor(1000000 + Math.random() * 9000000);
    const created: ExamSession = {
      id: newId,
      title: newTitle.trim() || chosenQuiz?.title || 'Bài thi trực tuyến',
      quizId: chosenQuiz?.id || 'custom-quiz',
      className: newClass,
      startTime: newStartTime,
      endTime: newEndTime,
      status: 'active',
      shareUrl: getStudentExamShareUrl(newId),
      allowedAttempts: newAttempts,
      durationMinutes: newDuration,
      totalSubmissions: 0,
      maxSlots: 500,
      isArenaMode: true,
      questionCount: totalQCount,
      scoringConfig: {
        totalPoints: 10.0,
        durationMinutes: newDuration,
        part1PointPerQuestion: newPart1PerQ,
        part2PointPerQuestion: newPart2PerQ,
        part3PointPerQuestion: newPart3PerQ,
        allowViewAnswerKey: newAllowViewKey,
        viewAnswerMinScore: newMinScore,
        allowAiTutorExplanation: newAllowAiTutor
      },
      antiCheatConfig: {
        maxTabSwitches: newMaxTabSwitches,
        autoSubmitOnExceed: true,
        requireFullscreen: newRequireFullscreen,
        preventCopyPaste: newPreventCopyPaste,
        shuffleQuestions: true,
        shuffleOptions: true,
        blockAIInExam: true
      }
    };

    onAddNewSession?.(created);
    setIsNewModalOpen(false);
    setNewTitle('');
    soundEffects.playCorrect();
  };

  const handleSaveConfigSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configModalSession) return;

    soundEffects.playClick();
    onUpdateSession?.(configModalSession);
    setConfigModalSession(null);
    soundEffects.playCorrect();
  };

  return (
    <div className="space-y-6">
      {/* Title & Top Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Các phiên giao đề Online</h1>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
              Chống gian lận & Giám sát AI
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý số lượt làm bài, thời gian làm, thời hạn nộp và tự động nhận điểm trực tiếp về máy chủ của Thầy Hồ Tấn Khải
          </p>
        </div>

        <button
          onClick={() => {
            soundEffects.playClick();
            setIsNewModalOpen(true);
          }}
          className="btn-3d btn-3d-teal px-4 py-2 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo phiên giao đề mới</span>
        </button>
      </div>

      {/* Filter Bar */}
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
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
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
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang diễn ra</option>
            <option value="completed">Đã kết thúc / Tạm dừng</option>
          </select>
        </div>
      </div>

      {/* Sessions Table with Professional Assignment Columns */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 font-bold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 min-w-[200px]">Tên bài kiểm tra</th>
                <th className="py-3 px-4 text-center">Giao đề & Cài đặt</th>
                <th className="py-3 px-4 text-center">Thời lượng</th>
                <th className="py-3 px-4 text-center">Số câu hỏi</th>
                <th className="py-3 px-4 text-center">Số lượt làm</th>
                <th className="py-3 px-4 min-w-[140px]">Thời hạn nộp</th>
                <th className="py-3 px-4 text-center">Giám sát chống gian lận</th>
                <th className="py-3 px-4 text-center">Hành động</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredSessions.map((sess) => {
                const maxTabs = sess.antiCheatConfig?.maxTabSwitches ?? 3;
                const linkedQuiz = quizzes.find((q) => q.id === sess.quizId || q.title === sess.title);
                const realQCount = sess.questionCount || (linkedQuiz?.questions && linkedQuiz.questions.length > 0 ? linkedQuiz.questions.length : linkedQuiz?.questionCount) || 28;
                const qBreakdown = linkedQuiz?.breakdown || `${realQCount}-0-0-0`;

                return (
                  <tr key={sess.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Tên */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 leading-snug">{sess.title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>Lớp: <strong className="text-slate-600">{sess.className || 'Toàn trường'}</strong></span>
                        <span>• Mã: {sess.id}</span>
                      </div>
                    </td>

                    {/* Giao đề & Cài đặt (Button to configure attempts, time, deadlines) */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          const toConfig: ExamSession = JSON.parse(JSON.stringify(sess));
                          if (!toConfig.scoringConfig) {
                            toConfig.scoringConfig = {
                              totalPoints: 10.0,
                              durationMinutes: toConfig.durationMinutes || 50,
                              part1PointPerQuestion: 0.25,
                              part2PointPerQuestion: 1.0,
                              part3PointPerQuestion: 0.25,
                              allowViewAnswerKey: true,
                              viewAnswerMinScore: 4.0,
                              allowAiTutorExplanation: true,
                            };
                          }
                          setConfigModalSession(toConfig);
                          setConfigModalTab('scoring');
                        }}
                        className="btn-3d btn-3d-slate px-2.5 py-1 text-[11px] rounded-lg font-bold flex items-center justify-center gap-1 mx-auto cursor-pointer"
                        title="Tùy chỉnh cấu hình điểm, xem đáp án, thời gian thi"
                      >
                        <Settings className="w-3.5 h-3.5 text-teal-600" />
                        <span>Cài đặt giao đề</span>
                      </button>
                    </td>

                    {/* Thời lượng */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {sess.durationMinutes}&apos;
                      </span>
                    </td>

                    {/* Số câu hỏi */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block bg-teal-50 text-teal-800 border border-teal-200 font-black text-xs px-2.5 py-1 rounded-lg">
                        {realQCount} câu
                      </span>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {qBreakdown}
                      </div>
                    </td>

                    {/* Số lượt làm */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block font-bold text-[11px] px-2 py-0.5 rounded-md ${
                          sess.allowedAttempts === 1
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : sess.allowedAttempts === 0
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {sess.allowedAttempts === 0
                          ? 'Vô hạn lượt'
                          : sess.allowedAttempts === 1
                          ? '1 lượt duy nhất'
                          : `${sess.allowedAttempts} lượt`}
                      </span>
                    </td>

                    {/* Thời hạn nộp */}
                    <td className="py-3.5 px-4 text-[11px] font-mono text-slate-600">
                      <div>Từ: {sess.startTime}</div>
                      <div className="text-slate-900 font-bold">Đến: {sess.endTime}</div>
                    </td>

                    {/* Giám sát chống gian lận */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>Chặn {maxTabs} tab • Khóa AI</span>
                      </span>
                    </td>

                    {/* Hành động */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => {
                            soundEffects.playClick();
                            onOpenStudentExam(sess.id);
                          }}
                          className="px-2.5 py-1 text-[11px] font-black text-rose-700 bg-rose-50 border border-rose-300 rounded-md hover:bg-rose-100 cursor-pointer shadow-xs"
                          title="Vào giao diện làm bài thi trực tuyến"
                        >
                          Vào thi
                        </button>
                        {onOpenAttendanceSummary && (
                          <button
                            onClick={() => {
                              soundEffects.playClick();
                              onOpenAttendanceSummary(sess);
                            }}
                            className="px-2 py-1 text-[11px] font-black text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-md hover:bg-emerald-100 cursor-pointer flex items-center gap-1 shadow-xs"
                            title="Bảng tổng kết điểm số và điểm danh học sinh của bài kiểm tra này"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Điểm danh</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            soundEffects.playClick();
                            onOpenLiveMonitor(sess);
                          }}
                          className="px-2 py-1 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 cursor-pointer"
                          title="Theo dõi bảng điểm thời gian thực"
                        >
                          Giám sát
                        </button>
                        <button
                          onClick={() => handleCopyLink(sess)}
                          className="p-1 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="Sao chép link làm bài"
                        >
                          {copiedId === sess.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => {
                            soundEffects.playClick();
                            setActiveQrModal(sess);
                          }}
                          className="p-1 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="Xem mã QR quét phòng thi"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            soundEffects.playClick();
                            onToggleSessionStatus?.(sess.id);
                          }}
                          className="px-1.5 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-50 rounded cursor-pointer"
                        >
                          {sess.status === 'active' ? 'Dừng' : 'Mở'}
                        </button>
                        <button
                          onClick={() => {
                            soundEffects.playClick();
                            if (confirm(`Bạn có chắc muốn xóa phiên: "${sess.title}"?`)) {
                              onDeleteSession?.(sess.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Xóa phiên"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Trạng thái */}
                    <td className="py-3.5 px-4 text-center">
                      {sess.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Đang mở
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-full">
                          Đã đóng
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CÀI ĐẶT GIAO ĐỀ THI & QUY CHẾ ĐIỂM SỐ (WORLD-CLASS CONFIGURATION MODAL) */}
      {configModalSession && (() => {
        const linkedQuiz = quizzes.find((q) => q.id === configModalSession.quizId || q.title === configModalSession.title);
        const p1Count = linkedQuiz?.questions?.filter(q => q.partType === 'part1_choice' || (!q.partType && q.options && q.options.length > 0)).length || 18;
        const p2Count = linkedQuiz?.questions?.filter(q => q.partType === 'part2_true_false').length || 4;
        const p3Count = linkedQuiz?.questions?.filter(q => q.partType === 'part3_short_answer').length || 6;
        const totalCount = p1Count + p2Count + p3Count;

        const sc = configModalSession.scoringConfig || {
          totalPoints: 10.0,
          durationMinutes: configModalSession.durationMinutes || 50,
          part1PointPerQuestion: 0.25,
          part2PointPerQuestion: 1.0,
          part3PointPerQuestion: 0.25,
          allowViewAnswerKey: true,
          viewAnswerMinScore: 4.0,
          allowAiTutorExplanation: true,
        };

        const p1Nominal = +(p1Count * sc.part1PointPerQuestion).toFixed(2);
        const p2Nominal = +(p2Count * sc.part2PointPerQuestion).toFixed(2);
        const p3Nominal = +(p3Count * sc.part3PointPerQuestion).toFixed(2);
        const totalNominal = +(p1Nominal + p2Nominal + p3Nominal).toFixed(2);
        const p1Percent = totalNominal > 0 ? Math.round((p1Nominal / totalNominal) * 100) : 45;
        const p2Percent = totalNominal > 0 ? Math.round((p2Nominal / totalNominal) * 100) : 40;
        const p3Percent = totalNominal > 0 ? Math.max(0, 100 - p1Percent - p2Percent) : 15;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                    <Sliders className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                      <span>Thiết Lập Điểm Số & Quy Chế Thi</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                        Thông tư 22
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">{configModalSession.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setConfigModalSession(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 shrink-0 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setConfigModalTab('scoring')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                    configModalTab === 'scoring'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Cấu hình Điểm TT 22</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfigModalTab('timing')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                    configModalTab === 'timing'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Thời Gian & Lượt Thi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfigModalTab('answer-key')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                    configModalTab === 'answer-key'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Xem Đáp Án & Ngưỡng Mở</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfigModalTab('proctoring')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                    configModalTab === 'proctoring'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Chống Gian Lận (Proctor)</span>
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveConfigSettings} className="space-y-4 flex-1 overflow-y-auto pr-1 text-xs">
                {/* TAB 1: CẤU HÌNH ĐIỂM SỐ THEO THÔNG TƯ 22 (THANG ĐIỂM 10) */}
                {configModalTab === 'scoring' && (
                  <div className="space-y-4">
                    {/* Header banner */}
                    <div className="p-3.5 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl border border-teal-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-teal-700" />
                        <div>
                          <span className="font-extrabold text-teal-900 text-xs">
                            Thang điểm tối đa chuẩn hóa: 10.0 Điểm
                          </span>
                          <p className="text-[11px] text-teal-700">
                            Áp dụng quy chế Thông tư 22 BGD&ĐT: Bất kể số lượng câu hỏi, tổng điểm luôn quy về thang điểm 10.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono bg-teal-200/80 text-teal-900 px-2 py-1 rounded-md font-bold">
                        Tổng: {totalCount} câu
                      </span>
                    </div>

                    {/* Section Point Distribution Inputs */}
                    <div className="space-y-3">
                      {/* Phần I */}
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-black text-[11px] flex items-center justify-center">I</span>
                            <span className="font-bold text-slate-800">Phần I: Trắc nghiệm 4 phương án</span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Có {p1Count} câu hỏi • Chọn 1 đáp án đúng trong A, B, C, D
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <label className="text-[11px] font-semibold text-slate-600">Điểm/câu:</label>
                            <input
                              type="number"
                              step="0.05"
                              min="0.05"
                              max="5"
                              value={sc.part1PointPerQuestion}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0.25;
                                setConfigModalSession({
                                  ...configModalSession,
                                  scoringConfig: { ...sc, part1PointPerQuestion: val }
                                });
                              }}
                              className="w-18 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-xs"
                            />
                            <span className="text-slate-500 text-[11px]">đ</span>
                          </div>
                          <span className="text-[11px] font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-bold">
                            = {p1Nominal}đ ({p1Percent}%)
                          </span>
                        </div>
                      </div>

                      {/* Phần II */}
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center">II</span>
                            <span className="font-bold text-slate-800">Phần II: Câu hỏi Đúng / Sai (a, b, c, d)</span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Có {p2Count} câu • Thang lũy tiến TT22: 1 ý=0.1đ, 2 ý=0.25đ, 3 ý=0.5đ, 4 ý=1.0đ
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <label className="text-[11px] font-semibold text-slate-600">Điểm tối đa/câu:</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              max="5"
                              value={sc.part2PointPerQuestion}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 1.0;
                                setConfigModalSession({
                                  ...configModalSession,
                                  scoringConfig: { ...sc, part2PointPerQuestion: val }
                                });
                              }}
                              className="w-18 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-xs"
                            />
                            <span className="text-slate-500 text-[11px]">đ</span>
                          </div>
                          <span className="text-[11px] font-mono bg-emerald-100 text-emerald-800 px-2 py-1 rounded-md font-bold">
                            = {p2Nominal}đ ({p2Percent}%)
                          </span>
                        </div>
                      </div>

                      {/* Phần III */}
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-amber-600 text-white font-black text-[11px] flex items-center justify-center">III</span>
                            <span className="font-bold text-slate-800">Phần III: Câu hỏi trả lời ngắn (Điền số)</span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Có {p3Count} câu • Ô nhập tối đa 4 ký tự số
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <label className="text-[11px] font-semibold text-slate-600">Điểm/câu:</label>
                            <input
                              type="number"
                              step="0.05"
                              min="0.05"
                              max="5"
                              value={sc.part3PointPerQuestion}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0.25;
                                setConfigModalSession({
                                  ...configModalSession,
                                  scoringConfig: { ...sc, part3PointPerQuestion: val }
                                });
                              }}
                              className="w-18 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-xs"
                            />
                            <span className="text-slate-500 text-[11px]">đ</span>
                          </div>
                          <span className="text-[11px] font-mono bg-amber-100 text-amber-800 px-2 py-1 rounded-md font-bold">
                            = {p3Nominal}đ ({p3Percent}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Matrix visual breakdown */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700">Tỉ lệ ma trận điểm thành phần:</span>
                        <span className="font-mono text-slate-600">
                          Tổng điểm thô: <strong>{totalNominal}đ</strong> → Tự động quy về <strong>10.0đ</strong>
                        </span>
                      </div>
                      <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-200">
                        <div style={{ width: `${p1Percent}%` }} className="bg-blue-600 h-full" title={`Phần I: ${p1Percent}%`} />
                        <div style={{ width: `${p2Percent}%` }} className="bg-emerald-600 h-full" title={`Phần II: ${p2Percent}%`} />
                        <div style={{ width: `${p3Percent}%` }} className="bg-amber-600 h-full" title={`Phần III: ${p3Percent}%`} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600"></span> Phần I ({p1Percent}%)</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600"></span> Phần II ({p2Percent}%)</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-600"></span> Phần III ({p3Percent}%)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: THỜI GIAN & SỐ LƯỢT THI */}
                {configModalTab === 'timing' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tên bài kiểm tra / Đề thi:</label>
                      <input
                        type="text"
                        required
                        value={configModalSession.title}
                        onChange={(e) => setConfigModalSession({ ...configModalSession, title: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:border-teal-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                          <RotateCcw className="w-3.5 h-3.5 text-blue-600" /> Số lượt thi cho phép:
                        </label>
                        <select
                          value={configModalSession.allowedAttempts}
                          onChange={(e) =>
                            setConfigModalSession({
                              ...configModalSession,
                              allowedAttempts: parseInt(e.target.value, 10)
                            })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800"
                        >
                          <option value={1}>1 lượt duy nhất (Kiểm tra chính thức)</option>
                          <option value={2}>2 lượt làm bài</option>
                          <option value={3}>3 lượt làm bài</option>
                          <option value={5}>5 lượt làm bài</option>
                          <option value={0}>Không giới hạn (Ôn tập tự do)</option>
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Học sinh hoàn thành hết số lượt sẽ không thể nộp thêm.
                        </p>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> Thời gian làm bài (Phút):
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={configModalSession.durationMinutes}
                          onChange={(e) =>
                            setConfigModalSession({
                              ...configModalSession,
                              durationMinutes: parseInt(e.target.value, 10) || 50
                            })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800"
                        />
                        <div className="flex items-center gap-1 mt-1.5">
                          {[15, 45, 50, 60, 90].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => setConfigModalSession({ ...configModalSession, durationMinutes: mins })}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${configModalSession.durationMinutes === mins ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                            >
                              {mins}&apos;
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-teal-600" />
                        <span>Thời hạn mở & Đóng đề thi:</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Thời gian mở đề:</label>
                          <input
                            type="text"
                            value={configModalSession.startTime}
                            onChange={(e) => setConfigModalSession({ ...configModalSession, startTime: e.target.value })}
                            placeholder="VD: 07:00 25/10/2025"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Thời hạn kết thúc:</label>
                          <input
                            type="text"
                            value={configModalSession.endTime}
                            onChange={(e) => setConfigModalSession({ ...configModalSession, endTime: e.target.value })}
                            placeholder="VD: 23:59 31/12/2026"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: TÙY CHỌN XEM ĐÁP ÁN & ĐIỀU KIỆN ĐỦ ĐIỂM */}
                {configModalTab === 'answer-key' && (
                  <div className="space-y-4">
                    {/* Toggle Allow Viewing */}
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800 text-xs">
                          Cho phép học sinh xem đáp án sau khi nộp bài
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Tắt nếu muốn giữ bí mật toàn bộ đáp án cho đến khi cả lớp hoàn thành kiểm tra.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={sc.allowViewAnswerKey}
                        onChange={(e) =>
                          setConfigModalSession({
                            ...configModalSession,
                            scoringConfig: { ...sc, allowViewAnswerKey: e.target.checked }
                          })
                        }
                        className="w-5 h-5 text-teal-600 rounded cursor-pointer"
                      />
                    </div>

                    {/* Minimum Score Threshold Setting */}
                    {sc.allowViewAnswerKey && (
                      <div className="p-4 bg-teal-50/70 rounded-2xl border border-teal-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-teal-700" />
                            <span className="font-bold text-teal-950 text-xs">
                              Mức điểm tối thiểu để MỞ KHÓA đáp án đúng:
                            </span>
                          </div>
                          <span className="text-base font-black font-mono text-teal-900 bg-white px-3 py-1 rounded-xl border border-teal-300 shadow-xs">
                            ≥ {sc.viewAnswerMinScore.toFixed(1)} / 10.0 đ
                          </span>
                        </div>

                        {/* Slider */}
                        <div className="space-y-1">
                          <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={sc.viewAnswerMinScore}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setConfigModalSession({
                                ...configModalSession,
                                scoringConfig: { ...sc, viewAnswerMinScore: val }
                              });
                            }}
                            className="w-full accent-teal-600 cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                            <span>0.0đ (Xem tự do)</span>
                            <span>4.0đ (Chuẩn TT22)</span>
                            <span>7.0đ (Khá)</span>
                            <span>10.0đ (Tuyệt đối)</span>
                          </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-slate-500 font-bold">Chọn nhanh:</span>
                          {[
                            { label: '0.0đ (Xem tự do)', val: 0.0 },
                            { label: '4.0đ (Chuẩn TT 22)', val: 4.0 },
                            { label: '5.0đ (Trung bình)', val: 5.0 },
                            { label: '6.5đ (Khá)', val: 6.5 },
                            { label: '8.0đ (Giỏi)', val: 8.0 }
                          ].map((preset) => (
                            <button
                              key={preset.val}
                              type="button"
                              onClick={() =>
                                setConfigModalSession({
                                  ...configModalSession,
                                  scoringConfig: { ...sc, viewAnswerMinScore: preset.val }
                                })
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                                sc.viewAnswerMinScore === preset.val
                                  ? 'bg-teal-700 text-white shadow-xs'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        {/* Pedagogical Explanation Card */}
                        <div className="p-3 bg-white/90 rounded-xl border border-teal-200 text-[11px] space-y-1.5 text-slate-700">
                          <div className="flex items-center gap-1.5 text-rose-700 font-bold">
                            <span>🔒 Khi điểm thi &lt; {sc.viewAnswerMinScore.toFixed(1)}đ:</span>
                          </div>
                          <p className="text-slate-600 text-[10px] pl-3">
                            Đáp án đúng bị khóa. Học sinh chỉ xem được điểm tổng và số câu đúng để tự nghiên cứu, làm lại lượt sau.
                          </p>
                          <div className="flex items-center gap-1.5 text-emerald-700 font-bold pt-1">
                            <span>🔓 Khi điểm thi ≥ {sc.viewAnswerMinScore.toFixed(1)}đ:</span>
                          </div>
                          <p className="text-slate-600 text-[10px] pl-3">
                            Mở khóa 100% đáp án đúng, gợi ý chi tiết và Gia sư AI phân tích các lỗi sai.
                          </p>
                        </div>

                        {/* AI Tutor Toggle */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Cho phép Gia sư AI Gemini phân tích bài sau khi mở khóa:
                          </span>
                          <input
                            type="checkbox"
                            checked={sc.allowAiTutorExplanation}
                            onChange={(e) =>
                              setConfigModalSession({
                                ...configModalSession,
                                scoringConfig: { ...sc, allowAiTutorExplanation: e.target.checked }
                              })
                            }
                            className="w-4 h-4 text-teal-600 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: CHỐNG GIAN LẬN (AI PROCTOR) */}
                {configModalTab === 'proctoring' && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        <span>Quy chế Chống Gian Lận & Giám Sát Phòng Thi:</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Giới hạn chuyển tab cảnh báo:
                          </label>
                          <select
                            value={configModalSession.antiCheatConfig?.maxTabSwitches ?? 3}
                            onChange={(e) =>
                              setConfigModalSession({
                                ...configModalSession,
                                antiCheatConfig: {
                                  ...configModalSession.antiCheatConfig!,
                                  maxTabSwitches: parseInt(e.target.value, 10)
                                }
                              })
                            }
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-xs"
                          >
                            <option value={1}>Tối đa 1 lần chuyển tab</option>
                            <option value={2}>Tối đa 2 lần chuyển tab</option>
                            <option value={3}>Tối đa 3 lần chuyển tab (Khuyên dùng)</option>
                            <option value={5}>Tối đa 5 lần chuyển tab</option>
                          </select>
                        </div>

                        <div className="flex flex-col justify-center">
                          <span className="text-[11px] text-slate-600 font-semibold">Tự động đình chỉ:</span>
                          <span className="text-[11px] text-emerald-800 font-bold">
                            ✓ Thu hồi bài ngay khi vi phạm quá số lần
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-white/80 rounded-xl border border-amber-200 text-[11px] text-slate-700 space-y-1">
                        <div className="font-bold text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Quy chế bắt buộc làm hết câu hỏi:</span>
                        </div>
                        <p className="text-slate-600 text-[10px]">
                          Học sinh bắt buộc phải trả lời đầy đủ tất cả các câu hỏi (Phần I, Phần II, Phần III) mới có thể nộp bài. Hệ thống tự động cảnh báo câu còn trống.
                        </p>
                      </div>

                      <div className="p-2.5 bg-white/80 rounded-xl border border-amber-200 text-[11px] text-slate-700 space-y-1">
                        <div className="font-bold text-teal-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                          <span>Bảo đảm 100% câu hỏi của giáo viên:</span>
                        </div>
                        <p className="text-slate-600 text-[10px]">
                          Tuyệt đối không bịa đặt hoặc tự tạo câu hỏi ngoài đề của giáo viên. Thứ tự câu hỏi và phương án được xáo trộn ngẫu nhiên ở mỗi phiên để chống quay cóp.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit & Cancel Buttons Footer */}
                <div className="pt-3 flex justify-between items-center border-t border-slate-100 shrink-0">
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {configModalSession.id}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfigModalSession(null)}
                      className="btn-3d btn-3d-slate px-4 py-2 rounded-xl cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="btn-3d btn-3d-teal px-5 py-2 rounded-xl font-bold cursor-pointer shadow-md"
                    >
                      Lưu & Áp Dụng Ngay
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: TẠO PHIÊN GIAO ĐỀ MỚI */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">Tạo Phiên Giao Đề Mới</h3>
              <button onClick={() => setIsNewModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 shrink-0">
              <button
                type="button"
                onClick={() => setNewModalTab('basic')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  newModalTab === 'basic' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                📋 Thông Tin & Lượt Thi
              </button>
              <button
                type="button"
                onClick={() => setNewModalTab('scoring')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  newModalTab === 'scoring' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                🎯 Điểm Số TT 22
              </button>
              <button
                type="button"
                onClick={() => setNewModalTab('answer-key')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  newModalTab === 'answer-key' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                🔑 Xem Đáp Án
              </button>
            </div>

            <form onSubmit={handleCreateNewSessionSubmit} className="space-y-3.5 text-xs">
              {newModalTab === 'basic' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Chọn đề thi từ kho ({quizzes.length} đề):</span>
                      <span className="text-[10px] text-teal-700 font-semibold">Tự động nạp câu hỏi</span>
                    </label>
                    <select
                      value={selectedQuizId}
                      onChange={(e) => {
                        const qId = e.target.value;
                        setSelectedQuizId(qId);
                        const q = quizzes.find((item) => item.id === qId);
                        if (q) {
                          setNewTitle(q.title);
                          setNewDuration(q.durationMinutes || 50);
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-teal-500 font-bold bg-white text-slate-800"
                    >
                      {quizzes.map((q) => {
                        const count = (q.questions && q.questions.length > 0) ? q.questions.length : q.questionCount;
                        return (
                          <option key={q.id} value={q.id}>
                            {q.title} ({count} câu • {q.breakdown || `${count}-0-0-0`})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tên bài kiểm tra / Đề thi:</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Ví dụ: KIỂM TRA ĐỊNH KỲ CÔNG NGHỆ 12 - HK2"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-teal-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Áp dụng cho lớp học:</label>
                    <input
                      type="text"
                      value={newClass}
                      onChange={(e) => setNewClass(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-teal-500 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Thời gian làm (phút):</label>
                      <input
                        type="number"
                        value={newDuration}
                        onChange={(e) => setNewDuration(parseInt(e.target.value, 10) || 45)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Số lượt thi cho phép:</label>
                      <select
                        value={newAttempts}
                        onChange={(e) => setNewAttempts(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                      >
                        <option value={1}>1 lượt duy nhất</option>
                        <option value={2}>2 lượt làm bài</option>
                        <option value={3}>3 lượt làm bài</option>
                        <option value={5}>5 lượt làm bài</option>
                        <option value={0}>Không giới hạn</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Thời gian bắt đầu:</label>
                      <input
                        type="text"
                        value={newStartTime}
                        onChange={(e) => setNewStartTime(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Hạn nộp kết thúc:</label>
                      <input
                        type="text"
                        value={newEndTime}
                        onChange={(e) => setNewEndTime(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </>
              )}

              {newModalTab === 'scoring' && (
                <div className="space-y-3">
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-900">
                    <span className="font-extrabold text-xs">Chuẩn Thông tư 22 (Thang điểm 10):</span>
                    <p className="text-[11px] text-teal-700 mt-0.5">
                      Điểm từng câu có thể tùy chỉnh; tổng điểm của toàn bộ bài làm luôn được tự động quy đổi về thang điểm 10.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">Phần I (Nhiều lựa chọn):</span>
                      <p className="text-[10px] text-slate-500">Mặc định 0.25đ / câu</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.05"
                        min="0.05"
                        max="5"
                        value={newPart1PerQ}
                        onChange={(e) => setNewPart1PerQ(parseFloat(e.target.value) || 0.25)}
                        className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold"
                      />
                      <span className="text-slate-500">đ</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">Phần II (Đúng / Sai):</span>
                      <p className="text-[10px] text-slate-500">Điểm tối đa mỗi câu (Lũy tiến TT 22)</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="5"
                        value={newPart2PerQ}
                        onChange={(e) => setNewPart2PerQ(parseFloat(e.target.value) || 1.0)}
                        className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold"
                      />
                      <span className="text-slate-500">đ</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">Phần III (Trả lời ngắn):</span>
                      <p className="text-[10px] text-slate-500">Mặc định 0.25đ / câu</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.05"
                        min="0.05"
                        max="5"
                        value={newPart3PerQ}
                        onChange={(e) => setNewPart3PerQ(parseFloat(e.target.value) || 0.25)}
                        className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold"
                      />
                      <span className="text-slate-500">đ</span>
                    </div>
                  </div>
                </div>
              )}

              {newModalTab === 'answer-key' && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">Cho phép xem đáp án sau khi nộp:</span>
                      <p className="text-[10px] text-slate-500">Học sinh được xem đáp án sau khi hoàn thành bài thi</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={newAllowViewKey}
                      onChange={(e) => setNewAllowViewKey(e.target.checked)}
                      className="w-5 h-5 text-teal-600 rounded cursor-pointer"
                    />
                  </div>

                  {newAllowViewKey && (
                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-teal-950 text-xs">Mức điểm tối thiểu mở khóa:</span>
                        <span className="font-black text-teal-900 bg-white px-2 py-0.5 rounded border border-teal-300">
                          ≥ {newMinScore.toFixed(1)} / 10.0 đ
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.5"
                        value={newMinScore}
                        onChange={(e) => setNewMinScore(parseFloat(e.target.value))}
                        className="w-full accent-teal-600"
                      />
                      <div className="flex flex-wrap gap-1">
                        {[
                          { l: '0.0đ (Tự do)', v: 0.0 },
                          { l: '4.0đ (Chuẩn TT22)', v: 4.0 },
                          { l: '5.0đ (TB)', v: 5.0 },
                          { l: '6.5đ (Khá)', v: 6.5 }
                        ].map((btn) => (
                          <button
                            key={btn.v}
                            type="button"
                            onClick={() => setNewMinScore(btn.v)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              newMinScore === btn.v ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 border border-slate-200'
                            }`}
                          >
                            {btn.l}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-700">Cho phép Gia sư AI giải thích:</span>
                        <input
                          type="checkbox"
                          checked={newAllowAiTutor}
                          onChange={(e) => setNewAllowAiTutor(e.target.checked)}
                          className="w-4 h-4 text-teal-600 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1 text-amber-800">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Chế độ giám sát chống gian lận & Khóa AI:</span>
                </div>
                <p>Mặc định bật cảnh báo đổi tab (tối đa {newMaxTabSwitches} lần), khóa Gia sư AI khi đang làm bài để đảm bảo minh bạch điểm số.</p>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="btn-3d btn-3d-slate px-3.5 py-1.5 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-3d btn-3d-teal px-4 py-1.5 rounded-xl font-bold cursor-pointer shadow-md"
                >
                  Mở Phòng Thi Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Share Modal */}
      {activeQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100 space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">Quét mã QR để vào phòng thi</h3>
            <p className="text-xs text-slate-500">{activeQrModal.title}</p>

            <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-teal-300 inline-block">
              <div className="w-48 h-48 bg-white border border-slate-300 p-2 flex flex-col items-center justify-center rounded-xl shadow-inner">
                <QrCode className="w-36 h-36 text-slate-800" />
                <span className="text-[10px] font-mono text-slate-500 font-bold mt-1">ID: {activeQrModal.id}</span>
              </div>
            </div>

            <div className="p-2.5 bg-teal-50 rounded-xl text-teal-800 text-xs font-mono break-all text-left">
              {getStudentExamShareUrl(activeQrModal.id)}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleCopyLink(activeQrModal)}
                className="btn-3d btn-3d-teal flex-1 py-2 text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-bold"
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
