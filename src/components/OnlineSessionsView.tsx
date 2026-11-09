import React, { useState, useMemo, useEffect } from 'react';
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
  HelpCircle,
  FileSpreadsheet,
  Download,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  UserCheck
} from 'lucide-react';
import { ExamSession, Quiz, AntiCheatConfig, StudentSubmission, Classroom, Question } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';
import { getStudentExamShareUrl, getStudentExamEmbeddedShareUrl, getStudentExamStoreShareUrl } from '../utils/urlHelper';
import { cloudStorageService } from '../services/cloudStorageService';
import { getExamStoreConfig, isExamStoreTeacherReady, publishExamToStore } from '../services/examStoreService';
import QRCode from 'qrcode';

interface OnlineSessionsViewProps {
  sessions: ExamSession[];
  quizzes?: Quiz[];
  submissions?: StudentSubmission[];
  classrooms?: Classroom[];
  onCreateSession: () => void;
  onOpenLiveMonitor: (session: ExamSession) => void;
  onOpenStudentExam: (sessionId: string) => void;
  onOpenAttendanceSummary?: (session: ExamSession) => void;
  onToggleSessionStatus?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onAddNewSession?: (newSession: ExamSession) => void;
  onUpdateSession?: (updatedSession: ExamSession) => void;
  onResetStudentAttempts?: (sessionId: string, studentName: string) => void;
}

