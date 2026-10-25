import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Power,
  Clock,
  Plus,
  Minus,
  Flame,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Award,
  Send,
  HelpCircle,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  Maximize2,
  Minimize2,
  Eye,
  Bot,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  FileCheck
} from 'lucide-react';
import { OptionKey, Question, ExamSession, StudentSubmission, CheatLog } from '../types/quiz';
import { sampleQuestions } from '../data/mockData';
import { soundEffects } from '../utils/soundEffects';
import { realtimeEngine } from '../services/realtimeEngine';
import { aiService } from '../services/aiService';

interface StudentArenaViewProps {
  quizTitle?: string;
  session?: ExamSession;
  customQuestions?: Question[];
  isDirectStudentMode?: boolean;
  onExit: () => void;
  onResultSubmitted?: (sub: StudentSubmission) => void;
}

export const StudentArenaView: React.FC<StudentArenaViewProps> = ({
  quizTitle = 'ÔN CN12-1-2-3',
  session,
  customQuestions,
  isDirectStudentMode = false,
  onExit,
  onResultSubmitted
}) => {
  // Steps: 'landing' (Lobby) -> 'info-modal' -> 'testing' -> 'result'
  const [step, setStep] = useState<'landing' | 'info-modal' | 'testing' | 'result'>('landing');

  // Session config with defaults
  const resolvedSessionId = session?.id || '4975878';
  const resolvedTitle = session?.title || quizTitle;
  const resolvedDurationMinutes = session?.durationMinutes || 45;
  const resolvedAllowedAttempts = session?.allowedAttempts ?? 3; // 0 = unlimited
  const resolvedMaxTabSwitches = session?.antiCheatConfig?.maxTabSwitches ?? 3;

  // Student Info
  const [studentName, setStudentName] = useState('Nguyễn Thành Nam');
  const [studentInfo, setStudentInfo] = useState('12A5 - SBD: 052');

  // Test state
  const questions = (customQuestions && customQuestions.length > 0) ? customQuestions : sampleQuestions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [streak, setStreak] = useState(0);
  const [fontSizeOffset, setFontSizeOffset] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(resolvedDurationMinutes * 60);
  const [finalSubmission, setFinalSubmission] = useState<StudentSubmission | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Anti-Cheat & Proctoring state
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [cheatLogs, setCheatLogs] = useState<CheatLog[]>([]);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [lastViolationMsg, setLastViolationMsg] = useState('');
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [disqualificationReason, setDisqualificationReason] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const [showCompletionSummaryModal, setShowCompletionSummaryModal] = useState(false);

  // Post-exam Review & AI Tutor state (STRICTLY post-exam only)
  const [showReviewMode, setShowReviewMode] = useState(false);
  const [reviewQuestionIndex, setReviewQuestionIndex] = useState(0);
  const [isAiExplaining, setIsAiExplaining] = useState(false);
  const [aiExplanationText, setAiExplanationText] = useState<string | null>(null);
  const [aiExplainedQuestionId, setAiExplainedQuestionId] = useState<string | null>(null);

  // Attempt tracker persistence
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [completedAttemptsCount, setCompletedAttemptsCount] = useState(0);

  // Load past attempts count
  useEffect(() => {
    try {
      const storageKey = `testonline_attempts_${resolvedSessionId}_${studentName.trim()}`;
      const savedCount = parseInt(localStorage.getItem(storageKey) || '0', 10);
      setCompletedAttemptsCount(savedCount);
      setAttemptNumber(savedCount + 1);
    } catch {
      // ignore
    }
  }, [resolvedSessionId, studentName]);

  // Network monitor for 4G/5G resilience
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Restore draft if available for active session
    try {
      const saved = localStorage.getItem(`testonline_draft_${resolvedSessionId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Date.now() - parsed.timestamp < 3600000 * 2) {
          setUserAnswers(parsed.userAnswers || {});
          setCurrentIndex(parsed.currentIndex || 0);
          setStreak(parsed.streak || 0);
          setStudentName(parsed.studentName || studentName);
          setStudentInfo(parsed.studentInfo || studentInfo);
          setTabSwitchCount(parsed.tabSwitchCount || 0);
          setCheatLogs(parsed.cheatLogs || []);
          if (parsed.secondsRemaining && parsed.secondsRemaining > 0) {
            setSecondsRemaining(parsed.secondsRemaining);
          }
        }
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [resolvedSessionId]);

  // Autosave during exam
  useEffect(() => {
    if (step === 'testing') {
      try {
        localStorage.setItem(
          `testonline_draft_${resolvedSessionId}`,
          JSON.stringify({
            quizTitle: resolvedTitle,
            studentName,
            studentInfo,
            currentIndex,
            userAnswers,
            streak,
            secondsRemaining,
            tabSwitchCount,
            cheatLogs,
            timestamp: Date.now()
          })
        );
      } catch {
        // ignore
      }
    }
  }, [step, currentIndex, userAnswers, streak, secondsRemaining, tabSwitchCount, cheatLogs, resolvedSessionId, resolvedTitle, studentName, studentInfo]);

  // Countdown timer
  useEffect(() => {
    if (step !== 'testing') return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  // ANTI-CHEAT: Listen for tab switch and window blur during exam
  useEffect(() => {
    if (step !== 'testing') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolationTriggered('Chuyển sang tab khác hoặc thu nhỏ trình duyệt');
      }
    };

    const handleWindowBlur = () => {
      handleViolationTriggered('Rời khỏi cửa sổ bài thi (mở phần mềm/ứng dụng khác)');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [step, tabSwitchCount]);

  const handleViolationTriggered = (reason: string) => {
    soundEffects.playWarning();
    const newCount = tabSwitchCount + 1;
    setTabSwitchCount(newCount);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const logItem: CheatLog = {
      timestamp: timeStr,
      event: `Lần ${newCount}: ${reason}`,
      type: 'tab_switch'
    };
    setCheatLogs((prev) => [...prev, logItem]);
    setLastViolationMsg(reason);
    setShowViolationModal(true);

    // If exceeded allowed violations -> Auto-disqualify & submit
    if (newCount >= resolvedMaxTabSwitches) {
      setIsDisqualified(true);
      const disReason = `Đình chỉ thi do vi phạm rời màn hình thi ${newCount}/${resolvedMaxTabSwitches} lần quy định!`;
      setDisqualificationReason(disReason);
      setTimeout(() => {
        finishAndAutoSubmit(userAnswers, true, disReason);
      }, 1800);
    }
  };

  const handleTimeExpired = () => {
    soundEffects.playWarning();
    alert('⏱ Hết giờ làm bài! Hệ thống tự động thu bài và chấm điểm.');
    finishAndAutoSubmit(userAnswers, false);
  };

  const toggleFullscreen = () => {
    soundEffects.playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentQ = questions[currentIndex];

  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours.toString().padStart(2, '0')} : ${minutes.toString().padStart(2, '0')} : ${seconds.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (key: OptionKey) => {
    soundEffects.playClick();
    const updated = { ...userAnswers, [currentQ.id]: key };
    setUserAnswers(updated);

    const isCorrect = key === currentQ.correctAnswer;
    if (isCorrect) {
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
  };

  const handleToggleSubItem = (subKey: 'a' | 'b' | 'c' | 'd', isTrue: boolean) => {
    soundEffects.playClick();
    const currentSubMap = userAnswers[currentQ.id] || {};
    const updated = {
      ...userAnswers,
      [currentQ.id]: {
        ...currentSubMap,
        [subKey]: isTrue
      }
    };
    setUserAnswers(updated);
  };

  const handleShortAnswerChange = (val: string) => {
    const clean = val.replace(/[^0-9a-zA-Z]/g, '').slice(0, 4);
    setUserAnswers({
      ...userAnswers,
      [currentQ.id]: clean
    });
  };

  const finishAndAutoSubmit = (
    answers: Record<string, any>,
    disqualified = false,
    disReason?: string
  ) => {
    if (!disqualified) {
      soundEffects.playFanfare();
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch {
        // ignore
      }
    }

    let earnedPoints = 0;
    let totalMaxPoints = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    questions.forEach((q) => {
      const ans = answers[q.id];
      if (q.partType === 'part2_true_false') {
        totalMaxPoints += 1.0;
        if (!ans || Object.keys(ans).length === 0) {
          unansweredCount++;
        } else {
          let subCorrect = 0;
          q.subItems?.forEach((si) => {
            if (ans[si.key] === si.isCorrect) {
              subCorrect++;
            }
          });
          // Circular 7991 grading rule:
          // 1 correct item: 0.1 pt
          // 2 correct items: 0.25 pt
          // 3 correct items: 0.5 pt
          // 4 correct items: 1.0 pt
          let qPt = 0;
          if (subCorrect === 1) qPt = 0.1;
          else if (subCorrect === 2) qPt = 0.25;
          else if (subCorrect === 3) qPt = 0.5;
          else if (subCorrect === 4) qPt = 1.0;

          earnedPoints += qPt;
          if (subCorrect === 4) {
            correctCount++;
          } else if (subCorrect > 0) {
            correctCount += subCorrect / 4;
            wrongCount++;
          } else {
            wrongCount++;
          }
        }
      } else if (q.partType === 'part3_short_answer') {
        totalMaxPoints += 0.25;
        const expected = (q.shortAnswerCorrect || q.correctAnswer || '1234').toString().trim().toLowerCase();
        const studentAns = (ans || '').toString().trim().toLowerCase();
        if (!ans) {
          unansweredCount++;
        } else if (studentAns === expected) {
          earnedPoints += 0.25;
          correctCount++;
        } else {
          wrongCount++;
        }
      } else {
        // Part 1 choice
        totalMaxPoints += 0.25;
        if (!ans) {
          unansweredCount++;
        } else if (ans === q.correctAnswer) {
          earnedPoints += 0.25;
          correctCount++;
        } else {
          wrongCount++;
        }
      }
    });

    const calculatedScore = disqualified ? 0 : +((earnedPoints / (totalMaxPoints || 10)) * 10).toFixed(2);
    const duration = resolvedDurationMinutes * 60 - secondsRemaining;

    // Call Realtime Engine: Auto-grades & instantly transmits back to Teacher Dashboard!
    const sub = realtimeEngine.submitStudentExam({
      sessionId: resolvedSessionId,
      studentName: studentName || 'Học sinh ẩn danh',
      studentInfo: studentInfo || 'Lớp 12A5',
      score: calculatedScore,
      totalPoints: 10.0,
      correctAnswersCount: correctCount,
      wrongAnswersCount: wrongCount,
      unansweredCount,
      totalQuestions: questions.length,
      durationSeconds: Math.max(1, duration),
      streakMax: Math.max(streak, correctCount),
      answers,
      tabSwitchCount,
      cheatLogs,
      attemptNumber,
      isDisqualified: disqualified,
      disqualificationReason: disReason
    });

    // Save completed attempt count in localStorage
    try {
      const storageKey = `testonline_attempts_${resolvedSessionId}_${studentName.trim()}`;
      const newAttemptCount = completedAttemptsCount + 1;
      localStorage.setItem(storageKey, newAttemptCount.toString());
      setCompletedAttemptsCount(newAttemptCount);
      localStorage.removeItem(`testonline_draft_${resolvedSessionId}`);
    } catch {
      // ignore
    }

    setFinalSubmission(sub);
    setShowSubmitConfirmModal(false);
    setShowViolationModal(false);
    setShowCompletionSummaryModal(true);
    setStep('result');

    if (onResultSubmitted) {
      onResultSubmitted(sub);
    }
  };

  // POST-EXAM ONLY: AI Explanation Request
  const handleAskAITutorPostExam = async (q: Question) => {
    soundEffects.playClick();
    setIsAiExplaining(true);
    setAiExplainedQuestionId(q.id);
    setAiExplanationText('Đang kết nối với Trợ lý AI Gemini 3.8 Flash...');

    try {
      const chosen = finalSubmission?.answers[q.id];
      const fallbackOptions = q.options && q.options.length > 0
        ? q.options
        : q.subItems
        ? q.subItems.map(si => ({ key: si.key.toUpperCase() as OptionKey, text: `${si.content} (${si.isCorrect ? 'ĐÚNG' : 'SAI'})` }))
        : [{ key: 'A' as OptionKey, text: `Đáp án 4 ký tự: ${q.shortAnswerCorrect || '1234'}` }];

      const explanation = await aiService.explainQuestion({
        questionContent: q.content,
        options: fallbackOptions,
        selectedAnswer: typeof chosen === 'object' ? JSON.stringify(chosen) : (chosen || undefined),
        correctAnswer: (q.correctAnswer || q.shortAnswerCorrect || 'A').toString(),
        subject: 'Công nghệ 12 - THPT Mang Thít'
      });
      setAiExplanationText(explanation);
      soundEffects.playCorrect();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      setAiExplanationText('Không thể kết nối AI: ' + message);
    } finally {
      setIsAiExplaining(false);
    }
  };

  const handleRetakeExam = () => {
    if (resolvedAllowedAttempts > 0 && completedAttemptsCount >= resolvedAllowedAttempts) {
      alert(`⛔ Bạn đã làm tối đa ${resolvedAllowedAttempts} lượt cho phép. Không thể làm lại!`);
      return;
    }
    soundEffects.playClick();
    setUserAnswers({});
    setCurrentIndex(0);
    setStreak(0);
    setTabSwitchCount(0);
    setCheatLogs([]);
    setIsDisqualified(false);
    setDisqualificationReason(null);
    setSecondsRemaining(resolvedDurationMinutes * 60);
    setShowReviewMode(false);
    setShowCompletionSummaryModal(false);
    setFinalSubmission(null);
    setStep('landing');
  };

  const hasExceededAttempts = resolvedAllowedAttempts > 0 && completedAttemptsCount >= resolvedAllowedAttempts;

  /* =========================================================================
     1. LANDING SCREEN / LOBBY (Sảnh chờ thi chuyên nghiệp chuẩn quốc tế)
     ========================================================================= */
  if (step === 'landing') {
    return (
      <div className="min-h-[84vh] bg-gradient-to-b from-[#251838] via-[#1a1226] to-[#0f0917] rounded-3xl p-6 sm:p-10 flex items-center justify-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-10 left-12 text-pink-300/10 text-4xl select-none">★</div>
        <div className="absolute bottom-16 right-16 text-pink-400/15 text-5xl select-none">★</div>

        <div className="w-full max-w-2xl bg-[#332247]/95 border-2 border-pink-500/40 rounded-3xl p-6 sm:p-8 text-center text-white shadow-2xl backdrop-blur-md relative z-10 space-y-6">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="bg-white/10 text-pink-200 text-xs font-bold tracking-wider px-3.5 py-1 rounded-full uppercase">
              Hệ Thống Khảo Sát Trực Tuyến
            </span>
            <span className="bg-rose-500/90 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
              Công nghệ 12 • THPT Mang Thít
            </span>
            <span className="bg-emerald-500/80 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Chống gian lận AI Proctor
            </span>
          </div>

          {/* Exam Title */}
          <div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-2">
              {resolvedTitle}
            </h1>
            <p className="text-pink-200/80 text-xs sm:text-sm font-medium">
              Giáo viên giao đề: <span className="font-bold text-pink-300">Thầy Hồ Tấn Khải</span> • Trường THPT Mang Thít
            </p>
          </div>

          {/* Detailed Assignment Specification Grid (Thời gian, Hạn làm, Số lượt) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left">
            {/* Thời gian */}
            <div className="bg-[#211631]/90 border border-pink-400/20 rounded-2xl p-3 flex flex-col justify-between">
              <span className="text-[11px] text-pink-200/70 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-pink-400" /> Thời gian làm
              </span>
              <span className="text-lg font-black text-white font-mono mt-1">
                {resolvedDurationMinutes}&apos; <span className="text-xs font-normal text-pink-300">(Phút)</span>
              </span>
            </div>

            {/* Số lượt làm bài */}
            <div className="bg-[#211631]/90 border border-pink-400/20 rounded-2xl p-3 flex flex-col justify-between">
              <span className="text-[11px] text-pink-200/70 font-semibold flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Số lượt thi
              </span>
              <div className="mt-1">
                <span className="text-base font-extrabold text-white">
                  {resolvedAllowedAttempts === 0 ? 'Vô hạn' : `${resolvedAllowedAttempts} lượt`}
                </span>
                <div className="text-[10px] text-pink-300/80">
                  (Đã làm: <span className="font-bold text-amber-300">{completedAttemptsCount}</span>)
                </div>
              </div>
            </div>

            {/* Thời hạn làm bài */}
            <div className="bg-[#211631]/90 border border-pink-400/20 rounded-2xl p-3 flex flex-col justify-between col-span-2 sm:col-span-1">
              <span className="text-[11px] text-pink-200/70 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Thời hạn nộp
              </span>
              <span className="text-xs font-bold text-emerald-300 leading-tight mt-1">
                {session?.endTime || '23:59 31/12/2026'}
              </span>
            </div>

            {/* Số câu hỏi */}
            <div className="bg-[#211631]/90 border border-pink-400/20 rounded-2xl p-3 flex flex-col justify-between col-span-2 sm:col-span-1">
              <span className="text-[11px] text-pink-200/70 font-semibold flex items-center gap-1">
                ≡ Số câu hỏi
              </span>
              <span className="text-lg font-black text-white font-mono mt-1">
                {questions.length} <span className="text-xs font-normal text-pink-300">câu (10đ)</span>
              </span>
            </div>
          </div>

          {/* Strict Anti-Cheat & Proctoring Rules Banner */}
          <div className="p-4 bg-slate-900/60 border border-amber-400/30 rounded-2xl text-left text-xs space-y-2 text-slate-200">
            <div className="font-black text-amber-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>QUY CHẾ PHÒNG THI & CHỐNG GIAN LẬN (BẮT BUỘC):</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300 list-disc list-inside">
              <li>
                <span className="font-bold text-rose-300">Không được đổi tab màn hình / thu nhỏ cửa sổ:</span> Hệ thống tự động phát hiện và cảnh báo. Vi phạm quá <span className="font-black text-amber-300">{resolvedMaxTabSwitches} lần</span> bài thi sẽ tự động bị đình chỉ và thu hồi ngay!
              </li>
              <li>
                <span className="font-bold text-amber-300">🔒 Gia sư AI bị khoá tuyệt đối khi đang làm bài:</span> Học sinh không thể xem giải thích khi thi để đảm bảo tính công bằng. Giải thích chi tiết từ AI Gemini 3.8 Flash sẽ mở sau khi nộp bài!
              </li>
              <li>
                <span className="font-bold text-emerald-300">Tự động trả điểm về máy chủ:</span> Khi bấm Nộp bài hoặc hết giờ, kết quả điểm số sẽ được gửi tức thì về Bảng Giám Sát của Thầy Hồ Tấn Khải.
              </li>
            </ul>
          </div>

          {/* Student Identity Input Card */}
          <div className="bg-[#211631]/95 border border-pink-400/30 rounded-2xl p-4 text-left space-y-3">
            <div className="text-xs font-bold text-pink-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>👤 Thông tin học sinh làm bài thi:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Họ và tên học sinh:</label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Nhập họ và tên học sinh..."
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 font-bold rounded-xl border-2 border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500 shadow-inner"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Lớp / Số báo danh:</label>
                <input
                  type="text"
                  value={studentInfo}
                  onChange={(e) => setStudentInfo(e.target.value)}
                  placeholder="Ví dụ: 12A5 - SBD: 052"
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 font-bold rounded-xl border-2 border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500 shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* Start CTA Button */}
          {hasExceededAttempts ? (
            <div className="p-3.5 bg-rose-900/80 border border-rose-500 rounded-2xl text-rose-100 text-xs font-bold text-center">
              ⛔ Bạn đã hoàn thành tối đa {resolvedAllowedAttempts} lượt thi của đề này. Vui lòng liên hệ Thầy Hồ Tấn Khải để được cấp thêm quyền thi!
            </div>
          ) : (
            <button
              onClick={() => {
                if (!studentName.trim()) {
                  alert('Vui lòng nhập Họ và tên trước khi bắt đầu làm bài!');
                  return;
                }
                soundEffects.playClick();
                setStep('testing');
              }}
              className="btn-3d btn-3d-pink w-full py-4 text-base rounded-2xl flex items-center justify-center gap-2 cursor-pointer font-black tracking-wide uppercase shadow-2xl"
            >
              <span>▶ Bắt đầu vào làm bài thi ngay (Lượt {attemptNumber})</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  /* =========================================================================
     2. INFO CONFIRMATION MODAL
     ========================================================================= */
  if (step === 'info-modal') {
    return (
      <div className="min-h-[84vh] bg-gradient-to-b from-[#251838] via-[#1a1226] to-[#0f0917] rounded-3xl p-6 sm:p-10 flex items-center justify-center relative">
        <div className="w-full max-w-lg bg-[#37244f] border-2 border-pink-500/50 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-black text-white">Xác nhận thông tin thí sinh</h2>
            <p className="text-pink-200/80 text-xs mt-1">Thông tin sẽ ghi nhận vào biên bản nộp bài trực tuyến</p>
          </div>

          <div className="space-y-4 text-xs font-semibold">
            <div>
              <label className="block text-pink-100 mb-1.5 font-bold">Họ và tên thí sinh:</label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Nhập họ và tên..."
                className="w-full px-4 py-2.5 bg-white text-slate-800 rounded-2xl font-bold border-2 border-pink-300 focus:outline-none focus:border-pink-500 text-xs shadow-inner"
              />
            </div>

            <div>
              <label className="block text-pink-100 mb-1.5 font-bold">Lớp / Số báo danh:</label>
              <input
                type="text"
                required
                value={studentInfo}
                onChange={(e) => setStudentInfo(e.target.value)}
                placeholder="Ví dụ: 12A5 - SBD: 052"
                className="w-full px-4 py-2.5 bg-white text-slate-800 rounded-2xl font-bold border-2 border-pink-300 focus:outline-none focus:border-pink-500 text-xs shadow-inner"
              />
            </div>
          </div>

          <div className="p-3 bg-pink-950/50 border border-pink-500/30 rounded-xl text-[11px] text-pink-200 space-y-1">
            <div className="font-bold text-pink-300">✦ Cam kết quy chế:</div>
            <p>Tôi cam kết làm bài trung thực, không chuyển tab, không sử dụng trợ giúp trái phép trong suốt thời gian thi.</p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                soundEffects.playClick();
                setStep('testing');
              }}
              className="btn-3d btn-3d-pink w-full py-3.5 text-sm rounded-2xl font-black cursor-pointer shadow-lg"
            >
              Vào phòng thi ngay ➔
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                setStep('landing');
              }}
              className="text-pink-300/70 hover:text-pink-100 text-xs py-1 text-center"
            >
              Quay lại sảnh
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
     3. LIVE EXAM ARENA SCREEN (Chống đổi tab, Khóa AI, Ma trận câu hỏi, Nộp bài)
     ========================================================================= */
  if (step === 'testing') {
    const isLastQuestion = currentIndex === questions.length - 1;
    const answeredCount = questions.filter(q => {
      const a = userAnswers[q.id];
      if (!a) return false;
      if (typeof a === 'object') return Object.keys(a).length > 0;
      if (typeof a === 'string') return a.trim().length > 0;
      return true;
    }).length;

    const isCurrentAnswered = (() => {
      const a = userAnswers[currentQ?.id];
      if (!a) return false;
      if (typeof a === 'object') return Object.keys(a).length > 0;
      if (typeof a === 'string') return a.trim().length > 0;
      return true;
    })();

    return (
      <div
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => {
          e.preventDefault();
          soundEffects.playWarning();
        }}
        className="min-h-[85vh] bg-[#db2777] rounded-3xl p-4 sm:p-6 text-white flex flex-col justify-between shadow-2xl relative select-none"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-pink-400/40">
          {/* Power/Exit button */}
          <button
            onClick={() => {
              soundEffects.playClick();
              if (isDirectStudentMode) {
                if (confirm('Nếu thoát bây giờ, bài thi của bạn sẽ không được nộp! Bạn có chắc muốn quay lại sảnh chờ bài thi này?')) {
                  setStep('landing');
                }
              } else {
                if (confirm('Nếu thoát bây giờ, bài thi của bạn sẽ không được nộp! Bạn có chắc muốn thoát?')) {
                  onExit();
                }
              }
            }}
            className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 flex items-center justify-center text-white cursor-pointer transition-colors"
            title="Thoát phòng thi"
          >
            <Power className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Student identifier & Network Status */}
          <div className="text-center flex flex-col items-center">
            <span className="font-extrabold text-sm sm:text-base text-white tracking-wide">
              {studentName} • {studentInfo}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  isOnline ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40' : 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                <span>{isOnline ? 'Mạng 4G/5G: Ổn định' : 'Mất mạng: Đang lưu vào bộ nhớ máy'}</span>
              </span>

              {/* Anti-cheat tab violation indicator */}
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  tabSwitchCount === 0
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-rose-900 text-rose-200 border border-rose-400 animate-pulse'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Vi phạm tab: {tabSwitchCount}/{resolvedMaxTabSwitches}</span>
              </span>
            </div>
          </div>

          {/* Timer & Fullscreen Toggle */}
          <div className="flex items-center gap-1.5">
            <div
              className={`border rounded-full px-3 py-1 flex items-center gap-1.5 shadow-md ${
                secondsRemaining < 300
                  ? 'bg-rose-700 border-rose-300 animate-pulse'
                  : 'bg-gradient-to-r from-pink-400/50 to-purple-900/60 border-white/40'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-300 animate-spin" />
              <span className="font-mono font-black text-xs sm:text-sm tracking-wider">
                {formatTimer(secondsRemaining)}
              </span>
            </div>

            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
              title="Bật/Tắt Toàn màn hình"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Font size adjustments */}
            <button
              onClick={() => setFontSizeOffset((o) => Math.min(4, o + 1))}
              className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xs font-bold cursor-pointer"
              title="Phóng to chữ"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setFontSizeOffset((o) => Math.max(-2, o - 1))}
              className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xs font-bold cursor-pointer"
              title="Thu nhỏ chữ"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Question Matrix Navigation Palette (World-class online exam feature) */}
        <div className="mt-2 py-2 px-3 bg-black/20 rounded-2xl flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 text-[11px] font-bold text-pink-200 whitespace-nowrap">
            <span>Mục lục câu hỏi ({answeredCount}/{questions.length}):</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {questions.map((q, idx) => {
              const isAns = !!userAnswers[q.id];
              const isCurr = idx === currentIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    soundEffects.playClick();
                    setCurrentIndex(idx);
                  }}
                  className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center cursor-pointer transition-all ${
                    isCurr
                      ? 'bg-amber-300 text-slate-900 ring-2 ring-white scale-110 shadow-md'
                      : isAns
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/20 text-white/80 hover:bg-white/30'
                  }`}
                  title={`Câu ${idx + 1}: ${isAns ? 'Đã làm' : 'Chưa làm'}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question Statement Box */}
        <div className="my-3 bg-white/10 backdrop-blur-xs border border-white/30 rounded-2xl p-5 text-white shadow-lg text-center">
          <div className="text-xs font-bold text-pink-100 uppercase tracking-wider mb-1 flex items-center justify-center gap-2">
            <span className="bg-white/20 px-2 py-0.5 rounded-md font-mono text-[10px]">
              {currentQ.partType === 'part2_true_false'
                ? 'PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI'
                : currentQ.partType === 'part3_short_answer'
                ? 'PHẦN III: TRẢ LỜI NGẮN (4 KÝ TỰ)'
                : 'PHẦN I: TRẮC NGHIỆM 4 PHƯƠNG ÁN'}
            </span>
            <span>Câu {currentIndex + 1} / {questions.length}</span>
            {isCurrentAnswered && (
              <span className="bg-emerald-400 text-emerald-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                ✓ Đã hoàn thành
              </span>
            )}
          </div>
          <h2
            className="font-bold text-slate-50 leading-relaxed"
            style={{ fontSize: `${18 + fontSizeOffset}px` }}
          >
            {currentQ.content}
          </h2>
        </div>

        {/* 1. PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI (a, b, c, d) */}
        {currentQ.partType === 'part2_true_false' && currentQ.subItems && (
          <div className="space-y-2.5 my-2 flex-1">
            {currentQ.subItems.map((si) => {
              const selectedValue = userAnswers[currentQ.id]?.[si.key];
              return (
                <div
                  key={si.key}
                  className="bg-white/15 backdrop-blur-xs border border-white/25 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md"
                >
                  <div className="flex-1 text-left">
                    <span className="font-black text-amber-300 text-sm mr-2">{si.key})</span>
                    <span
                      className="font-semibold text-white leading-relaxed"
                      style={{ fontSize: `${14 + fontSizeOffset}px` }}
                    >
                      {si.content}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleToggleSubItem(si.key, true)}
                      className={`px-4 py-2 rounded-xl font-black text-xs cursor-pointer transition-all ${
                        selectedValue === true
                          ? 'btn-3d btn-3d-emerald ring-2 ring-white scale-105 shadow-lg'
                          : 'bg-white/20 hover:bg-white/30 text-white'
                      }`}
                    >
                      ✓ ĐÚNG
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSubItem(si.key, false)}
                      className={`px-4 py-2 rounded-xl font-black text-xs cursor-pointer transition-all ${
                        selectedValue === false
                          ? 'btn-3d btn-3d-pink ring-2 ring-white scale-105 shadow-lg'
                          : 'bg-white/20 hover:bg-white/30 text-white'
                      }`}
                    >
                      ✕ SAI
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. PHẦN III: TRẢ LỜI NGẮN (4 KÝ TỰ SỐ - MẶC ĐỊNH A.1234) */}
        {currentQ.partType === 'part3_short_answer' && (
          <div className="bg-white/15 backdrop-blur-xs border border-white/25 rounded-2xl p-5 text-center max-w-lg mx-auto w-full space-y-4 my-2 shadow-xl flex-1 flex flex-col justify-center">
            <div className="text-xs text-pink-200 font-bold uppercase tracking-wider">
              Nhập 4 ký tự số vào ô bên dưới (Mặc định Thông tư 7991: A.1234):
            </div>
            <div className="flex justify-center items-center gap-2">
              <input
                type="text"
                maxLength={4}
                value={userAnswers[currentQ.id] || ''}
                onChange={(e) => handleShortAnswerChange(e.target.value)}
                placeholder="1234"
                className="w-48 text-center text-3xl font-black font-mono tracking-widest bg-white text-slate-900 border-4 border-amber-300 rounded-2xl py-2.5 px-4 shadow-inner focus:outline-none focus:ring-4 focus:ring-pink-300"
              />
            </div>
            {/* On-screen tactile touch keypad */}
            <div className="grid grid-cols-5 gap-2 max-w-xs mx-auto pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => {
                    const cur = userAnswers[currentQ.id] || '';
                    if (cur.length < 4) {
                      handleShortAnswerChange(cur + digit);
                    }
                  }}
                  className="btn-3d btn-3d-slate py-2 text-sm font-black rounded-xl text-white cursor-pointer"
                >
                  {digit}
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  const cur = userAnswers[currentQ.id] || '';
                  handleShortAnswerChange(cur.slice(0, -1));
                }}
                className="btn-3d btn-3d-slate px-3 py-1.5 rounded-xl text-white cursor-pointer"
              >
                Xóa 1 số
              </button>
              <button
                type="button"
                onClick={() => handleShortAnswerChange('1234')}
                className="btn-3d btn-3d-teal px-3 py-1.5 rounded-xl font-bold text-white cursor-pointer"
              >
                Đặt mặc định 1234
              </button>
              <button
                type="button"
                onClick={() => handleShortAnswerChange('')}
                className="btn-3d btn-3d-pink px-3 py-1.5 rounded-xl text-white cursor-pointer"
              >
                Xóa trắng
              </button>
            </div>
          </div>
        )}

        {/* 3. PHẦN I: TRẮC NGHIỆM 4 PHƯƠNG ÁN LỰA CHỌN (A, B, C, D) */}
        {(!currentQ.partType || currentQ.partType === 'part1_choice') && currentQ.options && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-2 flex-1 items-stretch">
            {currentQ.options.map((opt) => {
              const isSelected = userAnswers[currentQ.id] === opt.key;
              let colorClass = 'btn-3d-blue';
              if (opt.key === 'B') colorClass = 'btn-3d-emerald';
              if (opt.key === 'C') colorClass = 'btn-3d-orange';
              if (opt.key === 'D') colorClass = 'btn-3d-purple';

              return (
                <button
                  key={opt.key}
                  onClick={() => handleSelectOption(opt.key)}
                  className={`btn-3d ${colorClass} p-5 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer min-h-[135px] relative transition-all ${
                    isSelected ? 'ring-4 ring-white scale-102 shadow-2xl brightness-115' : 'opacity-95'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center font-black text-lg mb-2 shadow-inner">
                    {opt.key}
                  </div>
                  <span
                    className="font-extrabold text-white leading-snug drop-shadow-xs"
                    style={{ fontSize: `${14 + fontSizeOffset}px` }}
                  >
                    {opt.text}
                  </span>

                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-white text-emerald-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md">
                      ✓
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Bottom Action Bar: Navigation + Strict AI Lock + Submit Button */}
        <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-pink-400/40 mt-2">
          {/* Left: Previous & Next question controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (currentIndex > 0) {
                  soundEffects.playClick();
                  setCurrentIndex((i) => i - 1);
                }
              }}
              disabled={currentIndex === 0}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 ${
                currentIndex === 0 ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'btn-3d btn-3d-slate text-white cursor-pointer'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Câu trước</span>
            </button>

            <button
              onClick={() => {
                if (currentIndex < questions.length - 1) {
                  soundEffects.playClick();
                  setCurrentIndex((i) => i + 1);
                }
              }}
              disabled={isLastQuestion}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 ${
                isLastQuestion ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'btn-3d btn-3d-slate text-white cursor-pointer'
              }`}
            >
              <span>Câu tiếp</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Center: Streak Fire Counter */}
          <div className="hidden sm:flex items-center gap-1.5 bg-black/20 px-3.5 py-1.5 rounded-full text-white font-bold text-xs">
            <Flame className={`w-4 h-4 ${streak > 0 ? 'text-amber-400 fill-amber-400 animate-bounce' : 'text-slate-300'}`} />
            <span>Chuỗi đúng: {streak}</span>
          </div>

          {/* Right: AI Lock Indicator (STRICT REQUIREMENT) + Big Nộp Bài Button */}
          <div className="flex items-center gap-2">
            {/* AI Tutor is STRICTLY LOCKED during live testing */}
            <div
              className="px-3 py-2 bg-slate-900/60 border border-amber-400/50 rounded-xl text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-not-allowed shadow-inner"
              title="Gia sư AI bị khóa trong thời gian làm bài để chống gian lận. Sau khi nộp bài sẽ mở phân tích chi tiết!"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Khóa AI giải thích (Khi thi)</span>
            </div>

            {/* Submit Button */}
            <button
              onClick={() => {
                soundEffects.playClick();
                setShowSubmitConfirmModal(true);
              }}
              className="btn-3d btn-3d-teal px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xl"
            >
              <FileCheck className="w-4 h-4" />
              <span>Nộp bài thi</span>
            </button>
          </div>
        </div>

        {/* MODAL 1: TAB-SWITCH PROCTORING WARNING MODAL */}
        {showViolationModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-rose-950 border-4 border-rose-500 rounded-3xl max-w-lg w-full text-white shadow-2xl p-6 sm:p-8 space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 border-2 border-rose-500 flex items-center justify-center mx-auto animate-pulse">
                <AlertTriangle className="w-9 h-9 stroke-[2.5]" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-xl font-black text-rose-300 uppercase tracking-wide">
                  ⚠️ Cảnh Báo Vi Phạm Quy Chế Thi
                </h3>
                <p className="text-xs text-rose-200 font-medium">
                  {lastViolationMsg}
                </p>
              </div>

              <div className="bg-black/50 p-4 rounded-2xl border border-rose-400/30 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-sm">
                  <span>Số lần vi phạm:</span>
                  <span className="font-mono text-amber-400 font-black text-base">
                    {tabSwitchCount} / {resolvedMaxTabSwitches} lần
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Hệ thống giám sát trực tuyến đã ghi nhận thời gian và hành vi rời màn hình thi vào biên bản.
                  Nếu vi phạm vượt quá <span className="text-amber-300 font-bold">{resolvedMaxTabSwitches} lần</span>, bài thi của bạn sẽ tự động bị đình chỉ và thu hồi ngay!
                </p>
              </div>

              <button
                onClick={() => {
                  soundEffects.playClick();
                  setShowViolationModal(false);
                }}
                className="btn-3d btn-3d-pink w-full py-3 text-xs rounded-xl font-black uppercase tracking-wider cursor-pointer"
              >
                Tôi cam kết quay lại làm bài trung thực
              </button>
            </div>
          </div>
        )}

        {/* MODAL 2: CONFIRM SUBMIT MODAL */}
        {showSubmitConfirmModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full text-slate-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mx-auto mb-2">
                  <FileCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900">Xác nhận nộp bài thi</h3>
                <p className="text-xs text-slate-500">Kiểm tra lại bài làm trước khi nộp vào hệ thống</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-600">Tổng số câu hỏi:</span>
                  <span className="font-bold text-slate-900">{questions.length} câu</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-emerald-700">Đã trả lời:</span>
                  <span className="font-bold text-emerald-700 font-mono">{answeredCount} câu</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-amber-700">Chưa trả lời:</span>
                  <span className="font-bold text-amber-700 font-mono">
                    {questions.length - answeredCount} câu
                  </span>
                </div>
                <div className="flex justify-between font-semibold border-t border-slate-200 pt-2">
                  <span className="text-slate-600">Vi phạm chuyển tab:</span>
                  <span className={`font-bold font-mono ${tabSwitchCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {tabSwitchCount} lần
                  </span>
                </div>
              </div>

              {questions.length - answeredCount > 0 && (
                <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  ⚠️ Chú ý: Bạn vẫn còn <span className="font-bold">{questions.length - answeredCount} câu</span> chưa chọn đáp án. Bạn có muốn nộp ngay không?
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowSubmitConfirmModal(false)}
                  className="btn-3d btn-3d-slate flex-1 py-2.5 text-xs rounded-xl font-bold cursor-pointer"
                >
                  Làm tiếp
                </button>
                <button
                  onClick={() => finishAndAutoSubmit(userAnswers, false)}
                  className="btn-3d btn-3d-teal flex-1 py-2.5 text-xs rounded-xl font-black cursor-pointer shadow-md"
                >
                  Xác nhận Nộp bài ➔
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* =========================================================================
     4. RESULT & POST-EXAM REVIEW SCREEN (Điểm, Đúng/Sai, Mở AI Gia sư)
     ========================================================================= */
  if (step === 'result' && finalSubmission) {
    const wrongCount = finalSubmission.wrongAnswersCount ?? 0;
    const unansweredCount = finalSubmission.unansweredCount ?? 0;
    const correctCount = finalSubmission.correctAnswersCount;
    const score = finalSubmission.score;

    // Academic grade rating
    let gradeLabel = 'TRUNG BÌNH';
    let gradeColor = 'text-amber-400 bg-amber-500/20 border-amber-400';
    if (score >= 9.0) {
      gradeLabel = 'XUẤT SẮC ✦';
      gradeColor = 'text-emerald-300 bg-emerald-500/20 border-emerald-400';
    } else if (score >= 8.0) {
      gradeLabel = 'GIỎI ★';
      gradeColor = 'text-teal-300 bg-teal-500/20 border-teal-400';
    } else if (score >= 6.5) {
      gradeLabel = 'KHÁ';
      gradeColor = 'text-blue-300 bg-blue-500/20 border-blue-400';
    }

    return (
      <div className="min-h-[84vh] bg-gradient-to-b from-[#251838] via-[#1a1226] to-[#0f0917] rounded-3xl p-4 sm:p-8 text-white relative shadow-2xl flex flex-col justify-center items-center">
        <div className="w-full max-w-3xl bg-[#34234b]/95 border-2 border-emerald-400/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-6">
          {/* Header Trophy & Student Name */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400 flex items-center justify-center shadow-lg animate-bounce mb-3">
              <Award className="w-9 h-9 stroke-[2.5]" />
            </div>

            <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${gradeColor} mb-1.5`}>
              {gradeLabel}
            </span>

            <h2 className="text-2xl sm:text-3xl font-black text-white">{studentName}</h2>
            <p className="text-xs text-pink-200/80">{studentInfo} • Bài thi: {resolvedTitle}</p>
          </div>

          {/* Core Scorecard Grid (Điểm số, Đúng, Sai, Thời gian, Vi phạm) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {/* Score */}
            <div className="bg-[#1f142e] border-2 border-emerald-400/40 rounded-2xl p-3 flex flex-col items-center justify-center col-span-2 sm:col-span-1">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Điểm số</span>
              <span className="text-3xl font-black text-emerald-400 font-mono mt-0.5">
                {score} <span className="text-xs text-slate-400 font-normal">/ 10</span>
              </span>
            </div>

            {/* Đúng */}
            <div className="bg-[#1f142e] border border-emerald-500/30 rounded-2xl p-3 flex flex-col items-center justify-center">
              <span className="text-[11px] text-emerald-300 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Số câu đúng
              </span>
              <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                {correctCount} <span className="text-xs text-slate-400 font-normal">/ {questions.length}</span>
              </span>
            </div>

            {/* Sai */}
            <div className="bg-[#1f142e] border border-rose-500/30 rounded-2xl p-3 flex flex-col items-center justify-center">
              <span className="text-[11px] text-rose-300 font-bold flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Số câu sai
              </span>
              <span className="text-2xl font-black text-rose-400 font-mono mt-0.5">
                {wrongCount}
              </span>
            </div>

            {/* Thời gian */}
            <div className="bg-[#1f142e] border border-amber-500/30 rounded-2xl p-3 flex flex-col items-center justify-center">
              <span className="text-[11px] text-amber-300 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Thời gian làm
              </span>
              <span className="text-lg font-black text-amber-300 font-mono mt-0.5">
                {Math.floor(finalSubmission.durationSeconds / 60)}m {finalSubmission.durationSeconds % 60}s
              </span>
            </div>

            {/* Vi phạm chuyển tab */}
            <div className="bg-[#1f142e] border border-slate-700 rounded-2xl p-3 flex flex-col items-center justify-center col-span-2 sm:col-span-1">
              <span className="text-[11px] text-slate-400 font-bold">Biên bản vi phạm</span>
              <span className={`text-base font-black font-mono mt-0.5 ${finalSubmission.tabSwitchCount && finalSubmission.tabSwitchCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {finalSubmission.tabSwitchCount ? `${finalSubmission.tabSwitchCount} lần tab` : '0 vi phạm ✓'}
              </span>
            </div>
          </div>

          {/* Real-time Server Sync Confirmation */}
          <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-2xl text-left text-xs space-y-1 text-emerald-200">
            <div className="font-bold flex items-center gap-1.5 text-emerald-400">
              <Send className="w-4 h-4" />
              <span>Đã tự động gửi kết quả về máy chủ Bảng Giám Sát Giáo Viên!</span>
            </div>
            <p className="text-[11px] text-emerald-300/80 leading-relaxed">
              Điểm số và phân tích bài làm của {studentName} đã được cập nhật trực tiếp lên hệ thống quản lý của Thầy Hồ Tấn Khải qua mạng thời gian thực (Zero drop).
            </p>
          </div>

          {/* Action Row: Review Detailed Answers or Retake Exam */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                soundEffects.playClick();
                setShowCompletionSummaryModal(true);
              }}
              className="btn-3d btn-3d-amber px-5 py-3 text-xs rounded-xl font-black flex items-center gap-2 cursor-pointer shadow-lg text-amber-950"
            >
              <Award className="w-4 h-4 text-amber-900" />
              <span>📊 Bảng Tổng Kết Tức Thì</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                setShowReviewMode(!showReviewMode);
              }}
              className="btn-3d btn-3d-blue px-5 py-3 text-xs rounded-xl font-black flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <Eye className="w-4 h-4" />
              <span>{showReviewMode ? 'Ẩn xem lại chi tiết' : '🔍 Xem Lại Chi Tiết Bài Làm & Mở AI Gia Sư'}</span>
            </button>

            <button
              onClick={handleRetakeExam}
              disabled={hasExceededAttempts}
              className={`btn-3d px-5 py-3 text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer ${
                hasExceededAttempts ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'btn-3d-slate'
              }`}
              title={hasExceededAttempts ? 'Đã hết số lượt làm bài' : 'Làm lại bài thi'}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Làm lại bài ({completedAttemptsCount}/{resolvedAllowedAttempts === 0 ? '∞' : resolvedAllowedAttempts})</span>
            </button>

            {!isDirectStudentMode ? (
              <button
                onClick={() => {
                  soundEffects.playClick();
                  onExit();
                }}
                className="btn-3d btn-3d-teal px-5 py-3 text-xs rounded-xl font-bold cursor-pointer"
              >
                Về Trang Quản Trị
              </button>
            ) : (
              <button
                onClick={() => {
                  soundEffects.playClick();
                  alert('Điểm số và bài làm của bạn đã được ghi nhận vào hệ thống Bảng Giám Sát của Thầy Hồ Tấn Khải. Bạn có thể đóng tab trình duyệt này!');
                }}
                className="btn-3d btn-3d-emerald px-5 py-3 text-xs rounded-xl font-bold cursor-pointer text-white shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>✓ Đã nộp bài & Đóng</span>
              </button>
            )}
          </div>

          {/* REVIEW MODE: Detailed Question Breakdown with UNLOCKED AI TUTOR */}
          {showReviewMode && (
            <div className="mt-6 pt-6 border-t border-slate-700/80 text-left space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-teal-400" />
                    <span>Chi Tiết Từng Câu Hỏi & Hướng Dẫn Giải</span>
                  </h3>
                  <p className="text-[11px] text-pink-200/70">
                    Bấm &quot;Gia sư AI giải thích&quot; ở từng câu để Gemini 3.8 Flash phân tích sâu kiến thức cho bạn!
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                  <span className="text-emerald-300 font-bold">Đáp án đúng</span>
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block ml-2"></span>
                  <span className="text-rose-300 font-bold">Bạn chọn sai</span>
                </div>
              </div>

              {/* Questions Loop */}
              <div className="space-y-4">
                {questions.map((q, idx) => {
                  const studentChoice = finalSubmission.answers[q.id];
                  let isFullyCorrect = false;
                  let resultLabel = '';

                  if (q.partType === 'part2_true_false') {
                    let subCorrect = 0;
                    q.subItems?.forEach(si => {
                      if (studentChoice && studentChoice[si.key] === si.isCorrect) {
                        subCorrect++;
                      }
                    });
                    isFullyCorrect = subCorrect === 4;
                    resultLabel = `Đúng ${subCorrect}/4 ý (${
                      subCorrect === 4 ? '1.0 đ' : subCorrect === 3 ? '0.5 đ' : subCorrect === 2 ? '0.25 đ' : subCorrect === 1 ? '0.1 đ' : '0.0 đ'
                    })`;
                  } else if (q.partType === 'part3_short_answer') {
                    const expected = (q.shortAnswerCorrect || q.correctAnswer || '1234').toString().trim().toLowerCase();
                    const entered = (studentChoice || '').toString().trim().toLowerCase();
                    isFullyCorrect = entered === expected;
                    resultLabel = isFullyCorrect ? 'Đúng (+0.25 đ)' : 'Sai (0.0 đ)';
                  } else {
                    isFullyCorrect = studentChoice === q.correctAnswer;
                    resultLabel = isFullyCorrect ? 'Đúng (+0.25 đ)' : (!studentChoice ? 'Chưa trả lời (0.0 đ)' : 'Sai (0.0 đ)');
                  }

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-2xl border ${
                        isFullyCorrect
                          ? 'bg-emerald-950/40 border-emerald-500/40'
                          : 'bg-rose-950/40 border-rose-500/40'
                      } space-y-3`}
                    >
                      {/* Question Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-lg bg-white/10 text-white">
                              Câu {idx + 1}
                            </span>
                            <span className="text-[10px] font-mono font-bold bg-white/15 px-2 py-0.5 rounded-md text-amber-300">
                              {q.partType === 'part2_true_false'
                                ? 'Phần II (Đúng/Sai)'
                                : q.partType === 'part3_short_answer'
                                ? 'Phần III (4 số)'
                                : 'Phần I (Nhiều lựa chọn)'}
                            </span>
                            <span
                              className={`text-[11px] font-bold flex items-center gap-1 ${
                                isFullyCorrect ? 'text-emerald-300' : 'text-rose-300'
                              }`}
                            >
                              {isFullyCorrect ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                              <span>{resultLabel}</span>
                            </span>
                          </div>
                          <p className="font-bold text-sm text-slate-100">{q.content}</p>
                        </div>

                        {/* POST-EXAM ONLY AI TUTOR BUTTON */}
                        <button
                          onClick={() => handleAskAITutorPostExam(q)}
                          disabled={isAiExplaining && aiExplainedQuestionId === q.id}
                          className="btn-3d btn-3d-amber px-3 py-1.5 text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-amber-950 shrink-0 shadow-md"
                          title="Hỏi AI Gemini 3.8 Flash giải thích câu này"
                        >
                          <Bot className="w-3.5 h-3.5 text-amber-900" />
                          <span>
                            {isAiExplaining && aiExplainedQuestionId === q.id ? 'AI đang viết...' : 'AI Gemini giải thích'}
                          </span>
                        </button>
                      </div>

                      {/* Part 1: Options Grid */}
                      {(!q.partType || q.partType === 'part1_choice') && q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {q.options.map((opt) => {
                            const isChosen = studentChoice === opt.key;
                            const isRightAnswer = q.correctAnswer === opt.key;

                            let badgeStyle = 'bg-black/30 border-slate-700 text-slate-300';
                            if (isRightAnswer) {
                              badgeStyle = 'bg-emerald-900/80 border-emerald-400 text-emerald-100 font-bold';
                            } else if (isChosen && !isRightAnswer) {
                              badgeStyle = 'bg-rose-900/80 border-rose-400 text-rose-100 font-bold';
                            }

                            return (
                              <div
                                key={opt.key}
                                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${badgeStyle}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs shrink-0">
                                    {opt.key}
                                  </span>
                                  <span>{opt.text}</span>
                                </div>
                                {isRightAnswer && (
                                  <span className="text-[10px] bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded-md font-black shrink-0">
                                    ✓ Đáp án đúng
                                  </span>
                                )}
                                {isChosen && !isRightAnswer && (
                                  <span className="text-[10px] bg-rose-400 text-rose-950 px-2 py-0.5 rounded-md font-black shrink-0">
                                    ✗ Bạn chọn
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Part 2: Sub-items Review */}
                      {q.partType === 'part2_true_false' && q.subItems && (
                        <div className="space-y-2 text-xs">
                          {q.subItems.map((si) => {
                            const studentSubVal = studentChoice?.[si.key];
                            const isSubCorrect = studentSubVal === si.isCorrect;

                            return (
                              <div
                                key={si.key}
                                className={`p-2.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                                  isSubCorrect
                                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-100'
                                    : 'bg-rose-950/60 border-rose-500/50 text-rose-100'
                                }`}
                              >
                                <div className="flex-1">
                                  <span className="font-bold text-amber-300 mr-2">{si.key})</span>
                                  <span>{si.content}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] bg-black/40 px-2 py-1 rounded-md text-slate-300 font-bold">
                                    Bạn chọn: {studentSubVal === true ? 'ĐÚNG' : studentSubVal === false ? 'SAI' : 'Chưa chọn'}
                                  </span>
                                  <span className="text-[10px] bg-emerald-400 text-emerald-950 px-2 py-1 rounded-md font-black">
                                    Đáp án chuẩn: {si.isCorrect ? 'ĐÚNG (Gạch chân)' : 'SAI'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Part 3: Short Answer Review */}
                      {q.partType === 'part3_short_answer' && (
                        <div className="p-3 bg-black/40 rounded-xl border border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="text-slate-300">Bạn đã nhập: </span>
                            <span className={`font-mono text-base font-black px-2 py-0.5 rounded ${
                              isFullyCorrect ? 'bg-emerald-500/30 text-emerald-300' : 'bg-rose-500/30 text-rose-300'
                            }`}>
                              {studentChoice || '(Để trống)'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-300">Đáp án 4 ký tự chuẩn:</span>
                            <span className="font-mono text-base font-black bg-emerald-400 text-emerald-950 px-2.5 py-0.5 rounded-lg shadow-sm">
                              {q.shortAnswerCorrect || q.correctAnswer || '1234'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Static explanation if available */}
                      {q.explanation && (
                        <div className="p-2.5 bg-black/40 rounded-xl text-[11px] text-slate-300 border border-white/10">
                          <span className="font-bold text-teal-300">Lời giải chi tiết:</span> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Post-Submission Instant Summary Modal */}
        {showCompletionSummaryModal && finalSubmission && (() => {
          const correctQuestions = questions.filter(
            (q) => finalSubmission.answers[q.id] === q.correctAnswer
          );
          const wrongQuestions = questions.filter(
            (q) => finalSubmission.answers[q.id] && finalSubmission.answers[q.id] !== q.correctAnswer
          );
          const unansweredQuestions = questions.filter(
            (q) => !finalSubmission.answers[q.id]
          );

          return (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-[#1c1228] border-2 border-indigo-500/60 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden my-auto animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 px-6 py-5 flex items-center justify-between border-b border-indigo-400/30 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-amber-300 shadow-inner">
                      <Award className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg sm:text-xl font-black text-white">
                          Tổng Kết Kết Quả Bài Làm
                        </h3>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                          Đã Nộp Bài
                        </span>
                      </div>
                      <p className="text-xs text-emerald-100/90 font-medium">
                        Học sinh: <strong className="text-white">{studentName}</strong> ({studentInfo}) • Đề thi: {resolvedTitle}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setShowCompletionSummaryModal(false);
                    }}
                    className="w-9 h-9 rounded-xl bg-black/20 hover:bg-black/40 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-base font-bold"
                    title="Đóng bảng tổng kết"
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Scrollable Body */}
                <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-slate-100">
                  {/* Score & Key Metrics Banner */}
                  <div className="bg-[#2a1b3d] border border-indigo-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-lg">
                    {/* Big Score Block */}
                    <div className="flex items-center gap-4 text-center sm:text-left">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-1 flex flex-col items-center justify-center shadow-lg border border-emerald-300/40 shrink-0">
                        <span className="text-[10px] font-black uppercase text-emerald-100 tracking-wider">Tổng Điểm</span>
                        <span className="text-3xl font-black text-white font-mono leading-none my-0.5">
                          {score}
                        </span>
                        <span className="text-[9px] text-emerald-200">thang 10</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full border ${gradeColor}`}>
                            {gradeLabel}
                          </span>
                          <span className="text-xs text-indigo-200 font-bold">
                            Tỉ lệ đúng: {Math.round((correctCount / questions.length) * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">
                          Thời gian làm bài: <strong className="text-amber-300">{Math.floor(finalSubmission.durationSeconds / 60)} phút {finalSubmission.durationSeconds % 60} giây</strong>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {finalSubmission.tabSwitchCount && finalSubmission.tabSwitchCount > 0
                            ? `Cảnh báo: Phát hiện ${finalSubmission.tabSwitchCount} lần đổi tab`
                            : 'Đảm bảo nghiêm túc: 0 vi phạm tab'}
                        </p>
                      </div>
                    </div>

                    {/* Quick Metric Chips */}
                    <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                      <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-3 py-2 text-center min-w-[90px]">
                        <span className="text-[10px] font-bold text-emerald-300 block">Số câu đúng</span>
                        <span className="text-xl font-black text-emerald-400 font-mono">
                          {correctCount}
                        </span>
                        <span className="text-[9px] text-emerald-300/70 block">/ {questions.length}</span>
                      </div>

                      <div className="bg-rose-950/60 border border-rose-500/40 rounded-xl px-3 py-2 text-center min-w-[90px]">
                        <span className="text-[10px] font-bold text-rose-300 block">Số câu sai</span>
                        <span className="text-xl font-black text-rose-400 font-mono">
                          {wrongCount}
                        </span>
                        <span className="text-[9px] text-rose-300/70 block">câu</span>
                      </div>

                      <div className="bg-amber-950/60 border border-amber-500/40 rounded-xl px-3 py-2 text-center min-w-[90px]">
                        <span className="text-[10px] font-bold text-amber-300 block">Chưa làm</span>
                        <span className="text-xl font-black text-amber-400 font-mono">
                          {unansweredCount}
                        </span>
                        <span className="text-[9px] text-amber-300/70 block">câu</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Correctly Answered Questions */}
                  <div className="bg-[#241734] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Danh Sách Câu Đã Làm Đúng ({correctCount}/{questions.length})</span>
                      </h4>
                      <span className="text-[11px] text-emerald-400/80 font-semibold">
                        +{ (correctCount * (10 / questions.length)).toFixed(1) } điểm
                      </span>
                    </div>

                    {correctQuestions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Bạn chưa làm đúng câu nào trong lượt thi này.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {questions.map((q, idx) => {
                          const isCorrect = finalSubmission.answers[q.id] === q.correctAnswer;
                          if (!isCorrect) return null;
                          return (
                            <div
                              key={q.id}
                              className="px-3 py-1.5 rounded-xl bg-emerald-900/60 border border-emerald-400/50 flex items-center gap-1.5 text-xs text-emerald-100 font-bold shadow-xs hover:bg-emerald-900 transition-colors"
                              title={`Câu ${idx + 1}: ${q.content}`}
                            >
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                              <span>Câu {idx + 1}</span>
                              <span className="text-[10px] bg-emerald-400 text-emerald-950 px-1 rounded font-black">
                                {q.correctAnswer}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Detailed Breakdown of Wrong Answers */}
                  <div className="bg-[#241734] border border-rose-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-rose-300 flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span>Phân Tích Chi Tiết Các Câu Làm Sai ({wrongQuestions.length} câu)</span>
                      </h4>
                      <span className="text-[11px] text-rose-400/80 font-semibold">
                        Xem kỹ đáp án và ôn lại ngay
                      </span>
                    </div>

                    {wrongQuestions.length === 0 ? (
                      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-1">
                        <p className="text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          Xuất sắc! Bạn không có bất kỳ câu trả lời sai nào!
                        </p>
                        <p className="text-[11px] text-emerald-200/70">
                          Tất cả các câu đã trả lời đều chính xác. Hãy tiếp tục phát huy!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {wrongQuestions.map((q) => {
                          const originalIdx = questions.findIndex((item) => item.id === q.id);
                          const studentAnswerKey = finalSubmission.answers[q.id];
                          const studentChoiceObj = q.options?.find((opt) => opt.key === studentAnswerKey);
                          const correctChoiceObj = q.options?.find((opt) => opt.key === q.correctAnswer);

                          return (
                            <div
                              key={q.id}
                              className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 space-y-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-lg bg-white/10 text-rose-200 border border-rose-400/30">
                                      Câu {originalIdx + 1}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-amber-300">
                                      {q.partType === 'part2_true_false' ? 'Phần II' : q.partType === 'part3_short_answer' ? 'Phần III' : 'Phần I'}
                                    </span>
                                    <span className="text-[11px] font-bold text-rose-400">
                                      Chưa hoàn thiện đúng
                                    </span>
                                  </div>
                                  <p className="font-bold text-sm text-slate-100">{q.content}</p>
                                </div>

                                <button
                                  onClick={() => handleAskAITutorPostExam(q)}
                                  disabled={isAiExplaining && aiExplainedQuestionId === q.id}
                                  className="btn-3d btn-3d-amber px-3 py-1.5 text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-amber-950 shrink-0 shadow-md"
                                  title="Nhận giải thích từ AI Gemini 3.8 Flash"
                                >
                                  <Bot className="w-3.5 h-3.5 text-amber-900" />
                                  <span>
                                    {isAiExplaining && aiExplainedQuestionId === q.id ? 'AI đang viết...' : 'AI giải thích'}
                                  </span>
                                </button>
                              </div>

                              {/* Student vs Correct comparison */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 rounded-xl bg-rose-900/60 border border-rose-400/50 flex items-start gap-2">
                                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                    ✕
                                  </span>
                                  <div>
                                    <span className="text-[10px] font-black uppercase text-rose-300 block">
                                      Bạn đã chọn:
                                    </span>
                                    <span className="font-bold text-rose-100">
                                      {typeof studentAnswerKey === 'object'
                                        ? JSON.stringify(studentAnswerKey)
                                        : studentAnswerKey
                                        ? `${studentAnswerKey}. ${studentChoiceObj?.text || ''}`
                                        : 'Chưa trả lời'}
                                    </span>
                                  </div>
                                </div>

                                <div className="p-2.5 rounded-xl bg-emerald-900/60 border border-emerald-400/50 flex items-start gap-2">
                                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                    ✓
                                  </span>
                                  <div>
                                    <span className="text-[10px] font-black uppercase text-emerald-300 block">
                                      Đáp án chuẩn:
                                    </span>
                                    <span className="font-bold text-emerald-100">
                                      {q.partType === 'part2_true_false'
                                        ? (q.correctAnswer || 'Xem chi tiết từng ý')
                                        : q.partType === 'part3_short_answer'
                                        ? `Đáp án 4 số: ${q.shortAnswerCorrect || q.correctAnswer || '1234'}`
                                        : `${q.correctAnswer}. ${correctChoiceObj?.text || ''}`}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Quick Explanation */}
                              {q.explanation && (
                                <div className="p-2.5 bg-black/40 rounded-xl text-[11px] text-slate-300 border border-white/10">
                                  <span className="font-bold text-teal-300">Lời giải chi tiết:</span> {q.explanation}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Section 3: Unanswered Questions (if any) */}
                  {unansweredQuestions.length > 0 && (
                    <div className="bg-[#241734] border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
                      <h4 className="text-sm font-black text-amber-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Các Câu Bị Bỏ Qua / Chưa Trả Lời ({unansweredQuestions.length} câu)</span>
                      </h4>
                      <div className="space-y-3">
                        {unansweredQuestions.map((q) => {
                          const originalIdx = questions.findIndex((item) => item.id === q.id);
                          const correctChoiceObj = q.options?.find((opt) => opt.key === q.correctAnswer);
                          return (
                            <div
                              key={q.id}
                              className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-amber-200">
                                  Câu {originalIdx + 1}: {q.content}
                                </span>
                                <span className="text-[10px] bg-amber-400 text-amber-950 px-2 py-0.5 rounded font-bold">
                                  Chưa chọn đáp án
                                </span>
                              </div>
                              <div className="p-2 bg-emerald-950/60 rounded-lg text-emerald-200 border border-emerald-500/30">
                                <strong>Đáp án đúng:</strong> {q.partType === 'part2_true_false' ? (q.correctAnswer || 'Xem chi tiết') : q.partType === 'part3_short_answer' ? (q.shortAnswerCorrect || '1234') : `${q.correctAnswer}. ${correctChoiceObj?.text || ''}`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Action Buttons Footer */}
                <div className="bg-[#170e22] px-6 py-4 border-t border-indigo-500/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="text-xs text-slate-400">
                    Lượt làm: <strong className="text-white">{completedAttemptsCount}</strong> / {resolvedAllowedAttempts === 0 ? 'Không giới hạn' : resolvedAllowedAttempts}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => {
                        soundEffects.playClick();
                        setShowCompletionSummaryModal(false);
                        setShowReviewMode(true);
                      }}
                      className="btn-3d btn-3d-blue px-4 py-2.5 text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Xem Lại Toàn Bộ Đề & Lời Giải</span>
                    </button>

                    <button
                      onClick={() => {
                        soundEffects.playClick();
                        setShowCompletionSummaryModal(false);
                      }}
                      className="btn-3d btn-3d-teal px-4 py-2.5 text-xs rounded-xl font-bold cursor-pointer"
                    >
                      Đóng Bảng Tổng Kết
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* AI Tutor Explanation Modal (Post-Exam) */}
        {aiExplanationText && (
          <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full text-slate-800 shadow-2xl border border-slate-100 overflow-hidden p-6 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-teal-800 font-extrabold text-sm">
                  <Bot className="w-5 h-5 text-teal-600" />
                  <span>Gia Sư AI Gemini 3.8 Flash • Phân Tích Chuyên Sâu</span>
                </div>
                <button
                  onClick={() => setAiExplanationText(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-slate-700 leading-relaxed max-h-72 overflow-y-auto whitespace-pre-line p-3.5 bg-teal-50/60 rounded-xl border border-teal-100">
                {aiExplanationText}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setAiExplanationText(null)}
                  className="btn-3d btn-3d-teal px-5 py-2 text-xs rounded-xl font-bold cursor-pointer"
                >
                  Đã hiểu kiến thức! Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};
