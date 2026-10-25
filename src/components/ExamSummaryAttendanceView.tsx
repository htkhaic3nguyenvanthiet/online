import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  Clock,
  Download,
  Printer,
  Search,
  Filter,
  RotateCcw,
  Eye,
  Send,
  Sparkles,
  FileSpreadsheet,
  Calendar,
  Share2,
  Bell,
  ChevronDown,
  Info,
  Check,
  Copy
} from 'lucide-react';
import { ExamSession, Quiz, Classroom, StudentSubmission, Student } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';
import { getStudentExamShareUrl } from '../utils/urlHelper';

interface ExamSummaryAttendanceViewProps {
  sessions: ExamSession[];
  quizzes: Quiz[];
  classrooms: Classroom[];
  submissions: StudentSubmission[];
  selectedSessionId?: string;
  onSelectSession?: (sessionId: string) => void;
  onOpenStudentExam?: (sessionId: string) => void;
  onResetStudentAttempts?: (sessionId: string, studentName: string) => void;
}

export const ExamSummaryAttendanceView: React.FC<ExamSummaryAttendanceViewProps> = ({
  sessions,
  quizzes,
  classrooms,
  submissions,
  selectedSessionId,
  onSelectSession,
  onOpenStudentExam,
  onResetStudentAttempts
}) => {
  // Active session selection
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    if (selectedSessionId && sessions.some(s => s.id === selectedSessionId)) {
      return selectedSessionId;
    }
    return sessions[0]?.id || '';
  });

  // Filter states
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'submitted' | 'unsubmitted' | 'violation'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreGradingMode, setScoreGradingMode] = useState<'max' | 'latest' | 'average'>('max');

  // Detail Modal for a specific student's attempt history
  const [inspectingStudent, setInspectingStudent] = useState<{
    name: string;
    code: string;
    className: string;
    submissions: StudentSubmission[];
  } | null>(null);

  // Reminder Copied toast
  const [copiedReminderText, setCopiedReminderText] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Find active exam session & matching quiz
  const currentSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || sessions[0];
  }, [sessions, activeSessionId]);

  const currentQuiz = useMemo(() => {
    if (!currentSession) return quizzes[0];
    return quizzes.find(q => q.id === currentSession.quizId) || quizzes[0];
  }, [quizzes, currentSession]);

  // Determine which students belong to the roster for this session
  // If session specifies a class (e.g. 12A5 or CNNN), or filter by selectedClassId
  const targetClassrooms = useMemo(() => {
    if (selectedClassId !== 'all') {
      return classrooms.filter(c => c.id === selectedClassId);
    }
    // If session has a className matching a known classroom
    if (currentSession?.className && currentSession.className !== 'Tất cả lớp học (Khối 12)' && currentSession.className !== 'Không gắn lớp') {
      const match = classrooms.filter(c => 
        c.name.toLowerCase().includes(currentSession.className!.toLowerCase()) ||
        currentSession.className!.toLowerCase().includes(c.name.toLowerCase()) ||
        currentSession.className!.toLowerCase().includes(c.code.toLowerCase())
      );
      if (match.length > 0) return match;
    }
    return classrooms;
  }, [classrooms, selectedClassId, currentSession]);

  // Combine roster students and identify submissions for this exam session
  const examSubmissions = useMemo(() => {
    if (!currentSession) return [];
    return submissions.filter(sub => sub.sessionId === currentSession.id || sub.sessionId === currentSession.quizId);
  }, [submissions, currentSession]);

  // Build unified student attendance list (Roster + Walk-in Submissions)
  interface UnifiedStudentRow {
    id: string;
    studentName: string;
    studentCode: string;
    className: string;
    hasSubmitted: boolean;
    attemptCount: number;
    highestScore: number;
    latestScore: number;
    averageScore: number;
    calculatedScore: number; // based on scoreGradingMode
    correctCount: number;
    totalQuestions: number;
    durationSeconds: number;
    latestSubmittedAt: string;
    tabSwitchCount: number;
    submissions: StudentSubmission[];
  }

  const unifiedStudentRows: UnifiedStudentRow[] = useMemo(() => {
    const rowsMap = new Map<string, UnifiedStudentRow>();

    // 1. First add all official students from the targeted classrooms
    targetClassrooms.forEach(cls => {
      cls.students.forEach(st => {
        const key = st.fullName.trim().toLowerCase();
        rowsMap.set(key, {
          id: st.id,
          studentName: st.fullName,
          studentCode: st.studentCode,
          className: cls.name,
          hasSubmitted: false,
          attemptCount: 0,
          highestScore: 0,
          latestScore: 0,
          averageScore: 0,
          calculatedScore: 0,
          correctCount: 0,
          totalQuestions: currentQuiz?.questions?.length || currentSession?.questionCount || 28,
          durationSeconds: 0,
          latestSubmittedAt: 'Chưa làm bài',
          tabSwitchCount: 0,
          submissions: []
        });
      });
    });

    // 2. Map submissions into matching students (or create rows for students who joined directly)
    examSubmissions.forEach(sub => {
      const key = sub.studentName.trim().toLowerCase();
      let row = rowsMap.get(key);

      if (!row) {
        // Walk-in student who entered their name
        const parsedClass = sub.studentInfo ? sub.studentInfo.split('-')[0].trim() : 'Lớp 12';
        const parsedCode = sub.studentInfo ? (sub.studentInfo.split('SBD:')[1]?.trim() || 'SBD-00') : 'SBD-00';
        row = {
          id: 'walkin-' + sub.id,
          studentName: sub.studentName,
          studentCode: parsedCode,
          className: parsedClass,
          hasSubmitted: true,
          attemptCount: 0,
          highestScore: 0,
          latestScore: 0,
          averageScore: 0,
          calculatedScore: 0,
          correctCount: 0,
          totalQuestions: sub.totalQuestions || 28,
          durationSeconds: 0,
          latestSubmittedAt: sub.submittedAt,
          tabSwitchCount: 0,
          submissions: []
        };
        rowsMap.set(key, row);
      }

      // Add to this student's submissions array
      row.hasSubmitted = true;
      row.submissions.push(sub);
      row.attemptCount = row.submissions.length;
      
      const scores = row.submissions.map(s => s.score);
      row.highestScore = Math.max(...scores);
      row.latestScore = scores[scores.length - 1];
      row.averageScore = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);

      // Latest submission stats
      const latest = row.submissions[row.submissions.length - 1];
      row.correctCount = latest.correctAnswersCount;
      row.totalQuestions = latest.totalQuestions || 28;
      row.durationSeconds = latest.durationSeconds;
      row.latestSubmittedAt = latest.submittedAt;
      row.tabSwitchCount = Math.max(...row.submissions.map(s => s.tabSwitchCount || 0));
    });

    // Compute calculated score based on mode
    const allRows = Array.from(rowsMap.values());
    allRows.forEach(row => {
      if (row.hasSubmitted) {
        if (scoreGradingMode === 'max') row.calculatedScore = row.highestScore;
        else if (scoreGradingMode === 'latest') row.calculatedScore = row.latestScore;
        else row.calculatedScore = row.averageScore;
      } else {
        row.calculatedScore = 0;
      }
    });

    return allRows;
  }, [targetClassrooms, examSubmissions, currentQuiz, currentSession, scoreGradingMode]);

  // Filtered rows
  const filteredStudents = useMemo(() => {
    return unifiedStudentRows.filter(st => {
      const matchesSearch = 
        st.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        st.studentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        st.className.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesAttendance = true;
      if (attendanceFilter === 'submitted') matchesAttendance = st.hasSubmitted;
      else if (attendanceFilter === 'unsubmitted') matchesAttendance = !st.hasSubmitted;
      else if (attendanceFilter === 'violation') matchesAttendance = st.tabSwitchCount > 0;

      return matchesSearch && matchesAttendance;
    });
  }, [unifiedStudentRows, searchTerm, attendanceFilter]);

  // Aggregate Statistics
  const totalRosterCount = unifiedStudentRows.length;
  const submittedCount = unifiedStudentRows.filter(s => s.hasSubmitted).length;
  const unsubmittedCount = totalRosterCount - submittedCount;
  const attendanceRate = totalRosterCount > 0 ? Math.round((submittedCount / totalRosterCount) * 100) : 0;

  const totalAttemptsMade = examSubmissions.length;
  const violationCount = unifiedStudentRows.filter(s => s.tabSwitchCount > 0).length;

  const submittedRows = unifiedStudentRows.filter(s => s.hasSubmitted);
  const averageScore = submittedRows.length > 0
    ? +(submittedRows.reduce((a, b) => a + b.calculatedScore, 0) / submittedRows.length).toFixed(2)
    : 0;

  const highestScoreOverall = submittedRows.length > 0
    ? Math.max(...submittedRows.map(s => s.calculatedScore))
    : 0;

  const lowestScoreOverall = submittedRows.length > 0
    ? Math.min(...submittedRows.map(s => s.calculatedScore))
    : 0;

  // Grade Distribution
  const gradeDistribution = useMemo(() => {
    const dist = {
      excellent: 0, // 9.0 - 10.0
      good: 0,      // 8.0 - 8.9
      fair: 0,      // 6.5 - 7.9
      average: 0,   // 5.0 - 6.4
      weak: 0       // < 5.0
    };
    submittedRows.forEach(r => {
      const s = r.calculatedScore;
      if (s >= 9.0) dist.excellent++;
      else if (s >= 8.0) dist.good++;
      else if (s >= 6.5) dist.fair++;
      else if (s >= 5.0) dist.average++;
      else dist.weak++;
    });
    return dist;
  }, [submittedRows]);

  // Unsubmitted students list for quick reminder
  const unsubmittedStudentsList = useMemo(() => {
    return unifiedStudentRows.filter(s => !s.hasSubmitted);
  }, [unifiedStudentRows]);

  // Copy Reminder Message for Absent Students
  const handleCopyAbsentReminder = () => {
    soundEffects.playClick();
    const shareLink = getStudentExamShareUrl(currentSession?.id || '');
    const names = unsubmittedStudentsList.map((s, idx) => `${idx + 1}. ${s.studentName} (${s.className || 'Khối 12'})`).join('\n');
    
    const message = `📢 THÔNG BÁO ĐÔN ĐỐC LÀM BÀI KIỂM TRA TRỰC TUYẾN
Trường: THPT Mang Thít
Giáo viên giao đề: Thầy Hồ Tấn Khải
Bài thi: ${currentSession?.title || 'Bài kiểm tra'}
Thời hạn nộp: ${currentSession?.endTime || 'Hôm nay'}

Hiện tại còn ${unsubmittedStudentsList.length} học sinh CHƯA LÀM BÀI:
${names}

👉 Học sinh bấm vào link sau để vào làm bài ngay trên điện thoại hoặc máy tính:
${shareLink}

(Lưu ý: Hệ thống tự động ghi nhận điểm và biên bản vi phạm đổi tab)`;

    navigator.clipboard?.writeText(message);
    setCopiedReminderText(true);
    setTimeout(() => setCopiedReminderText(false), 2500);
  };

  // Export to CSV / Excel function
  const handleExportExcel = () => {
    soundEffects.playClick();
    const headers = [
      'STT',
      'Mã Học Sinh',
      'Họ và Tên',
      'Lớp',
      'Trạng Thái Điểm Danh',
      'Số Lượt Làm',
      'Điểm Tính (Thang 10)',
      'Điểm Cao Nhất',
      'Điểm Lần Cuối',
      'Điểm Trung Bình',
      'Số Câu Đúng',
      'Thời Gian Làm (giây)',
      'Thời Điểm Nộp',
      'Số Lần Đổi Tab'
    ];

    const rows = unifiedStudentRows.map((st, idx) => [
      idx + 1,
      `"${st.studentCode}"`,
      `"${st.studentName}"`,
      `"${st.className}"`,
      st.hasSubmitted ? 'Đã làm bài' : 'Chưa làm bài',
      st.attemptCount,
      st.calculatedScore,
      st.highestScore,
      st.latestScore,
      st.averageScore,
      `${st.correctCount}/${st.totalQuestions}`,
      st.durationSeconds,
      `"${st.latestSubmittedAt}"`,
      st.tabSwitchCount
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bang_Diem_Diem_Danh_${currentSession?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'KiemTra'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. Header & Exam Selection Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <ClipboardCheck className="w-5 h-5 text-teal-600 stroke-[2.5]" />
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Bảng Tổng Kết Điểm Số & Điểm Danh Học Sinh
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
              Chuẩn TT 7991 GD&ĐT
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Theo dõi chi tiết số lượt làm bài, điểm số từng lượt và điểm danh chuyên cần của học sinh theo từng bài kiểm tra.
          </p>
        </div>

        {/* Exam Session Dropdown Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col text-xs font-semibold text-slate-600">
            <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider mb-1">
              Chọn bài kiểm tra để thống kê:
            </span>
            <div className="relative min-w-[280px] sm:min-w-[340px]">
              <select
                value={activeSessionId}
                onChange={(e) => {
                  soundEffects.playClick();
                  setActiveSessionId(e.target.value);
                  onSelectSession?.(e.target.value);
                }}
                className="w-full bg-slate-50 border-2 border-teal-500/30 text-slate-900 font-bold text-xs rounded-xl px-3.5 py-2.5 pr-8 appearance-none focus:outline-none focus:border-teal-600 cursor-pointer shadow-xs"
              >
                {sessions.map((sess) => (
                  <option key={sess.id} value={sess.id}>
                    {sess.title} ({sess.durationMinutes}&apos; • {sess.questionCount || 28} câu)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4">
            <button
              onClick={handleExportExcel}
              className="btn-3d btn-3d-slate px-3.5 py-2 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold"
              title="Xuất bảng điểm và điểm danh ra file Excel (.CSV)"
            >
              <Download className="w-4 h-4 text-teal-600" />
              <span>Xuất Excel</span>
            </button>

            <button
              onClick={() => window.print()}
              className="btn-3d btn-3d-slate px-3.5 py-2 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold"
              title="In báo cáo điểm danh ra máy in hoặc lưu PDF"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>In Báo Cáo</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Exam Context Information Card */}
      {currentSession && (
        <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 rounded-3xl p-5 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-white/20 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-md">
                Mã phòng thi: #{currentSession.id}
              </span>
              <span className="bg-amber-400 text-amber-950 font-black text-[10px] px-2 py-0.5 rounded-md uppercase">
                {currentSession.allowedAttempts === 0
                  ? 'Vô hạn lượt làm'
                  : currentSession.allowedAttempts === 1
                  ? '1 lượt duy nhất'
                  : `${currentSession.allowedAttempts} lượt thi`}
              </span>
              <span className="bg-emerald-400 text-emerald-950 font-black text-[10px] px-2 py-0.5 rounded-md">
                {currentSession.status === 'active' ? 'Đang mở phòng thi' : 'Đã kết thúc'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white">
              {currentSession.title}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-teal-100">
              <span>Lớp giao đề: <strong className="text-white">{currentSession.className || 'Khối 12'}</strong></span>
              <span>Thời lượng: <strong className="text-white">{currentSession.durationMinutes} phút</strong></span>
              <span>Số câu hỏi: <strong className="text-white">{currentSession.questionCount || 28} câu</strong></span>
              <span>Hạn nộp: <strong className="text-amber-300">{currentSession.endTime}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenStudentExam && (
              <button
                onClick={() => {
                  soundEffects.playClick();
                  onOpenStudentExam(currentSession.id);
                }}
                className="btn-3d btn-3d-teal px-4 py-2 text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-white"
              >
                <Eye className="w-4 h-4" />
                <span>Vào thi thử (HS)</span>
              </button>
            )}

            <button
              onClick={() => {
                soundEffects.playClick();
                const link = getStudentExamShareUrl(currentSession.id);
                navigator.clipboard?.writeText(link);
                alert(`Đã sao chép link phòng thi:\n${link}`);
              }}
              className="btn-3d btn-3d-slate px-3.5 py-2 text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-slate-800"
              title="Sao chép link làm bài thi"
            >
              <Share2 className="w-4 h-4 text-teal-700" />
              <span>Link phòng thi</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. High-Level Attendance & Performance KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Total Students Roster */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tổng học sinh</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {totalRosterCount}
            </span>
            <span className="text-xs text-slate-400 ml-1">thí sinh</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Lớp chọn: {selectedClassId === 'all' ? 'Toàn bộ danh sách' : targetClassrooms[0]?.name}
          </div>
        </div>

        {/* KPI 2: Attended & Submitted */}
        <div className="bg-white rounded-2xl border-2 border-emerald-400/50 p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Đã làm bài
            </span>
            <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-black">
              {attendanceRate}%
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
              {submittedCount}
            </span>
            <span className="text-xs text-slate-500 ml-1">/ {totalRosterCount} HS</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            ✓ Điểm danh: Có mặt làm bài
          </div>
        </div>

        {/* KPI 3: Absent / Unsubmitted */}
        <div className={`bg-white rounded-2xl border-2 ${unsubmittedCount > 0 ? 'border-rose-400/60 bg-rose-50/20' : 'border-slate-200/90'} p-4 flex flex-col justify-between shadow-2xs`}>
          <div className="flex items-center justify-between text-rose-800 text-xs font-bold">
            <span className="flex items-center gap-1">
              <XCircle className="w-4 h-4 text-rose-600" /> Chưa làm bài
            </span>
            {unsubmittedCount > 0 && (
              <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded text-[10px] font-black">
                {100 - attendanceRate}%
              </span>
            )}
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-600 font-mono">
              {unsubmittedCount}
            </span>
            <span className="text-xs text-slate-500 ml-1">HS vắng</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-rose-700 font-semibold">Cần đôn đốc</span>
            {unsubmittedCount > 0 && (
              <button
                onClick={() => setShowReminderModal(true)}
                className="text-[10px] font-bold text-rose-700 underline hover:text-rose-900 cursor-pointer"
              >
                Nhắc nhở
              </button>
            )}
          </div>
        </div>

        {/* KPI 4: Average Score */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Điểm trung bình</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-teal-700 font-mono">
              {averageScore}
            </span>
            <span className="text-xs text-slate-400 ml-1">/ 10</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
            <span>Cao nhất: <strong className="text-emerald-600">{highestScoreOverall}</strong></span>
            <span>Thấp nhất: <strong className="text-slate-700">{lowestScoreOverall}</strong></span>
          </div>
        </div>

        {/* KPI 5: Total Attempts & Violations */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex flex-col justify-between shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tổng lượt nộp bài</span>
            <RotateCcw className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono">
              {totalAttemptsMade}
            </span>
            <span className="text-xs text-slate-400 ml-1">lượt</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Vi phạm tab: <strong className={violationCount > 0 ? 'text-rose-600' : 'text-emerald-600'}>{violationCount} HS</strong></span>
          </div>
        </div>
      </div>

      {/* 4. Grade Distribution Bar (Phổ điểm học lực) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-teal-600" />
            <span>Phổ điểm & Phân loại học lực ({submittedCount} bài thi đã chấm):</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Chế độ tính điểm: <strong className="text-teal-800">{scoreGradingMode === 'max' ? 'Điểm cao nhất' : scoreGradingMode === 'latest' ? 'Điểm lần cuối' : 'Điểm trung bình các lượt'}</strong>
          </div>
        </div>

        {/* Visual Grade Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col items-center">
            <span className="text-[10px] font-bold text-emerald-800 uppercase">Xuất sắc (9.0 - 10)</span>
            <span className="text-lg font-black text-emerald-700 font-mono">{gradeDistribution.excellent} HS</span>
            <span className="text-[10px] text-emerald-600">({submittedCount ? Math.round((gradeDistribution.excellent / submittedCount) * 100) : 0}%)</span>
          </div>

          <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 flex flex-col items-center">
            <span className="text-[10px] font-bold text-teal-800 uppercase">Giỏi (8.0 - 8.9)</span>
            <span className="text-lg font-black text-teal-700 font-mono">{gradeDistribution.good} HS</span>
            <span className="text-[10px] text-teal-600">({submittedCount ? Math.round((gradeDistribution.good / submittedCount) * 100) : 0}%)</span>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 flex flex-col items-center">
            <span className="text-[10px] font-bold text-blue-800 uppercase">Khá (6.5 - 7.9)</span>
            <span className="text-lg font-black text-blue-700 font-mono">{gradeDistribution.fair} HS</span>
            <span className="text-[10px] text-blue-600">({submittedCount ? Math.round((gradeDistribution.fair / submittedCount) * 100) : 0}%)</span>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-col items-center">
            <span className="text-[10px] font-bold text-amber-800 uppercase">Trung bình (5.0 - 6.4)</span>
            <span className="text-lg font-black text-amber-700 font-mono">{gradeDistribution.average} HS</span>
            <span className="text-[10px] text-amber-600">({submittedCount ? Math.round((gradeDistribution.average / submittedCount) * 100) : 0}%)</span>
          </div>

          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex flex-col items-center">
            <span className="text-[10px] font-bold text-rose-800 uppercase">Dưới TB (&lt; 5.0)</span>
            <span className="text-lg font-black text-rose-700 font-mono">{gradeDistribution.weak} HS</span>
            <span className="text-[10px] text-rose-600">({submittedCount ? Math.round((gradeDistribution.weak / submittedCount) * 100) : 0}%)</span>
          </div>
        </div>
      </div>

      {/* 5. Filter Toolbar & Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm học sinh theo họ tên, SBD, mã học sinh..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Center: Class Filter Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold whitespace-nowrap">Lớp học:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="bg-slate-50 border border-slate-200 font-bold text-slate-800 text-xs rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Tất cả lớp ({classrooms.length} lớp)</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.students?.length || 0} HS)
                </option>
              ))}
            </select>
          </div>

          {/* Right: Score grading mode selection */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-semibold whitespace-nowrap">Tính điểm:</span>
            <div className="bg-slate-100 p-0.5 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => setScoreGradingMode('max')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-all ${
                  scoreGradingMode === 'max'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Lấy điểm cao nhất giữa các lượt thi"
              >
                Cao nhất
              </button>
              <button
                onClick={() => setScoreGradingMode('latest')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-all ${
                  scoreGradingMode === 'latest'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Lấy điểm của lượt nộp bài cuối cùng"
              >
                Lượt cuối
              </button>
              <button
                onClick={() => setScoreGradingMode('average')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-all ${
                  scoreGradingMode === 'average'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Lấy trung bình cộng điểm các lượt thi"
              >
                Trung bình
              </button>
            </div>
          </div>
        </div>

        {/* Secondary: Attendance Filter Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Bộ lọc điểm danh:</span>
            <button
              onClick={() => setAttendanceFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                attendanceFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ({unifiedStudentRows.length})
            </button>
            <button
              onClick={() => setAttendanceFilter('submitted')}
              className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                attendanceFilter === 'submitted'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đã làm bài ({submittedCount})</span>
            </button>
            <button
              onClick={() => setAttendanceFilter('unsubmitted')}
              className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                attendanceFilter === 'unsubmitted'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Chưa làm bài ({unsubmittedCount})</span>
            </button>
            <button
              onClick={() => setAttendanceFilter('violation')}
              className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                attendanceFilter === 'violation'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Có vi phạm tab ({violationCount})</span>
            </button>
          </div>

          {unsubmittedCount > 0 && (
            <button
              onClick={handleCopyAbsentReminder}
              className="btn-3d btn-3d-pink px-3.5 py-1.5 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold shadow-xs"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{copiedReminderText ? '✓ Đã sao chép tin nhắn nhắc nhở!' : 'Sao chép tin nhắn đôn đốc HS vắng'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 6. Comprehensive Student Attendance & Score Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 text-center w-12">STT</th>
                <th className="py-3 px-3">Mã HS / SBD</th>
                <th className="py-3 px-4">Họ và tên học sinh</th>
                <th className="py-3 px-3">Lớp</th>
                <th className="py-3 px-3 text-center">Trạng thái điểm danh</th>
                <th className="py-3 px-3 text-center">Số lượt làm</th>
                <th className="py-3 px-3 text-center">
                  Điểm số ({scoreGradingMode === 'max' ? 'Cao nhất' : scoreGradingMode === 'latest' ? 'Lần cuối' : 'Trung bình'})
                </th>
                <th className="py-3 px-3 text-center">Đúng / Tổng câu</th>
                <th className="py-3 px-3 text-center">Thời gian làm</th>
                <th className="py-3 px-3 text-center">Thời điểm nộp</th>
                <th className="py-3 px-3 text-center">Giám sát tab</th>
                <th className="py-3 px-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-sm">Không tìm thấy học sinh nào phù hợp bộ lọc.</p>
                    <p className="text-xs text-slate-400 mt-0.5">Vui lòng thử tìm kiếm khác hoặc đổi bộ lọc điểm danh.</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, idx) => {
                  let gradeBadge = 'bg-slate-100 text-slate-600';
                  if (st.hasSubmitted) {
                    if (st.calculatedScore >= 9.0) gradeBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                    else if (st.calculatedScore >= 8.0) gradeBadge = 'bg-teal-100 text-teal-800 border-teal-300';
                    else if (st.calculatedScore >= 6.5) gradeBadge = 'bg-blue-100 text-blue-800 border-blue-300';
                    else if (st.calculatedScore >= 5.0) gradeBadge = 'bg-amber-100 text-amber-800 border-amber-300';
                    else gradeBadge = 'bg-rose-100 text-rose-800 border-rose-300';
                  }

                  return (
                    <tr
                      key={st.id || idx}
                      className={`hover:bg-teal-50/40 transition-colors ${
                        !st.hasSubmitted ? 'bg-rose-50/15' : ''
                      }`}
                    >
                      {/* STT */}
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Mã HS / SBD */}
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-700">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {st.studentCode}
                        </span>
                      </td>

                      {/* Họ và tên */}
                      <td className="py-3.5 px-4 font-black text-slate-900 text-xs sm:text-sm">
                        <div className="flex items-center gap-1.5">
                          <span>{st.studentName}</span>
                          {st.calculatedScore === 10.0 && (
                            <span title="Điểm tuyệt đối 10.0" className="text-amber-500">★</span>
                          )}
                        </div>
                      </td>

                      {/* Lớp */}
                      <td className="py-3.5 px-3 font-semibold text-slate-600 text-xs">
                        {st.className}
                      </td>

                      {/* Trạng thái điểm danh */}
                      <td className="py-3.5 px-3 text-center">
                        {st.hasSubmitted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>ĐÃ LÀM BÀI</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>CHƯA THI (VẮNG)</span>
                          </span>
                        )}
                      </td>

                      {/* Số lượt làm */}
                      <td className="py-3.5 px-3 text-center">
                        {st.hasSubmitted ? (
                          <span className="inline-block px-2 py-0.5 rounded-md font-mono font-black text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {st.attemptCount} lượt
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">0 lượt</span>
                        )}
                      </td>

                      {/* Điểm số */}
                      <td className="py-3.5 px-3 text-center">
                        {st.hasSubmitted ? (
                          <div>
                            <span className={`inline-block font-mono font-black text-sm px-2.5 py-0.5 rounded-lg border ${gradeBadge}`}>
                              {st.calculatedScore}
                            </span>
                            {st.attemptCount > 1 && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Max: {st.highestScore} | Lần cuối: {st.latestScore}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono font-bold">- / -</span>
                        )}
                      </td>

                      {/* Đúng / Tổng câu */}
                      <td className="py-3.5 px-3 text-center font-mono text-slate-700">
                        {st.hasSubmitted ? (
                          <span className="font-bold">
                            {st.correctCount} <span className="text-slate-400 font-normal">/ {st.totalQuestions}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Thời gian làm bài */}
                      <td className="py-3.5 px-3 text-center font-mono text-slate-700">
                        {st.hasSubmitted ? (
                          <span>
                            {Math.floor(st.durationSeconds / 60)}m {st.durationSeconds % 60}s
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Thời điểm nộp */}
                      <td className="py-3.5 px-3 text-center text-slate-600 text-[11px] font-mono">
                        {st.hasSubmitted ? st.latestSubmittedAt : <span className="text-rose-500 font-bold">Chưa nộp</span>}
                      </td>

                      {/* Giám sát vi phạm tab */}
                      <td className="py-3.5 px-3 text-center">
                        {st.hasSubmitted ? (
                          st.tabSwitchCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>{st.tabSwitchCount} lần tab</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>0 vi phạm ✓</span>
                            </span>
                          )
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {st.hasSubmitted ? (
                            <button
                              onClick={() => {
                                soundEffects.playClick();
                                setInspectingStudent({
                                  name: st.studentName,
                                  code: st.studentCode,
                                  className: st.className,
                                  submissions: st.submissions
                                });
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 cursor-pointer flex items-center gap-1"
                              title="Xem chi tiết các lượt thi và bài làm của học sinh này"
                            >
                              <Eye className="w-3.5 h-3.5 text-teal-600" />
                              <span>Lịch sử ({st.attemptCount})</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                soundEffects.playClick();
                                alert(`Đã gửi thông báo đôn đốc làm bài thi tới học sinh: ${st.studentName} (${st.className})`);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 cursor-pointer flex items-center gap-1"
                              title="Gửi tin nhắn hoặc nhắc nhở học sinh này làm bài ngay"
                            >
                              <Bell className="w-3 h-3 text-rose-500" />
                              <span>Đôn đốc</span>
                            </button>
                          )}

                          {onResetStudentAttempts && st.hasSubmitted && (
                            <button
                              onClick={() => {
                                if (confirm(`Cho phép học sinh ${st.studentName} được làm lại bài thi từ đầu?`)) {
                                  onResetStudentAttempts(currentSession?.id || '', st.studentName);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                              title="Cho phép học sinh thi lại"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 font-semibold gap-3">
          <div>
            Hiển thị <strong className="text-slate-900">{filteredStudents.length}</strong> / {totalRosterCount} học sinh • Đã nộp bài: <strong className="text-emerald-700">{submittedCount}</strong> • Vắng/Chưa thi: <strong className="text-rose-700">{unsubmittedCount}</strong>
          </div>

          <div className="flex items-center gap-3">
            <span>Điểm trung bình lớp: <strong className="text-teal-800 text-sm font-mono font-black">{averageScore}</strong></span>
            <span>Tỉ lệ hoàn thành: <strong className="text-emerald-700 text-sm font-mono font-black">{attendanceRate}%</strong></span>
          </div>
        </div>
      </div>

      {/* 7. MODAL: Student Attempt History Breakdown */}
      {inspectingStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 font-black text-xl flex items-center justify-center shadow-inner">
                  {inspectingStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Lịch Sử Các Lượt Làm Bài: {inspectingStudent.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mã HS: <span className="font-bold text-slate-700">{inspectingStudent.code}</span> • Lớp: <span className="font-bold text-teal-700">{inspectingStudent.className}</span> • Bài thi: {currentSession?.title}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectingStudent(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* List of Attempts */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {inspectingStudent.submissions.map((sub, idx) => (
                <div
                  key={sub.id || idx}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-teal-700 text-white font-black text-xs px-2.5 py-0.5 rounded-md">
                        Lượt {sub.attemptNumber || idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 font-mono">
                        {sub.submittedAt}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-3">
                      <span>Thời gian: <strong>{Math.floor(sub.durationSeconds / 60)}p {sub.durationSeconds % 60}s</strong></span>
                      <span>Số câu đúng: <strong className="text-emerald-700">{sub.correctAnswersCount}/{sub.totalQuestions || 28}</strong></span>
                      <span>Vi phạm tab: <strong className={sub.tabSwitchCount && sub.tabSwitchCount > 0 ? 'text-rose-600' : 'text-emerald-600'}>{sub.tabSwitchCount || 0} lần</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Điểm số</div>
                      <div className="text-2xl font-black font-mono text-teal-800 leading-none">
                        {sub.score} <span className="text-xs font-normal text-slate-400">/ 10</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">
                Điểm cao nhất: <strong className="text-emerald-700 font-mono text-sm">{Math.max(...inspectingStudent.submissions.map(s => s.score))}</strong>
              </span>
              <button
                onClick={() => setInspectingStudent(null)}
                className="btn-3d btn-3d-slate px-4 py-2 rounded-xl font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: Absent Students Reminder & Notification */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-700 font-black text-base">
                <Bell className="w-5 h-5 text-rose-600" />
                <span>Danh Sách Học Sinh Chưa Làm Bài ({unsubmittedStudentsList.length} HS)</span>
              </div>
              <button
                onClick={() => setShowReminderModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Dưới đây là danh sách học sinh chưa nộp bài thi cho bài kiểm tra <strong>{currentSession?.title}</strong>. Thầy có thể bấm &quot;Sao chép tin nhắn&quot; để dán vào nhóm Zalo lớp thông báo đôn đốc học sinh:
            </p>

            <div className="max-h-60 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              {unsubmittedStudentsList.map((st, idx) => (
                <div key={st.id || idx} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                  <span className="font-bold text-slate-800">
                    {idx + 1}. {st.studentName}
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {st.studentCode} • {st.className}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReminderModal(false)}
                className="btn-3d btn-3d-slate px-4 py-2 text-xs rounded-xl font-bold cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  handleCopyAbsentReminder();
                  setShowReminderModal(false);
                }}
                className="btn-3d btn-3d-pink px-4 py-2 text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-white shadow-md"
              >
                <Copy className="w-4 h-4" />
                <span>Sao chép tin nhắn gửi nhóm Zalo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