export const OnlineSessionsView: React.FC<OnlineSessionsViewProps> = ({
  sessions,
  quizzes = [],
  submissions = [],
  classrooms = [],
  onCreateSession,
  onOpenLiveMonitor,
  onOpenStudentExam,
  onOpenAttendanceSummary,
  onToggleSessionStatus,
  onDeleteSession,
  onAddNewSession,
  onUpdateSession,
  onResetStudentAttempts
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeQrModal, setActiveQrModal] = useState<ExamSession | null>(null);

  // Link thi cho modal chia sẻ. ƯU TIÊN Kho đề trực tuyến: link rút gọn chỉ
  // mang mã đề + mã QR THẬT quét được. Chưa có Kho thì dùng link chứa sẵn
  // toàn bộ đề (#d=...) như trước — học sinh mở đúng đề trên mọi thiết bị.
  const [qrShareUrl, setQrShareUrl] = useState<string>('');
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [qrIsStoreLink, setQrIsStoreLink] = useState(false);
  useEffect(() => {
    if (!activeQrModal) {
      setQrShareUrl('');
      setQrImageUrl('');
      setQrIsStoreLink(false);
      return;
    }
    let cancelled = false;
    setQrImageUrl('');
    const linkedQuiz = quizzes.find((q) => q.id === activeQrModal.quizId);
    const questions = (activeQrModal.questions && activeQrModal.questions.length > 0)
      ? activeQrModal.questions
      : (linkedQuiz?.questions || []);

    const storeUrl = activeQrModal.storeUrl || getExamStoreConfig().storeUrl;
    if (activeQrModal.storeExamId && storeUrl) {
      const shortUrl = getStudentExamStoreShareUrl(activeQrModal.storeExamId, storeUrl);
      setQrShareUrl(shortUrl);
      setQrIsStoreLink(true);
      QRCode.toDataURL(shortUrl, { width: 576, margin: 2, errorCorrectionLevel: 'M' })
        .then((dataUrl) => {
          if (!cancelled) setQrImageUrl(dataUrl);
        })
        .catch(() => {
          if (!cancelled) setQrImageUrl('');
        });
      return () => {
        cancelled = true;
      };
    }

    setQrIsStoreLink(false);
    getStudentExamEmbeddedShareUrl(activeQrModal, linkedQuiz, questions).then((url) => {
      if (!cancelled) setQrShareUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [activeQrModal]);

  // Dedicated Session Statistics & Results Modal
  const [activeStatsSession, setActiveStatsSession] = useState<ExamSession | null>(null);
  const [statsSearchTerm, setStatsSearchTerm] = useState('');
  const [statsGradeFilter, setStatsGradeFilter] = useState<'all' | 'gioi' | 'kha' | 'trungbinh' | 'yeu'>('all');
  const [inspectingSub, setInspectingSub] = useState<StudentSubmission | null>(null);

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

  const getSessionShareText = (session: ExamSession, shareLink?: string) => {
    const linkedQuiz = quizzes.find((q) => q.id === session.quizId || q.title === session.title);
    const subjectName = linkedQuiz?.subject || 'Công nghệ 12';
    const durationMins = session.durationMinutes || 50;
    const realQCount = session.questionCount || (linkedQuiz?.questions && linkedQuiz.questions.length > 0 ? linkedQuiz.questions.length : linkedQuiz?.questionCount) || 28;
    const link = shareLink || getStudentExamShareUrl(session.id);
    return `📌 BÀI KIỂM TRA TRỰC TUYẾN\n📘 Môn học: ${subjectName}\n📝 Bài kiểm tra: ${session.title}\n⏱ Thời gian làm bài: ${durationMins} phút (${realQCount} câu hỏi)\n🏫 Đối tượng: ${session.className || 'Toàn bộ học sinh'}\n👉 Học sinh bấm vào liên kết bên dưới để vào thi ngay:\n${link}`;
  };

  const handleCopyLink = async (session: ExamSession) => {
    soundEffects.playClick();
    const linkedQuiz = quizzes.find((q) => q.id === session.quizId || q.title === session.title);
    const questions = (session.questions && session.questions.length > 0)
      ? session.questions
      : (linkedQuiz?.questions || []);

    // Instantly publish to cloud server so that any student clicking the link gets 100% real questions!
    cloudStorageService.publishExamDirectly({
      session: { ...session, questions },
      quiz: linkedQuiz,
      questions
    }).catch(() => {});

    // ƯU TIÊN Kho đề: đăng lại đúng mã đề (làm mới nội dung nếu đề vừa sửa)
    // rồi dùng LINK RÚT GỌN. Chưa có Kho thì dùng link chứa sẵn đề như trước.
    const storeCfg = getExamStoreConfig();
    const storeUrl = session.storeUrl || storeCfg.storeUrl;
    if (session.storeExamId && storeUrl && isExamStoreTeacherReady(storeCfg)) {
      await publishExamToStore(storeCfg, {
        examId: session.storeExamId,
        session: { ...session, questions },
        quiz: linkedQuiz,
        questions,
      }).catch(() => null);
      const shortLink = getStudentExamStoreShareUrl(session.storeExamId, storeUrl);
      const fullText = getSessionShareText(session, shortLink);
      navigator.clipboard?.writeText(fullText);
      setCopiedId(session.id);
      setTimeout(() => setCopiedId(null), 2500);
      return;
    }

    const shareLink = await getStudentExamEmbeddedShareUrl(session, linkedQuiz, questions);
    const fullText = getSessionShareText(session, shareLink);
    navigator.clipboard?.writeText(fullText);
    setCopiedId(session.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const exportSessionExcel = (session: ExamSession, sessionSubs: StudentSubmission[]) => {
    soundEffects.playClick();
    const linkedQuiz = quizzes.find((q) => q.id === session.quizId || q.title === session.title);
    const subjectName = linkedQuiz?.subject || 'Công nghệ 12';
    let csv = '\uFEFF'; // UTF-8 BOM for Microsoft Excel
    csv += `BẢNG THỐNG KÊ KẾT QUẢ BÀI KIỂM TRA TRỰC TUYẾN\n`;
    csv += `Tên bài kiểm tra:,"${session.title}",Môn học:,"${subjectName}",Thời lượng:,"${session.durationMinutes} phút"\n`;
    csv += `Lớp đối tượng:,"${session.className || 'Khối 12'}",Mã phòng thi:,"${session.id}",Thời điểm xuất file:,"${new Date().toLocaleString('vi-VN')}"\n`;
    csv += `Tổng số học sinh nộp bài:,"${sessionSubs.length}"\n\n`;
    csv += `STT,Mã định danh,Họ và tên học sinh,Lớp học,Thời gian nộp bài,Số câu đúng,Điểm số (Thang 10),Xếp loại năng lực,Thời gian hoàn thành,Tình trạng\n`;

    sessionSubs.forEach((sub, idx) => {
      const scoreNum = sub.score;
      const rank = scoreNum >= 8.0 ? 'Giỏi' : scoreNum >= 6.5 ? 'Khá' : scoreNum >= 5.0 ? 'Trung bình' : 'Chưa đạt';
      const mins = Math.floor((sub.durationSeconds || 0) / 60);
      const secs = (sub.durationSeconds || 0) % 60;
      const timeFormatted = `${mins} phút ${secs} giây`;
      const status = sub.isDisqualified ? 'Vi phạm quy chế' : 'Hợp lệ';

      csv += `${idx + 1},"${sub.studentInfo || ''}","${sub.studentName}","${session.className || 'Khối 12'}","${sub.submittedAt}",${sub.correctAnswersCount}/${sub.totalQuestions},${sub.score},"${rank}","${timeFormatted}","${status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = session.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `BangDiem_${safeTitle}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    soundEffects.playCorrect();
  };

  const handleCreateNewSessionSubmit = async (e: React.FormEvent) => {
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
      questions: chosenQuiz?.questions,
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

    // ƯU TIÊN Kho đề trực tuyến: đăng đề lên Kho -> link rút gọn + QR thật.
    // Chưa có Kho / đăng thất bại -> link chứa sẵn toàn bộ đề thi như trước.
    const storeCfg = getExamStoreConfig();
    let publishedToStore = false;
    if (isExamStoreTeacherReady(storeCfg)) {
      const published = await publishExamToStore(storeCfg, {
        session: created,
        quiz: chosenQuiz,
        questions: created.questions || [],
      }).catch(() => null);
      if (published) {
        created.storeExamId = published.examId;
        created.storeUrl = storeCfg.storeUrl;
        created.shareUrl = getStudentExamStoreShareUrl(published.examId, storeCfg.storeUrl);
        publishedToStore = true;
      }
    }
    if (!publishedToStore) {
      created.shareUrl = await getStudentExamEmbeddedShareUrl(created, chosenQuiz, created.questions || []);
    }

    onAddNewSession?.(created);
    cloudStorageService.publishExamDirectly({
      session: created,
      quiz: chosenQuiz,
      questions: created.questions
    }).catch(() => {});
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
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300">
              Chuẩn GDPT 2018 & TT 22
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Mỗi đề thi được tích hợp sẵn 1 link giao bài kèm đầy đủ thông tin, kiểm tra và bảng thống kê kết quả điểm số riêng biệt
          </p>
        </div>

        <button
          onClick={() => {
            soundEffects.playClick();
            setIsNewModalOpen(true);
          }}
          className="btn-3d btn-3d-teal px-4 py-2 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold shadow-md text-white"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo phiên giao đề mới</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Tìm theo tên đề thi:</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nhập tên đề thi cần tìm..."
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
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Trạng thái phòng thi:</label>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang mở làm bài</option>
            <option value="completed">Đã kết thúc / Tạm dừng</option>
          </select>
        </div>
      </div>

      {/* Streamlined Sessions Table with 1-Click Share & Per-Session Results */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 font-bold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 min-w-[260px]">Đề thi & Thông tin môn học</th>
                <th className="py-3 px-4 min-w-[220px]">Link giao bài (Gắn ngay đề)</th>
                <th className="py-3 px-4 min-w-[200px] text-center">Kiểm tra & Kết quả làm bài</th>
                <th className="py-3 px-4 text-center min-w-[130px]">Cài đặt & Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Chưa có phiên giao đề nào phù hợp với bộ lọc tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((sess) => {
                  const linkedQuiz = quizzes.find((q) => q.id === sess.quizId || q.title === sess.title);
                  const subjectName = linkedQuiz?.subject || 'Công nghệ 12';
                  const realQCount = sess.questionCount || (linkedQuiz?.questions && linkedQuiz.questions.length > 0 ? linkedQuiz.questions.length : linkedQuiz?.questionCount) || 28;
                  const sessionSubs = (submissions || []).filter((s) => s.sessionId === sess.id);

                  return (
                    <tr key={sess.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Column 1: Đề thi & Thông tin môn học */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-sm">{sess.title}</span>
                            <span className="bg-teal-50 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-teal-200">
                              {subjectName}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-medium">
                            <span className="text-slate-700 font-bold">🏫 {sess.className || 'Toàn bộ học sinh'}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-600">Mã: {sess.id}</span>
                            <span>•</span>
                            <span className="text-amber-800 font-semibold">⏱ {sess.durationMinutes} phút</span>
                            <span>•</span>
                            <span className="text-emerald-700 font-semibold">📝 {realQCount} câu</span>
                            <span>•</span>
                            <span>{sess.allowedAttempts === 0 ? 'Vô hạn lượt thi' : `${sess.allowedAttempts} lượt thi`}</span>
                          </div>

                          <div className="text-[11px] text-slate-400 font-mono">
                            Hạn nộp: <span className="text-slate-600 font-semibold">{sess.endTime}</span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Link Giao Bài 1-Click (Gắn ngay Đề cần giao) */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-2 max-w-[260px]">
                          <button
                            onClick={() => handleCopyLink(sess)}
                            className="btn-3d btn-3d-teal px-4 py-2.5 text-xs rounded-xl font-black flex items-center justify-center gap-2 cursor-pointer shadow-md text-white w-full"
                            title="Sao chép toàn bộ thông tin đề thi kèm link trực tiếp để gửi Zalo/Facebook"
                          >
                            {copiedId === sess.id ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-300" />
                                <span>Đã sao chép link & bài giao!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Sao chép Link Giao Bài</span>
                              </>
                            )}
                          </button>

                          <div className="flex items-center justify-between px-1 text-[11px]">
                            <button
                              onClick={() => {
                                soundEffects.playClick();
                                setActiveQrModal(sess);
                              }}
                              className="text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Xem mã QR để học sinh quét điện thoại"
                            >
                              <QrCode className="w-3.5 h-3.5 text-teal-600" />
                              <span>Mã QR</span>
                            </button>

                            <button
                              onClick={() => {
                                soundEffects.playClick();
                                onOpenStudentExam(sess.id);
                              }}
                              className="text-pink-600 hover:text-pink-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Thử trải nghiệm giao diện thi của học sinh"
                            >
                              <PlayCircle className="w-3.5 h-3.5 text-pink-500" />
                              <span>Vào thi thử</span>
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Kiểm tra & Kết quả làm bài (Bảng Thống kê riêng của từng đề) */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center gap-2">
                          <button
                            onClick={() => {
                              soundEffects.playClick();
                              setActiveStatsSession(sess);
                              setStatsSearchTerm('');
                              setStatsGradeFilter('all');
                            }}
                            className="btn-3d btn-3d-amber px-4 py-2.5 text-xs rounded-xl font-black flex items-center gap-2 cursor-pointer shadow-md text-white"
                            title="Mở bảng thống kê kết quả làm bài & xuất file Excel điểm số của đề này"
                          >
                            <ClipboardCheck className="w-4 h-4" />
                            <span>Bảng Thống kê & Điểm số ({sessionSubs.length} HS)</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            {sess.status === 'active' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Đang mở thi
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-full">
                                Tạm dừng
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 4: Cài đặt & Thao tác */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
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
                                  // Phiên cũ chưa có cấu hình: suy trọng số Phần III từ
                                  // chính câu hỏi của đề (Toán = 0,5đ) thay vì mặc định 0,25.
                                  part3PointPerQuestion: (toConfig.questions || []).find((q) => q.partType === 'part3_short_answer')?.points ?? 0.25,
                                  allowViewAnswerKey: true,
                                  viewAnswerMinScore: 4.0,
                                  allowAiTutorExplanation: true,
                                };
                              }
                              setConfigModalSession(toConfig);
                              setConfigModalTab('scoring');
                            }}
                            className="btn-3d px-3.5 py-2.5 text-xs rounded-xl font-black flex items-center gap-1.5 cursor-pointer shadow-lg text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border border-blue-300/50 transform hover:scale-105 active:scale-95 transition-all"
                            title="Cài đặt điểm số Thông tư 22, thời gian thi & quy chế"
                          >
                            <Settings className="w-4 h-4 stroke-[2.5] text-amber-300 animate-[spin_8s_linear_infinite]" />
                            <span>Cài đặt đề</span>
                          </button>

                          <button
                            onClick={() => {
                              soundEffects.playClick();
                              onToggleSessionStatus?.(sess.id);
                            }}
                            className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border cursor-pointer transition-colors ${
                              sess.status === 'active'
                                ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                                : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                            }`}
                            title={sess.status === 'active' ? 'Tạm dừng nhận bài thi' : 'Tiếp tục mở phòng thi'}
                          >
                            {sess.status === 'active' ? 'Dừng' : 'Mở'}
                          </button>

                          <button
                            onClick={() => {
                              soundEffects.playClick();
                              if (confirm(`Bạn có chắc chắn muốn xóa phiên: "${sess.title}"?`)) {
                                onDeleteSession?.(sess.id);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 cursor-pointer transition-colors"
                            title="Xóa phiên thi"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: BẢNG THỐNG KÊ KẾT QUẢ & ĐÁNH GIÁ ĐIỂM SỐ RIÊNG CHO TỪNG ĐỀ (PER-SESSION RESULTS & EXCEL EXPORT) */}
      {activeStatsSession && (() => {
        const curSessionSubs = (submissions || []).filter((s) => s.sessionId === activeStatsSession.id);
        const totalSubs = curSessionSubs.length;

        // Statistics computation
        const scores = curSessionSubs.map((s) => s.score);
        const avgScore = totalSubs > 0 ? scores.reduce((a, b) => a + b, 0) / totalSubs : 0;
        const maxScore = totalSubs > 0 ? Math.max(...scores) : 0;
        const minScore = totalSubs > 0 ? Math.min(...scores) : 0;
        const passedCount = curSessionSubs.filter((s) => s.score >= 5.0).length;
        const passRate = totalSubs > 0 ? Math.round((passedCount / totalSubs) * 100) : 0;

        // Breakdown according to Circular 22
        const gioiCount = curSessionSubs.filter((s) => s.score >= 8.0).length;
        const khaCount = curSessionSubs.filter((s) => s.score >= 6.5 && s.score < 8.0).length;
        const tbCount = curSessionSubs.filter((s) => s.score >= 5.0 && s.score < 6.5).length;
        const yeuCount = curSessionSubs.filter((s) => s.score < 5.0).length;

        const gioiPct = totalSubs > 0 ? Math.round((gioiCount / totalSubs) * 100) : 0;
        const khaPct = totalSubs > 0 ? Math.round((khaCount / totalSubs) * 100) : 0;
        const tbPct = totalSubs > 0 ? Math.round((tbCount / totalSubs) * 100) : 0;
        const yeuPct = totalSubs > 0 ? Math.max(0, 100 - gioiPct - khaPct - tbPct) : 0;

        // Filtered list
        const filteredSubs = curSessionSubs.filter((sub) => {
          const matchName = sub.studentName.toLowerCase().includes(statsSearchTerm.toLowerCase()) ||
            (sub.studentInfo && sub.studentInfo.toLowerCase().includes(statsSearchTerm.toLowerCase()));
          if (!matchName) return false;
          if (statsGradeFilter === 'gioi') return sub.score >= 8.0;
          if (statsGradeFilter === 'kha') return sub.score >= 6.5 && sub.score < 8.0;
          if (statsGradeFilter === 'trungbinh') return sub.score >= 5.0 && sub.score < 6.5;
          if (statsGradeFilter === 'yeu') return sub.score < 5.0;
          return true;
        });

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-5xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
                    <ClipboardCheck className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-base sm:text-lg text-slate-900 leading-tight">
                        Thống Kê Kết Quả Làm Bài & Bảng Điểm
                      </h3>
                      <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full border border-teal-300">
                        {activeStatsSession.className || 'Toàn trường'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Bài kiểm tra: <strong className="text-slate-800">{activeStatsSession.title}</strong> • Mã phòng: {activeStatsSession.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => exportSessionExcel(activeStatsSession, curSessionSubs)}
                    className="btn-3d btn-3d-emerald px-4 py-2 text-xs rounded-xl font-black flex items-center gap-1.5 cursor-pointer shadow-md text-white"
                    title="Tải bảng điểm Excel / CSV chuẩn Sở Giáo dục & Đào tạo"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Xuất Excel Bảng Điểm</span>
                  </button>

                  <button
                    onClick={() => setActiveStatsSession(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body Viewport */}
              <div className="overflow-y-auto space-y-4 pr-1">
                {/* 4 KPI Statistic Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-500">Số bài đã nộp</span>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                      {totalSubs} <span className="text-xs font-normal text-slate-500">học sinh</span>
                    </div>
                  </div>

                  <div className="bg-teal-50/80 border border-teal-200/80 rounded-2xl p-3 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-teal-700">Điểm trung bình (ĐTB)</span>
                    <div className="text-2xl font-black text-teal-800 mt-1">
                      {avgScore.toFixed(2)} <span className="text-xs font-normal text-teal-600">/ 10đ</span>
                    </div>
                  </div>

                  <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-amber-700">Điểm cao nhất / Thấp nhất</span>
                    <div className="text-lg font-black text-amber-900 mt-1">
                      {maxScore}đ <span className="text-xs font-normal text-slate-400">•</span> {minScore}đ
                    </div>
                  </div>

                  <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-emerald-700">Tỉ lệ đạt chuẩn (≥ 5.0)</span>
                    <div className="text-2xl font-black text-emerald-800 mt-1">
                      {passRate}% <span className="text-xs font-normal text-emerald-600">({passedCount}/{totalSubs})</span>
                    </div>
                  </div>
                </div>

                {/* Score Distribution Visual (Circular 22) */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Phổ điểm đánh giá năng lực học sinh (Chuẩn Thông tư 22):</span>
                    <span className="text-slate-400 font-normal">Tổng: {totalSubs} bài làm</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    <div className="bg-emerald-100/70 border border-emerald-200 p-2 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-emerald-900">Giỏi (8.0 - 10đ)</span>
                        <span className="font-black text-emerald-800">{gioiCount} ({gioiPct}%)</span>
                      </div>
                      <div className="w-full bg-emerald-200/60 rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${gioiPct}%` }}></div>
                      </div>
                    </div>

                    <div className="bg-blue-100/70 border border-blue-200 p-2 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-blue-900">Khá (6.5 - 7.9đ)</span>
                        <span className="font-black text-blue-800">{khaCount} ({khaPct}%)</span>
                      </div>
                      <div className="w-full bg-blue-200/60 rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${khaPct}%` }}></div>
                      </div>
                    </div>

                    <div className="bg-amber-100/70 border border-amber-200 p-2 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-amber-900">Trung bình (5 - 6.4đ)</span>
                        <span className="font-black text-amber-800">{tbCount} ({tbPct}%)</span>
                      </div>
                      <div className="w-full bg-amber-200/60 rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div className="bg-amber-600 h-full rounded-full" style={{ width: `${tbPct}%` }}></div>
                      </div>
                    </div>

                    <div className="bg-rose-100/70 border border-rose-200 p-2 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-rose-900">Chưa đạt (&lt; 5.0đ)</span>
                        <span className="font-black text-rose-800">{yeuCount} ({yeuPct}%)</span>
                      </div>
                      <div className="w-full bg-rose-200/60 rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div className="bg-rose-600 h-full rounded-full" style={{ width: `${yeuPct}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={statsSearchTerm}
                      onChange={(e) => setStatsSearchTerm(e.target.value)}
                      placeholder="Tìm theo tên học sinh..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {[
                      { key: 'all', label: 'Tất cả' },
                      { key: 'gioi', label: 'Giỏi' },
                      { key: 'kha', label: 'Khá' },
                      { key: 'trungbinh', label: 'TB' },
                      { key: 'yeu', label: 'Chưa đạt' }
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setStatsGradeFilter(f.key as any)}
                        className={`px-2.5 py-1 text-[11px] rounded-lg font-bold cursor-pointer transition-colors ${
                          statsGradeFilter === f.key
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submissions List Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">STT</th>
                        <th className="py-2.5 px-3 min-w-[170px]">Họ và tên học sinh</th>
                        <th className="py-2.5 px-3 min-w-[110px]">Lớp / Định danh</th>
                        <th className="py-2.5 px-3 text-center">Thời gian nộp</th>
                        <th className="py-2.5 px-3 text-center">Số câu đúng</th>
                        <th className="py-2.5 px-3 text-center">Điểm số (/10)</th>
                        <th className="py-2.5 px-3 text-center">Xếp loại</th>
                        <th className="py-2.5 px-3 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredSubs.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            Chưa có học sinh nào nộp bài hoặc không tìm thấy kết quả phù hợp.
                          </td>
                        </tr>
                      ) : (
                        filteredSubs.map((sub, idx) => {
                          const scoreNum = sub.score;
                          const rank = scoreNum >= 8.0 ? 'Giỏi' : scoreNum >= 6.5 ? 'Khá' : scoreNum >= 5.0 ? 'Trung bình' : 'Chưa đạt';
                          const rankColor = scoreNum >= 8.0
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : scoreNum >= 6.5
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : scoreNum >= 5.0
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300';

                          return (
                            <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3 text-center font-mono text-slate-400 font-bold">
                                {idx + 1}
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 text-white font-black text-xs flex items-center justify-center shrink-0">
                                    {sub.studentName.charAt(0)}
                                  </div>
                                  <div className="font-bold text-slate-900">{sub.studentName}</div>
                                </div>
                              </td>

                              <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                                {sub.studentInfo || activeStatsSession.className || 'Khối 12'}
                              </td>

                              <td className="py-3 px-3 text-center text-slate-500 text-[11px] font-mono">
                                {sub.submittedAt}
                              </td>

                              <td className="py-3 px-3 text-center">
                                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono font-bold">
                                  {sub.correctAnswersCount}/{sub.totalQuestions}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-center">
                                <span className="text-base font-black text-slate-900 font-mono">
                                  {sub.score.toFixed(2)}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${rankColor}`}>
                                  {rank}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-center">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      soundEffects.playClick();
                                      setInspectingSub(sub);
                                    }}
                                    className="px-2 py-1 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 cursor-pointer"
                                    title="Xem chi tiết các câu hỏi và đáp án học sinh đã chọn"
                                  >
                                    Xem bài
                                  </button>

                                  <button
                                    onClick={() => {
                                      soundEffects.playClick();
                                      if (confirm(`Cấp quyền cho học sinh "${sub.studentName}" thi lại từ đầu?`)) {
                                        onResetStudentAttempts?.(activeStatsSession.id, sub.studentName);
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer transition-colors"
                                    title="Cho phép học sinh thi lại"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: XEM CHI TIẾT BÀI LÀM CỦA HỌC SINH */}
      {inspectingSub && (() => {
        const sessionQuestions = activeStatsSession?.questions || quizzes.find((q) => q.id === activeStatsSession?.quizId || q.title === activeStatsSession?.title)?.questions || [];

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-md">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900">
                      Chi Tiết Bài Làm: {inspectingSub.studentName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Điểm số: <strong className="text-teal-700">{inspectingSub.score}/10đ</strong> • Đúng: {inspectingSub.correctAnswersCount}/{inspectingSub.totalQuestions} câu • Nộp lúc: {inspectingSub.submittedAt}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setInspectingSub(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Questions list */}
              <div className="overflow-y-auto space-y-3.5 pr-1">
                {sessionQuestions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Không tìm thấy dữ liệu câu hỏi chi tiết của phiên này.
                  </div>
                ) : (
                  sessionQuestions.map((q, qIdx) => {
                    const studentAns = inspectingSub.answers?.[q.id];
                    let isCorrect = false;

                    if (!q.partType || q.partType === 'part1_choice') {
                      isCorrect = studentAns === q.correctAnswer;
                    } else if (q.partType === 'part3_short_answer') {
                      const exp = (q.shortAnswerCorrect || '').trim().replace(/\./g, ',');
                      const stud = (studentAns || '').toString().trim().replace(/\./g, ',');
                      isCorrect = Boolean(stud && stud === exp);
                    }

                    return (
                      <div
                        key={q.id || qIdx}
                        className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                          isCorrect
                            ? 'bg-emerald-50/60 border-emerald-200'
                            : studentAns
                            ? 'bg-rose-50/60 border-rose-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-slate-900">
                            Câu {qIdx + 1}: <span className="font-normal text-slate-800">{q.content}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              isCorrect
                                ? 'bg-emerald-200/80 text-emerald-900'
                                : studentAns
                                ? 'bg-rose-200/80 text-rose-900'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isCorrect ? '✓ Đúng' : studentAns ? '✗ Sai' : 'Chưa làm'}
                          </span>
                        </div>

                        {/* Options if Part 1 */}
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {q.options.map((opt) => {
                              const isStudentSelected = studentAns === opt.key;
                              const isTheCorrectKey = q.correctAnswer === opt.key || opt.isCorrect;

                              return (
                                <div
                                  key={opt.key}
                                  className={`p-2 rounded-xl border text-[11px] flex items-center justify-between ${
                                    isTheCorrectKey
                                      ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold'
                                      : isStudentSelected
                                      ? 'bg-rose-100 border-rose-400 text-rose-900 font-semibold'
                                      : 'bg-white border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <span>
                                    <strong>{opt.key}.</strong> {opt.text}
                                  </span>
                                  {isStudentSelected && (
                                    <span className="text-[10px] font-bold text-slate-700 ml-1">
                                      (HS chọn)
                                    </span>
                                  )}
                                  {isTheCorrectKey && (
                                    <span className="text-[10px] font-bold text-emerald-800 ml-1">
                                      (Đáp án đúng)
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Short answer if Part 3 */}
                        {q.partType === 'part3_short_answer' && (
                          <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1">
                            <div>
                              Học sinh điền:{' '}
                              <strong className={isCorrect ? 'text-emerald-700' : 'text-rose-700'}>
                                {studentAns || '(Chưa điền)'}
                              </strong>
                            </div>
                            <div>
                              Đáp án chuẩn: <strong className="text-emerald-800">{q.shortAnswerCorrect}</strong>
                            </div>
                          </div>
                        )}

                        {q.explanation && (
                          <div className="p-2 bg-white/80 rounded-xl text-[11px] text-slate-600 border border-slate-200/70">
                            💡 <strong>Hướng dẫn giải:</strong> {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: CÀI ĐẶT GIAO ĐỀ THI & QUY CHẾ ĐIỂM SỐ (WORLD-CLASS CONFIGURATION MODAL) */}
      {configModalSession && (() => {
        const sessionQuestions = configModalSession.questions || quizzes.find((q) => q.id === configModalSession.quizId || q.title === configModalSession.title)?.questions;
        const p1Count = sessionQuestions?.filter(q => !q.partType || q.partType === 'part1_choice').length ?? 18;
        const p2Count = sessionQuestions?.filter(q => q.partType === 'part2_true_false').length ?? 4;
        const p3Count = sessionQuestions?.filter(q => q.partType === 'part3_short_answer').length ?? 6;
        const p4Count = sessionQuestions?.filter(q => q.partType === 'part4_essay').length ?? 0;
        const totalCount = p1Count + p2Count + p3Count + p4Count;

        const sc = configModalSession.scoringConfig || {
          totalPoints: 10.0,
          durationMinutes: configModalSession.durationMinutes || 50,
          part1PointPerQuestion: 0.25,
          part2PointPerQuestion: 1.0,
          part2SubItemPoints: { 1: 0.1, 2: 0.25, 3: 0.5, 4: 1.0 },
          // Suy từ chính câu Phần III của đề khi phiên chưa có cấu hình (Toán = 0,5đ).
          part3PointPerQuestion: sessionQuestions?.find((q) => q.partType === 'part3_short_answer')?.points ?? 0.25,
          part4PointPerQuestion: 0.5,
          allowViewAnswerKey: true,
          viewAnswerMinScore: 4.0,
          allowAiTutorExplanation: true,
        };

        const subPts = sc.part2SubItemPoints || { 1: 0.1, 2: 0.25, 3: 0.5, 4: 1.0 };
        const p4PerQ = sc.part4PointPerQuestion ?? 0.5;

        const p1Nominal = +(p1Count * sc.part1PointPerQuestion).toFixed(2);
        const p2Nominal = +(p2Count * sc.part2PointPerQuestion).toFixed(2);
        const p3Nominal = +(p3Count * sc.part3PointPerQuestion).toFixed(2);
        const p4Nominal = +(p4Count * p4PerQ).toFixed(2);
        const totalNominal = +(p1Nominal + p2Nominal + p3Nominal + p4Nominal).toFixed(2);

        const p1Percent = totalNominal > 0 ? Math.round((p1Nominal / totalNominal) * 100) : 45;
        const p2Percent = totalNominal > 0 ? Math.round((p2Nominal / totalNominal) * 100) : 40;
        const p3Percent = totalNominal > 0 ? Math.round((p3Nominal / totalNominal) * 100) : 15;
        const p4Percent = totalNominal > 0 ? Math.max(0, 100 - p1Percent - p2Percent - p3Percent) : 0;

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
                        Thông tư 22 BGD&ĐT
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
                            Thang điểm chuẩn hóa: 10.0 Điểm
                          </span>
                          <p className="text-[11px] text-teal-700">
                            Cấu hình số điểm chi tiết cho từng phần & từng ý câu hỏi Đúng/Sai theo chuẩn Giáo viên.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono bg-teal-200/80 text-teal-900 px-2 py-1 rounded-md font-bold">
                        Đề gốc có: {totalCount} câu
                      </span>
                    </div>

                    {/* Section Point Distribution Inputs */}
                    <div className="space-y-3">
                      {/* Phần I */}
                      {p1Count > 0 && (
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
                      )}

                      {/* Phần II - Đúng/Sai kèm Cấu hình số điểm từng ý a, b, c, d */}
                      {p2Count > 0 && (
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center">II</span>
                                <span className="font-bold text-slate-800">Phần II: Trắc nghiệm Đúng / Sai (a, b, c, d)</span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                Có {p2Count} câu • Tùy chỉnh số điểm thưởng ở từng số ý làm đúng (1, 2, 3, 4 ý)
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-mono bg-emerald-100 text-emerald-800 px-2 py-1 rounded-md font-bold">
                                = {p2Nominal}đ ({p2Percent}%)
                              </span>
                            </div>
                          </div>

                          {/* 4 sub-item point input fields for Part II */}
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 space-y-1.5">
                            <span className="text-[11px] font-bold text-slate-700 block">
                              ⚙ Số điểm thưởng tính cho mỗi câu Phần II theo số ý đúng:
                            </span>
                            <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                              <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-200">
                                <label className="block text-[10px] text-slate-600 font-bold mb-1">Đúng 1 ý:</label>
                                <input
                                  type="number"
                                  step="0.05"
                                  min="0"
                                  value={subPts[1]}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value) || 0.1;
                                    setConfigModalSession({
                                      ...configModalSession,
                                      scoringConfig: {
                                        ...sc,
                                        part2SubItemPoints: { ...subPts, 1: v }
                                      }
                                    });
                                  }}
                                  className="w-full px-1 py-1 bg-white border border-slate-300 rounded text-center font-bold text-xs"
                                />
                                <span className="text-[10px] text-slate-400">điểm</span>
                              </div>

                              <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-200">
                                <label className="block text-[10px] text-slate-600 font-bold mb-1">Đúng 2 ý:</label>
                                <input
                                  type="number"
                                  step="0.05"
                                  min="0"
                                  value={subPts[2]}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value) || 0.25;
                                    setConfigModalSession({
                                      ...configModalSession,
                                      scoringConfig: {
                                        ...sc,
                                        part2SubItemPoints: { ...subPts, 2: v }
                                      }
                                    });
                                  }}
                                  className="w-full px-1 py-1 bg-white border border-slate-300 rounded text-center font-bold text-xs"
                                />
                                <span className="text-[10px] text-slate-400">điểm</span>
                              </div>

                              <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-200">
                                <label className="block text-[10px] text-slate-600 font-bold mb-1">Đúng 3 ý:</label>
                                <input
                                  type="number"
                                  step="0.05"
                                  min="0"
                                  value={subPts[3]}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value) || 0.5;
                                    setConfigModalSession({
                                      ...configModalSession,
                                      scoringConfig: {
                                        ...sc,
                                        part2SubItemPoints: { ...subPts, 3: v }
                                      }
                                    });
                                  }}
                                  className="w-full px-1 py-1 bg-white border border-slate-300 rounded text-center font-bold text-xs"
                                />
                                <span className="text-[10px] text-slate-400">điểm</span>
                              </div>

                              <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-300">
                                <label className="block text-[10px] text-emerald-900 font-extrabold mb-1">Đúng 4 ý (Tối đa):</label>
                                <input
                                  type="number"
                                  step="0.05"
                                  min="0"
                                  value={subPts[4]}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value) || 1.0;
                                    setConfigModalSession({
                                      ...configModalSession,
                                      scoringConfig: {
                                        ...sc,
                                        part2PointPerQuestion: v,
                                        part2SubItemPoints: { ...subPts, 4: v }
                                      }
                                    });
                                  }}
                                  className="w-full px-1 py-1 bg-white border border-emerald-400 rounded text-center font-black text-xs text-emerald-950"
                                />
                                <span className="text-[10px] text-emerald-700 font-bold">điểm</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Phần III */}
                      {p3Count > 0 && (
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
                      )}

                      {/* Phần IV Tự luận */}
                      {p4Count > 0 && (
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-purple-600 text-white font-black text-[11px] flex items-center justify-center">IV</span>
                              <span className="font-bold text-slate-800">Phần IV: Câu hỏi Tự luận</span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Có {p4Count} câu • Học sinh tự trình bày lời giải
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[11px] font-semibold text-slate-600">Điểm/câu:</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                max="10"
                                value={p4PerQ}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0.5;
                                  setConfigModalSession({
                                    ...configModalSession,
                                    scoringConfig: { ...sc, part4PointPerQuestion: val }
                                  });
                                }}
                                className="w-18 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-xs"
                              />
                              <span className="text-slate-500 text-[11px]">đ</span>
                            </div>
                            <span className="text-[11px] font-mono bg-purple-100 text-purple-800 px-2 py-1 rounded-md font-bold">
                              = {p4Nominal}đ ({p4Percent}%)
                            </span>
                          </div>
                        </div>
                      )}
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
                          // Trọng số từng phần đọc từ file Word khi import —
                          // áp luôn vào cấu hình phiên thi mới.
                          if (q.scoringHints) {
                            setNewPart1PerQ(q.scoringHints.part1PointPerQuestion);
                            setNewPart2PerQ(q.scoringHints.part2PointPerQuestion);
                            setNewPart3PerQ(q.scoringHints.part3PointPerQuestion);
                          }
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
                {qrImageUrl ? (
                  <>
                    <img src={qrImageUrl} alt="Mã QR vào phòng thi" className="w-40 h-40" />
                    <span className="text-[10px] font-mono text-slate-500 font-bold mt-1">Mã đề: {activeQrModal.storeExamId}</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-36 h-36 text-slate-800" />
                    <span className="text-[10px] font-mono text-slate-500 font-bold mt-1">ID: {activeQrModal.id}</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-2.5 bg-teal-50 rounded-xl text-teal-800 text-xs font-mono break-all text-left">
              {qrShareUrl || getStudentExamShareUrl(activeQrModal.id)}
            </div>

            {qrIsStoreLink ? (
              <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-[11px] font-semibold text-left">
                ✓ Đề đã đăng lên Kho đề trực tuyến: link rút gọn có mã QR quét được ở trên. Học sinh quét mã hoặc mở link là vào đúng đề; điểm nộp bài tự về Google Sheet của Thầy/Cô.
              </div>
            ) : qrShareUrl.length > 30000 ? (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-[11px] font-semibold text-left">
                ⚠ Đề này có hình ảnh/công thức nên link rất dài ({qrShareUrl.length.toLocaleString('vi-VN')} ký tự) và KHÔNG tạo được mã QR quét được. Thầy hãy dùng nút “Sao chép Link” rồi gửi link cho học sinh qua Zalo/LMS — link dài vẫn mở đúng đề, không bị cắt ngắn. Muốn có link ngắn + QR thật: kết nối "Kho đề trực tuyến (Google)" trong mục Cài đặt & Tài khoản.
              </div>
            ) : null}

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
