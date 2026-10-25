import React, { useState, useEffect, useRef, useMemo } from 'react';
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

// Helper to determine if a question is 100% fully answered per BGDĐT requirements
export const isQuestionFullyAnswered = (q: Question, ans: any): boolean => {
  if (ans === undefined || ans === null) return false;
  if (q.partType === 'part2_true_false') {
    if (typeof ans !== 'object') return false;
    if (q.subItems && q.subItems.length > 0) {
      return q.subItems.every((si) => typeof ans[si.key] === 'boolean');
    }
    return Object.keys(ans).length >= 4;
  }
  if (q.partType === 'part3_short_answer') {
    return typeof ans === 'string' && ans.trim().length > 0;
  }
  // Part 1 choice
  return typeof ans === 'string' && ans.trim().length > 0;
};

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

  // Attempt tracker persistence
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [completedAttemptsCount, setCompletedAttemptsCount] = useState(0);

  // Test state: Strictly teacher-authored questions with randomization (shuffling question order and answer options per attempt/session)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const baseTeacherQuestions = useMemo(() => {
    if (customQuestions && customQuestions.length > 0) {
      return customQuestions;
    }
    return sampleQuestions;
  }, [customQuestions]);

  const questions = useMemo(() => {
    if (!baseTeacherQuestions || baseTeacherQuestions.length === 0) return [];
    const shuffledQ = shuffleArray(baseTeacherQuestions);
    return shuffledQ.map((q) => {
      const cloned: Question = { ...q };
      if ((!cloned.partType || cloned.partType === 'part1_choice') && cloned.options && cloned.options.length > 0) {
        const originalCorrectOpt = cloned.options.find(o => o.key === cloned.correctAnswer || o.isCorrect);
        const originalCorrectText = originalCorrectOpt ? originalCorrectOpt.text : null;

        const shuffledOpts = shuffleArray(cloned.options);
        const keys: OptionKey[] = ['A', 'B', 'C', 'D'];
        let newCorrectKey: OptionKey = 'A';

        cloned.options = shuffledOpts.map((opt, idx) => {
          const assignedKey = keys[idx] || ('A' as OptionKey);
          const isTargetCorrect = originalCorrectText ? opt.text === originalCorrectText : !!opt.isCorrect;
          if (isTargetCorrect) {
            newCorrectKey = assignedKey;
          }
          return {
            ...opt,
            key: assignedKey,
            isCorrect: isTargetCorrect
          };
        });
        cloned.correctAnswer = newCorrectKey;
      } else if (cloned.partType === 'part2_true_false' && cloned.subItems && cloned.subItems.length > 0) {
        cloned.subItems = shuffleArray(cloned.subItems);
      }
      return cloned;
    });
  }, [baseTeacherQuestions, attemptNumber]);
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
  const [showIncompleteNoticeModal, setShowIncompleteNoticeModal] = useState(false);

  // Post-exam Review & AI Tutor state (STRICTLY post-exam only)
  const [showReviewMode, setShowReviewMode] = useState(false);
  const [reviewQuestionIndex, setReviewQuestionIndex] = useState(0);
  const [isAiExplaining, setIsAiExplaining] = useState(false);
  const [aiExplanationText, setAiExplanationText] = useState<string | null>(null);
  const [aiExplainedQuestionId, setAiExplainedQuestionId] = useState<string | null>(null);



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
    const clean = val.replace(/[^0-9a-zA-Z,\.\-]/g, '').slice(0, 4);
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
        const normExpected = expected.replace(/\./g, ',');
        const normStudent = studentAns.replace(/\./g, ',');
        if (!ans) {
          unansweredCount++;
        } else if (normStudent === normExpected) {
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

    // Thông tư 22/BGDĐT: Mọi đề thi dù bất kể bao nhiêu câu đều quy về thang điểm 10.0 (làm tròn 2 chữ số thập phân)
    const rawScore = totalMaxPoints > 0
      ? (earnedPoints / totalMaxPoints) * 10
      : (correctCount / (questions.length || 1)) * 10;
    const calculatedScore = disqualified
      ? 0
      : Math.min(10.0, Math.max(0.0, +(Math.round(rawScore * 100) / 100).toFixed(2)));
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
      <div className="min-h-[84vh] bg-gradient-to-b from-[#0a2e33] via-[#07252a] to-[#04181b] rounded-3xl p-6 sm:p-10 flex items-center justify-center relative overflow-hidden shadow-2xl border border-teal-500/20">
        <div className="absolute top-10 left-12 text-teal-300/10 text-4xl select-none">★</div>
        <div className="absolute bottom-16 right-16 text-emerald-400/15 text-5xl select-none">★</div>

        <div className="w-full max-w-2xl bg-[#0b383f]/95 border-2 border-teal-400/40 rounded-3xl p-6 sm:p-8 text-center text-white shadow-2xl backdrop-blur-md relative z-10 space-y-6">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="bg-white/10 text-teal-200 text-xs font-bold tracking-wider px-3.5 py-1 rounded-full uppercase">
              Hệ Thống Khảo Sát Trực Tuyến
            </span>
            <span className="bg-teal-700/90 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
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
            <p className="text-teal-200/80 text-xs sm:text-sm font-medium">
              Giáo viên giao đề: <span className="font-bold text-teal-300">Thầy Hồ Tấn Khải</span> • Trường THPT Mang Thít
            </p>
          </div>

          {/* Detailed Assignment Specification Grid (Thời gian, Hạn làm, Số lượt) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left">
            {/* Thời gian */}
            <div className="bg-[#06262b]/90 border border-teal-400/20 rounded-2xl p-3 flex flex-col justify-between">
              <span className="text-[11px] text-teal-200/80 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-teal-400" /> Thời gian làm
              </span>
              <span className="text-lg font-black text-white font-mono mt-1">
                {resolvedDurationMinutes}&apos; <span className="text-xs font-normal text-teal-300">(Phút)</span>
              </span>
            </div>

            {/* Số lượt làm bài */}
            <div className="bg-[#06262b]/90 border border-teal-400/20 rounded-2xl p-3 flex flex-col justify-between">
              <span className="text-[11px] text-teal-200/80 font-semibold flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Số lượt thi
              </span>
              <div className="mt-1">
                <span className="text-base font-extrabold text-white">
                  {resolvedAllowedAttempts === 0 ? 'Vô hạn' : `${resolvedAllowedAttempts} lượt`}
                </span>
                <div className="text-[10px] text-teal-300/80">
                  (Đã làm: <span className="font-bold text-amber-300">{completedAttemptsCount}</span>)
                </div>
              </div>
            </div>

            {/* Thời hạn làm bài */}
            <div className="bg-[#06262b]/90 border border-teal-400/20 rounded-2xl p-3 flex flex-col justify-between col-span-2 sm:col-span-1">
              <span className="text-[11px] text-teal-200/80 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Thời hạn nộp
              </span>
              <span className="text-xs font-bold text-emerald-300 leading-tight mt-1">
                {session?.endTime || '23:59 31/12/2026'}
              </span>
            </div>

            {/* Số câu hỏi */}
            <div className="bg-[#06262b]/90 border border-teal-400/20 rounded-2xl p-3 flex flex-col justify-between col-span-2 sm:col-span-1">
              <span className="text-[11px] text-teal-200/80 font-semibold flex items-center gap-1">
                ≡ Số câu hỏi
              </span>
              <span className="text-lg font-black text-white font-mono mt-1">
                {questions.length} <span className="text-xs font-normal text-teal-300">câu (10đ)</span>
              </span>
            </div>
          </div>

          {/* Strict Anti-Cheat & Proctoring Rules Banner */}
          <div className="p-4 bg-[#051f23]/90 border border-amber-400/30 rounded-2xl text-left text-xs space-y-2 text-slate-200">
            <div className="font-black text-amber-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>QUY CHẾ PHÒNG THI & CHỐNG GIAN LẬN (BẮT BUỘC):</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300 list-disc list-inside">
              <li>
                <span className="font-bold text-amber-300">Bắt buộc làm hết 100% câu hỏi mới được nộp bài:</span> Học sinh phải trả lời đầy đủ tất cả {questions.length} câu hỏi mới được nộp bài. Hệ thống sẽ báo vị trí các câu còn sót nếu chưa hoàn thành.
              </li>
              <li>
                <span className="font-bold text-teal-300">Thang điểm 10 theo Thông tư 22/BGDĐT:</span> Mọi đề thi dù bất kể bao nhiêu câu đều được quy về thang điểm 10 chuẩn mực của Bộ Giáo dục và Đào tạo (làm tròn 2 chữ số thập phân).
              </li>
              <li>
                <span className="font-bold text-blue-300">Chế độ mở đáp án đúng (≥ 4.0 điểm):</span> Học sinh làm bài đạt từ <strong className="text-amber-300">4.0 điểm trở lên</strong> mới được mở khóa xem đáp án đúng, lời giải chi tiết và Gia sư AI sau khi nộp.
              </li>
              <li>
                <span className="font-bold text-rose-300">Không được đổi tab màn hình / thu nhỏ cửa sổ:</span> Hệ thống tự động phát hiện và cảnh báo. Vi phạm quá <span className="font-black text-amber-300">{resolvedMaxTabSwitches} lần</span> bài thi sẽ tự động bị đình chỉ và thu hồi ngay!
              </li>
              <li>
                <span className="font-bold text-emerald-300">Tự động trả điểm về máy chủ:</span> Khi bấm Nộp bài hoặc hết giờ, kết quả điểm số sẽ được gửi tức thì về Bảng Giám Sát của Thầy Hồ Tấn Khải.
              </li>
            </ul>
          </div>

          {/* Student Identity Input Card */}
          <div className="bg-[#06262b]/95 border border-teal-400/30 rounded-2xl p-4 text-left space-y-3">
            <div className="text-xs font-bold text-teal-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>👤 Thông tin học sinh làm bài thi:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-200 font-semibold mb-1">Họ và tên học sinh:</label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Nhập họ và tên học sinh..."
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 font-bold rounded-xl border-2 border-teal-400/60 focus:outline-none focus:ring-2 focus:ring-teal-400 shadow-inner"
                />
              </div>
              <div>
                <label className="block text-slate-200 font-semibold mb-1">Lớp / Số báo danh:</label>
                <input
                  type="text"
                  value={studentInfo}
                  onChange={(e) => setStudentInfo(e.target.value)}
                  placeholder="Ví dụ: 12A5 - SBD: 052"
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 font-bold rounded-xl border-2 border-teal-400/60 focus:outline-none focus:ring-2 focus:ring-teal-400 shadow-inner"
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
              className="btn-3d btn-3d-teal w-full py-4 text-base rounded-2xl flex items-center justify-center gap-2 cursor-pointer font-black tracking-wide uppercase shadow-2xl text-white"
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
      <div className="min-h-[84vh] bg-gradient-to-b from-[#0a2e33] via-[#07252a] to-[#04181b] rounded-3xl p-6 sm:p-10 flex items-center justify-center relative border border-teal-500/20">
        <div className="w-full max-w-lg bg-[#0b383f] border-2 border-teal-400/50 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-black text-white">Xác nhận thông tin thí sinh</h2>
            <p className="text-teal-200/80 text-xs mt-1">Thông tin sẽ ghi nhận vào biên bản nộp bài trực tuyến</p>
          </div>

          <div className="space-y-4 text-xs font-semibold">
            <div>
              <label className="block text-teal-100 mb-1.5 font-bold">Họ và tên thí sinh:</label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Nhập họ và tên..."
                className="w-full px-4 py-2.5 bg-white text-slate-800 rounded-2xl font-bold border-2 border-teal-400/60 focus:outline-none focus:border-teal-300 text-xs shadow-inner"
              />
            </div>

            <div>
              <label className="block text-teal-100 mb-1.5 font-bold">Lớp / Số báo danh:</label>
              <input
                type="text"
                required
                value={studentInfo}
                onChange={(e) => setStudentInfo(e.target.value)}
                placeholder="Ví dụ: 12A5 - SBD: 052"
                className="w-full px-4 py-2.5 bg-white text-slate-800 rounded-2xl font-bold border-2 border-teal-400/60 focus:outline-none focus:border-teal-300 text-xs shadow-inner"
              />
            </div>
          </div>

          <div className="p-3 bg-teal-950/60 border border-teal-400/30 rounded-xl text-[11px] text-teal-200 space-y-1">
            <div className="font-bold text-teal-300">✦ Cam kết quy chế:</div>
            <p>Tôi cam kết làm bài trung thực, không chuyển tab, không sử dụng trợ giúp trái phép trong suốt thời gian thi.</p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                soundEffects.playClick();
                setStep('testing');
              }}
              className="btn-3d btn-3d-teal w-full py-3.5 text-sm rounded-2xl font-black cursor-pointer shadow-lg text-white"
            >
              Vào phòng thi ngay ➔
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                setStep('landing');
              }}
              className="text-teal-300/70 hover:text-teal-100 text-xs py-1 text-center"
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
    const answeredCount = questions.filter(q => isQuestionFullyAnswered(q, userAnswers[q.id])).length;
    const isCurrentAnswered = isQuestionFullyAnswered(currentQ, userAnswers[currentQ?.id]);

    return (
      <div
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => {
          e.preventDefault();
          soundEffects.playWarning();
        }}
        className="min-h-[85vh] bg-gradient-to-b from-[#0d5c58] via-[#0a4946] to-[#073634] border border-teal-300/30 rounded-3xl p-4 sm:p-6 text-white flex flex-col justify-between shadow-2xl relative select-none"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-teal-300/30">
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
                  : 'bg-gradient-to-r from-teal-400/40 via-emerald-800/60 to-teal-950/80 border-teal-300/40'
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
        <div className="mt-2 py-2 px-3 bg-black/25 rounded-2xl flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 text-[11px] font-bold text-teal-100 whitespace-nowrap">
            <span>Mục lục câu hỏi ({answeredCount}/{questions.length}):</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {questions.map((q, idx) => {
              const isFull = isQuestionFullyAnswered(q, userAnswers[q.id]);
              const rawAns = userAnswers[q.id];
              const isPartial = !isFull && (
                typeof rawAns === 'object' ? Object.keys(rawAns || {}).length > 0 :
                typeof rawAns === 'string' ? rawAns.length > 0 : false
              );
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
                      : isFull
                      ? 'bg-emerald-500 text-white'
                      : isPartial
                      ? 'bg-amber-500 text-slate-950 font-black ring-1 ring-amber-300'
                      : 'bg-white/20 text-white/80 hover:bg-white/30'
                  }`}
                  title={`Câu ${idx + 1}: ${isFull ? 'Đã hoàn thành' : isPartial ? 'Đang làm dở' : 'Chưa làm'}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question Statement Box */}
        <div className="my-3 bg-[#052b2d]/70 backdrop-blur-xs border border-teal-300/30 rounded-2xl p-5 text-white shadow-lg text-center">
          <div className="text-xs font-bold text-teal-200 uppercase tracking-wider mb-1 flex items-center justify-center gap-2">
            <span className="bg-teal-800/60 px-2 py-0.5 rounded-md font-mono text-[10px] text-teal-100">
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
                  className="bg-[#052b2d]/60 backdrop-blur-xs border border-teal-300/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md"
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
                          ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-white scale-105 shadow-lg'
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

        {/* 2. PHẦN III: TRẢ LỜI NGẮN (TỐI ĐA 4 KÝ TỰ, HỖ TRỢ SỐ, DẤU "-", ",", ".") */}
        {currentQ.partType === 'part3_short_answer' && (
          <div className="bg-[#052b2d]/70 backdrop-blur-xs border border-teal-300/30 rounded-2xl p-5 text-center max-w-lg mx-auto w-full space-y-4 my-2 shadow-xl flex-1 flex flex-col justify-center">
            <div className="text-xs text-teal-200 font-bold uppercase tracking-wider">
              Nhập trả lời ngắn (tối đa 4 ký tự, hỗ trợ số, dấu &quot;-&quot;, &quot;,&quot;, &quot;.&quot;):
            </div>
            <div className="flex justify-center items-center gap-2">
              <input
                type="text"
                maxLength={4}
                value={userAnswers[currentQ.id] || ''}
                onChange={(e) => handleShortAnswerChange(e.target.value)}
                placeholder="vd: 5, -2, 3,5"
                className="w-48 text-center text-3xl font-black font-mono tracking-widest bg-white text-slate-900 border-4 border-amber-300 rounded-2xl py-2.5 px-4 shadow-inner focus:outline-none focus:ring-4 focus:ring-teal-300"
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
                Xóa 1 ký tự
              </button>
              <button
                type="button"
                onClick={() => {
                  const cur = userAnswers[currentQ.id] || '';
                  if (cur.length < 4) handleShortAnswerChange(cur + '-');
                }}
                className="btn-3d btn-3d-slate px-3 py-1.5 rounded-xl font-bold text-white cursor-pointer"
                title="Dấu trừ (-)"
              >
                - (Trừ)
              </button>
              <button
                type="button"
                onClick={() => {
                  const cur = userAnswers[currentQ.id] || '';
                  if (cur.length < 4) handleShortAnswerChange(cur + ',');
                }}
                className="btn-3d btn-3d-slate px-3 py-1.5 rounded-xl font-bold text-white cursor-pointer"
                title="Dấu phẩy (,)"
              >
                , (Phẩy)
              </button>
              <button
                type="button"
                onClick={() => handleShortAnswerChange('')}
                className="btn-3d btn-3d-slate px-3 py-1.5 rounded-xl text-white cursor-pointer"
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
        <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-teal-300/30 mt-2">
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

            {/* Submit Button with Completion Status Pill */}
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl hidden md:inline-block ${
                answeredCount === questions.length
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                  : 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
              }`}>
                {answeredCount === questions.length ? '✓ Đã xong 100%' : `Còn ${questions.length - answeredCount} câu`}
              </span>

              <button
                onClick={() => {
                  const incomplete = questions
                    .map((q, idx) => ({ q, idx, isAnswered: isQuestionFullyAnswered(q, userAnswers[q.id]) }))
                    .filter(item => !item.isAnswered);

                  if (incomplete.length > 0) {
                    soundEffects.playWarning();
                    setShowIncompleteNoticeModal(true);
                  } else {
                    soundEffects.playClick();
                    setShowSubmitConfirmModal(true);
                  }
                }}
                className="btn-3d btn-3d-teal px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xl text-white"
              >
                <FileCheck className="w-4 h-4" />
                <span>Nộp bài thi</span>
              </button>
            </div>
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

        {/* MODAL 1.5: INCOMPLETE NOTICE MODAL (Bắt buộc hoàn thành 100% câu hỏi mới được nộp) */}
        {showIncompleteNoticeModal && (() => {
          const incomplete = questions
            .map((q, idx) => ({ q, idx, isAnswered: isQuestionFullyAnswered(q, userAnswers[q.id]) }))
            .filter(item => !item.isAnswered);

          return (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-[#08282d] border-4 border-amber-400 rounded-3xl max-w-lg w-full text-white shadow-2xl p-6 sm:p-7 space-y-4 animate-in zoom-in-95">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 border-2 border-amber-400 flex items-center justify-center mx-auto animate-bounce">
                    <ShieldAlert className="w-9 h-9 stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-amber-300 uppercase tracking-wide">
                    ⚠️ CHƯA THỂ NỘP BÀI THI
                  </h3>
                  <p className="text-xs text-amber-100 font-medium leading-relaxed">
                    Theo quy chế kiểm tra trực tuyến, <span className="font-bold underline text-amber-300">bắt buộc học sinh phải hoàn thành 100% tất cả các câu hỏi</span> mới được nộp bài vào hệ thống.
                  </p>
                </div>

                <div className="bg-black/50 p-4 rounded-2xl border border-amber-400/40 text-xs space-y-3">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-200">Tiến độ làm bài hiện tại:</span>
                    <span className="font-mono text-amber-400 font-black text-sm">
                      {questions.length - incomplete.length} / {questions.length} câu ({Math.round(((questions.length - incomplete.length) / questions.length) * 100)}%)
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-rose-300 block mb-1.5">
                      Danh sách {incomplete.length} câu bạn chưa hoàn thành (Bấm vào để đến ngay câu đó):
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-black/40 rounded-xl border border-white/10">
                      {incomplete.map((item) => (
                        <button
                          key={item.q.id}
                          type="button"
                          onClick={() => {
                            soundEffects.playClick();
                            setCurrentIndex(item.idx);
                            setShowIncompleteNoticeModal(false);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-mono font-black text-xs cursor-pointer border border-rose-300 transition-all hover:scale-105 shadow-sm"
                          title={`Bấm để chuyển tới Câu ${item.idx + 1}`}
                        >
                          Câu {item.idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-teal-200/90 leading-relaxed italic">
                    💡 Lưu ý: Với câu trắc nghiệm Đúng/Sai (Phần II), bạn cần chọn đủ cả 4 ý a, b, c, d; với câu trả lời ngắn (Phần III), bạn cần nhập đủ 4 ký tự.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  {incomplete.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playClick();
                        setCurrentIndex(incomplete[0].idx);
                        setShowIncompleteNoticeModal(false);
                      }}
                      className="btn-3d btn-3d-amber w-full py-3 text-xs rounded-xl font-black text-amber-950 uppercase tracking-wider cursor-pointer shadow-lg"
                    >
                      ➔ Chuyển ngay đến câu chưa làm (Câu {incomplete[0].idx + 1})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playClick();
                      setShowIncompleteNoticeModal(false);
                    }}
                    className="btn-3d btn-3d-slate w-full py-2.5 text-xs rounded-xl font-bold cursor-pointer text-slate-200"
                  >
                    Đóng và tiếp tục làm bài
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* MODAL 2: CONFIRM SUBMIT MODAL (Chỉ mở khi đã làm 100% câu hỏi) */}
        {showSubmitConfirmModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#0b2b30] border-2 border-emerald-400/50 rounded-3xl max-w-md w-full text-slate-100 shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
              <div className="text-center space-y-1">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/50 flex items-center justify-center mx-auto mb-2 shadow-lg">
                  <FileCheck className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-black text-white">Xác nhận nộp bài thi</h3>
                <p className="text-xs text-teal-200/80">Bạn đã hoàn thành 100% tất cả {questions.length} câu hỏi</p>
              </div>

              <div className="bg-black/40 border border-teal-500/30 rounded-2xl p-4 text-xs space-y-2.5">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-300">Tổng số câu hỏi:</span>
                  <span className="font-bold text-white font-mono">{questions.length} câu</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-emerald-300">Trạng thái hoàn thành:</span>
                  <span className="font-bold text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {questions.length}/{questions.length} câu (100% ✓)
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-amber-300">Quy đổi thang điểm:</span>
                  <span className="font-bold text-amber-300">Thang điểm 10 (Thông tư 22)</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-blue-300">Điều kiện mở đáp án đúng:</span>
                  <span className="font-bold text-blue-300">Đạt từ 4.0 điểm trở lên</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-teal-500/20 pt-2">
                  <span className="text-slate-300">Vi phạm chuyển tab:</span>
                  <span className={`font-bold font-mono ${tabSwitchCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {tabSwitchCount} lần {tabSwitchCount === 0 ? '✓' : ''}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirmModal(false)}
                  className="btn-3d btn-3d-slate flex-1 py-3 text-xs rounded-xl font-bold cursor-pointer text-slate-200"
                >
                  Xem lại thêm
                </button>
                <button
                  type="button"
                  onClick={() => finishAndAutoSubmit(userAnswers, false)}
                  className="btn-3d btn-3d-teal flex-1 py-3 text-xs rounded-xl font-black cursor-pointer shadow-lg text-white"
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
    const isAnswerKeyUnlocked = (score ?? 0) >= 4.0;

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
      <div className="min-h-[84vh] bg-gradient-to-b from-[#0a2e33] via-[#07252a] to-[#04181b] rounded-3xl p-4 sm:p-8 text-white relative shadow-2xl flex flex-col justify-center items-center border border-teal-500/20">
        <div className="w-full max-w-3xl bg-[#0b383f]/95 border-2 border-emerald-400/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-6">
          {/* Header Trophy & Student Name */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400 flex items-center justify-center shadow-lg animate-bounce mb-3">
              <Award className="w-9 h-9 stroke-[2.5]" />
            </div>

            <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${gradeColor} mb-1.5`}>
              {gradeLabel}
            </span>

            <h2 className="text-2xl sm:text-3xl font-black text-white">{studentName}</h2>
            <p className="text-xs text-teal-200/80">{studentInfo} • Bài thi: {resolvedTitle}</p>
          </div>

          {/* Core Scorecard Grid (Điểm số, Đúng, Sai, Thời gian, Vi phạm) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {/* Score */}
            <div className="bg-[#06262b] border-2 border-emerald-400/40 rounded-2xl p-3 flex flex-col items-center justify-center col-span-2 sm:col-span-1 shadow-md">
              <span className="text-[11px] text-teal-200/80 font-bold uppercase tracking-wider">Điểm số</span>
              <span className="text-3xl font-black text-emerald-400 font-mono mt-0.5">
                {score} <span className="text-xs text-slate-400 font-normal">/ 10</span>
              </span>
              <span className="text-[9px] font-bold text-amber-300 mt-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-400/30">
                Thang 10 (TT22/BGDĐT)
              </span>
            </div>

            {/* Đúng */}
            <div className="bg-[#06262b] border border-emerald-500/30 rounded-2xl p-3 flex flex-col items-center justify-center">
              <span className="text-[11px] text-emerald-300 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Số câu đúng
              </span>
              <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                {correctCount} <span className="text-xs text-slate-400 font-normal">/ {questions.length}</span>
              </span>
            </div>

            {/* Sai */}
            <div className="bg-[#06262b] border border-rose-500/30 rounded-2xl p-3 flex flex-col items-center justify-center">
              <span className="text-[11px] text-rose-300 font-bold flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Số câu sai
              </span>
              <span className="text-2xl font-black text-rose-400 font-mono mt-0.5">
                {wrongCount}
              </span>
            </div>

            {/* Thời gian */}
            <div className="bg-[#06262b] border border-amber-500/30 rounded-2xl p-3 flex flex-col items-center justify-center">
              <span className="text-[11px] text-amber-300 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Thời gian làm
              </span>
              <span className="text-lg font-black text-amber-300 font-mono mt-0.5">
                {Math.floor(finalSubmission.durationSeconds / 60)}m {finalSubmission.durationSeconds % 60}s
              </span>
            </div>

            {/* Vi phạm chuyển tab */}
            <div className="bg-[#06262b] border border-teal-500/30 rounded-2xl p-3 flex flex-col items-center justify-center col-span-2 sm:col-span-1">
              <span className="text-[11px] text-teal-200/80 font-bold">Biên bản vi phạm</span>
              <span className={`text-base font-black font-mono mt-0.5 ${finalSubmission.tabSwitchCount && finalSubmission.tabSwitchCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {finalSubmission.tabSwitchCount ? `${finalSubmission.tabSwitchCount} lần tab` : '0 vi phạm ✓'}
              </span>
            </div>
          </div>

          {/* Answer Key Unlock Status Banner (Thang điểm 10 theo TT22 & Khóa/Mở khi >= 4.0 điểm) */}
          {isAnswerKeyUnlocked ? (
            <div className="p-3.5 bg-emerald-950/80 border-2 border-emerald-400/60 rounded-2xl text-left text-xs space-y-1 text-emerald-200 shadow-md">
              <div className="font-black flex items-center gap-2 text-emerald-300 text-sm">
                <Unlock className="w-4 h-4 text-emerald-400" />
                <span>🔓 ĐÃ MỞ KHÓA TOÀN BỘ ĐÁP ÁN ĐÚNG & GIA SƯ AI (ĐẠT {score}/10 ≥ 4.0 ĐIỂM)</span>
              </div>
              <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                Chúc mừng bạn! Kết quả bài làm đạt chuẩn từ 4.0 điểm trở lên. Bạn có thể xem toàn bộ đáp án chuẩn và nhận hỗ trợ phân tích từ Gia sư AI Gemini 3.8 Flash!
              </p>
            </div>
          ) : (
            <div className="p-4 bg-amber-950/80 border-2 border-amber-400/70 rounded-2xl text-left text-xs space-y-2 text-amber-200 shadow-lg">
              <div className="font-black flex items-center gap-2 text-amber-300 text-sm">
                <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                <span>🔒 CHẾ ĐỘ KHÓA ĐÁP ÁN ĐÚNG (YÊU CẦU ĐẠT TỪ 4.0 ĐIỂM TRỞ LÊN)</span>
              </div>
              <p className="text-xs text-amber-100/90 leading-relaxed">
                Điểm số hiện tại của bạn là <strong className="text-amber-300 font-mono text-sm">{score}/10 điểm</strong> (theo thang điểm 10 Thông tư 22/BGDĐT). Theo quy định, chỉ học sinh đạt <strong className="text-amber-300 font-bold">từ 4.0 điểm trở lên</strong> mới được mở khóa xem đáp án đúng và hướng dẫn giải từ Gia sư AI.
              </p>
              <div className="p-2.5 bg-black/40 rounded-xl border border-amber-400/30 text-[11px] text-amber-200/90 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Hãy ôn lại kiến thức bài học trong SGK và bấm <strong>&quot;Làm lại bài&quot;</strong> bên dưới để nâng cao điểm số và mở khóa đáp án nhé!</span>
              </div>
            </div>
          )}

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
              className={`btn-3d ${isAnswerKeyUnlocked ? 'btn-3d-blue' : 'btn-3d-slate'} px-5 py-3 text-xs rounded-xl font-black flex items-center gap-2 cursor-pointer shadow-lg`}
            >
              {isAnswerKeyUnlocked ? <Eye className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-300" />}
              <span>{showReviewMode ? 'Ẩn xem lại chi tiết' : isAnswerKeyUnlocked ? '🔍 Xem Lại Chi Tiết Bài Làm & Mở AI Gia Sư' : '🔍 Xem Lại Bài Làm (🔒 Đáp án đúng đang khóa)'}</span>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-teal-400" />
                    <span>Chi Tiết Từng Câu Hỏi & Hướng Dẫn Giải</span>
                  </h3>
                  <p className="text-[11px] text-teal-200/80">
                    {isAnswerKeyUnlocked
                      ? 'Bấm "Gia sư AI giải thích" ở từng câu để Gemini 3.8 Flash phân tích sâu kiến thức cho bạn!'
                      : '🔒 Đáp án đúng của các câu sai đang bị khóa vì điểm thi dưới 4.0 điểm. Cần đạt từ 4.0 điểm trở lên để mở khóa!'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  {isAnswerKeyUnlocked ? (
                    <>
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                      <span className="text-emerald-300 font-bold">Đáp án đúng</span>
                      <span className="w-3 h-3 rounded-full bg-rose-500 inline-block ml-2"></span>
                      <span className="text-rose-300 font-bold">Bạn chọn sai</span>
                    </>
                  ) : (
                    <span className="text-amber-300 font-bold flex items-center gap-1 text-[11px] bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-400/30">
                      <Lock className="w-3 h-3" /> Chế độ khóa đáp án đúng (&lt; 4.0đ)
                    </span>
                  )}
                </div>
              </div>

              {!isAnswerKeyUnlocked && (
                <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-400/50 text-amber-200 text-xs flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Học sinh đạt <strong>{score}/10 điểm</strong>. Hệ thống chỉ hiển thị đáp án bạn đã chọn và kết quả Đúng/Sai. Đáp án chuẩn và Gia sư AI chỉ mở khóa khi làm lại đạt từ <strong>4.0 điểm trở lên</strong>.
                  </span>
                </div>
              )}

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

                        {/* POST-EXAM ONLY AI TUTOR BUTTON (Chỉ mở khi >= 4.0 điểm) */}
                        {isAnswerKeyUnlocked ? (
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
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              soundEffects.playWarning();
                              alert(`🔒 Gia sư AI đang bị khóa! Bạn đạt ${score}/10 điểm. Theo quy chế kiểm tra, học sinh cần đạt từ 4.0 điểm trở lên mới được mở khóa Gia sư AI giải thích.`);
                            }}
                            className="px-3 py-1.5 text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer bg-slate-800 text-slate-400 border border-slate-700 hover:border-amber-400 shrink-0 shadow-xs"
                            title="Chỉ mở khóa khi bài làm đạt từ 4.0 điểm trở lên"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>🔒 Mở AI khi ≥ 4.0đ</span>
                          </button>
                        )}
                      </div>

                      {/* Part 1: Options Grid */}
                      {(!q.partType || q.partType === 'part1_choice') && q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {q.options.map((opt) => {
                            const isChosen = studentChoice === opt.key;
                            const isRightAnswer = q.correctAnswer === opt.key;

                            let badgeStyle = 'bg-black/30 border-slate-700 text-slate-300';
                            if (isAnswerKeyUnlocked) {
                              if (isRightAnswer) {
                                badgeStyle = 'bg-emerald-900/80 border-emerald-400 text-emerald-100 font-bold';
                              } else if (isChosen && !isRightAnswer) {
                                badgeStyle = 'bg-rose-900/80 border-rose-400 text-rose-100 font-bold';
                              }
                            } else {
                              // Locked mode: do NOT leak correct answer to student
                              if (isChosen) {
                                badgeStyle = isFullyCorrect
                                  ? 'bg-emerald-900/80 border-emerald-400 text-emerald-100 font-bold'
                                  : 'bg-rose-900/80 border-rose-400 text-rose-100 font-bold';
                              }
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
                                {isAnswerKeyUnlocked ? (
                                  <>
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
                                  </>
                                ) : (
                                  <>
                                    {isChosen && (
                                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-black shrink-0 ${
                                        isFullyCorrect ? 'bg-emerald-400 text-emerald-950' : 'bg-rose-400 text-rose-950'
                                      }`}>
                                        {isFullyCorrect ? '✓ Bạn chọn đúng' : '✗ Bạn chọn sai'}
                                      </span>
                                    )}
                                  </>
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
                                    Bạn chọn: {studentSubVal === true ? 'ĐÚNG' : studentSubVal === false ? 'SAI' : 'Chưa chọn'} {isSubCorrect ? '✓' : '✗'}
                                  </span>
                                  {isAnswerKeyUnlocked ? (
                                    <span className="text-[10px] bg-emerald-400 text-emerald-950 px-2 py-1 rounded-md font-black">
                                      Đáp án chuẩn: {si.isCorrect ? 'ĐÚNG (Gạch chân)' : 'SAI'}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-amber-500/20 text-amber-200 border border-amber-400/40 px-2 py-1 rounded-md font-bold flex items-center gap-1">
                                      <Lock className="w-3 h-3 text-amber-400" />
                                      Đáp án chuẩn: 🔒 Cần ≥ 4.0đ
                                    </span>
                                  )}
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
                            <span className="ml-2 font-bold text-xs">{isFullyCorrect ? '✓ Đúng' : '✗ Sai'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isAnswerKeyUnlocked ? (
                              <>
                                <span className="text-slate-300">Đáp án 4 ký tự chuẩn:</span>
                                <span className="font-mono text-base font-black bg-emerald-400 text-emerald-950 px-2.5 py-0.5 rounded-lg shadow-sm">
                                  {q.shortAnswerCorrect || q.correctAnswer || '1234'}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-200 border border-amber-400/40 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                                Đáp án chuẩn: 🔒 Khóa (Cần ≥ 4.0đ)
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Static explanation if available */}
                      {q.explanation && (
                        isAnswerKeyUnlocked ? (
                          <div className="p-2.5 bg-black/40 rounded-xl text-[11px] text-slate-300 border border-white/10">
                            <span className="font-bold text-teal-300">Lời giải chi tiết:</span> {q.explanation}
                          </div>
                        ) : (
                          <div className="p-2.5 bg-amber-950/40 rounded-xl text-[11px] text-amber-200/90 border border-amber-400/20 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Lời giải chi tiết bị khóa. Học sinh cần đạt từ 4.0 điểm trở lên để mở xem.</span>
                          </div>
                        )
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
              <div className="bg-[#082226] border-2 border-teal-500/50 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden my-auto animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-teal-700 via-emerald-700 to-teal-800 px-6 py-5 flex items-center justify-between border-b border-teal-400/30 shrink-0">
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
                      <p className="text-xs text-teal-100/90 font-medium">
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
                  {/* Status Note on Answer Key Unlock */}
                  {!isAnswerKeyUnlocked ? (
                    <div className="p-3.5 bg-amber-950/70 border border-amber-400/50 rounded-2xl text-xs text-amber-200 flex items-start gap-2.5 shadow-md">
                      <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-amber-300">
                          🔒 Chế độ khóa đáp án đúng (Học sinh đạt {score}/10 &lt; 4.0 điểm)
                        </span>
                        <span className="text-[11px] text-amber-100/80 leading-relaxed block mt-0.5">
                          Theo quy chế phòng thi, hệ thống chỉ mở xem đáp án chuẩn và lời giải chi tiết khi điểm bài thi đạt từ <strong>4.0 điểm trở lên</strong>. Hãy ôn lại bài và làm lại để mở khóa nhé!
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-950/70 border border-emerald-400/50 rounded-2xl text-xs text-emerald-200 flex items-center gap-2 shadow-sm">
                      <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        🔓 <strong>Đã mở khóa toàn bộ:</strong> Bạn đạt {score}/10 điểm (≥ 4.0 điểm). Đáp án chuẩn và Gia sư AI đã sẵn sàng hỗ trợ bạn ôn luyện!
                      </span>
                    </div>
                  )}

                  {/* Score & Key Metrics Banner */}
                  <div className="bg-[#0b2e35] border border-teal-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-lg">
                    {/* Big Score Block */}
                    <div className="flex items-center gap-4 text-center sm:text-left">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-1 flex flex-col items-center justify-center shadow-lg border border-emerald-300/40 shrink-0">
                        <span className="text-[10px] font-black uppercase text-emerald-100 tracking-wider">Tổng Điểm</span>
                        <span className="text-3xl font-black text-white font-mono leading-none my-0.5">
                          {score}
                        </span>
                        <span className="text-[9px] text-emerald-200">thang 10 (TT22)</span>
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
                  <div className="bg-[#06262b] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
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
                              {isAnswerKeyUnlocked && (
                                <span className="text-[10px] bg-emerald-400 text-emerald-950 px-1 rounded font-black">
                                  {q.correctAnswer}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Detailed Breakdown of Wrong Answers */}
                  <div className="bg-[#06262b] border border-rose-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-rose-300 flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span>Phân Tích Chi Tiết Các Câu Làm Sai ({wrongQuestions.length} câu)</span>
                      </h4>
                      <span className="text-[11px] text-rose-400/80 font-semibold">
                        {isAnswerKeyUnlocked ? 'Xem kỹ đáp án và ôn lại ngay' : '🔒 Cần ≥ 4.0 điểm để mở đáp án chuẩn'}
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

                                {/* AI Button: only unlocked when score >= 4.0 */}
                                {isAnswerKeyUnlocked ? (
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
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      soundEffects.playWarning();
                                      alert(`🔒 Gia sư AI đang bị khóa! Bạn đạt ${score}/10 điểm. Vui lòng làm lại đạt từ 4.0 điểm trở lên để mở khóa Gia sư AI.`);
                                    }}
                                    className="px-3 py-1.5 text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer bg-slate-800 text-slate-400 border border-slate-700 hover:border-amber-400 shrink-0"
                                    title="Khóa: Cần đạt từ 4.0 điểm trở lên"
                                  >
                                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                                    <span>🔒 Mở AI khi ≥ 4.0đ</span>
                                  </button>
                                )}
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

                                {isAnswerKeyUnlocked ? (
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
                                ) : (
                                  <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-400/40 flex items-start gap-2">
                                    <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="text-[10px] font-black uppercase text-amber-300 block">
                                        Đáp án chuẩn:
                                      </span>
                                      <span className="font-bold text-amber-200 text-xs">
                                        🔒 Khóa (Cần đạt từ 4.0 điểm trở lên để mở)
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Quick Explanation */}
                              {q.explanation && (
                                isAnswerKeyUnlocked ? (
                                  <div className="p-2.5 bg-black/40 rounded-xl text-[11px] text-slate-300 border border-white/10">
                                    <span className="font-bold text-teal-300">Lời giải chi tiết:</span> {q.explanation}
                                  </div>
                                ) : (
                                  <div className="p-2.5 bg-amber-950/40 rounded-xl text-[11px] text-amber-200/90 border border-amber-400/20 flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span>Lời giải chi tiết bị khóa. Học sinh cần đạt từ 4.0 điểm trở lên để mở xem.</span>
                                  </div>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Section 3: Unanswered Questions (if any) */}
                  {unansweredQuestions.length > 0 && (
                    <div className="bg-[#06262b] border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
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
                                <strong>Đáp án đúng:</strong> {isAnswerKeyUnlocked ? (q.partType === 'part2_true_false' ? (q.correctAnswer || 'Xem chi tiết') : q.partType === 'part3_short_answer' ? (q.shortAnswerCorrect || '1234') : `${q.correctAnswer}. ${correctChoiceObj?.text || ''}`) : '🔒 Khóa (Cần ≥ 4.0đ)'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Action Buttons Footer */}
                <div className="bg-[#04191c] px-6 py-4 border-t border-teal-500/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
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
