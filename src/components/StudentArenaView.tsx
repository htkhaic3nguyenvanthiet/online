import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Power,
  Clock,
  Plus,
  Minus,
  Flame,
  CheckCircle,
  XCircle,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Volume2,
  Award,
  Send,
  HelpCircle,
  Share2
} from 'lucide-react';
import { OptionKey, Question, Quiz, StudentSubmission } from '../types/quiz';
import { sampleQuestions } from '../data/mockData';
import { soundEffects } from '../utils/soundEffects';
import { realtimeEngine } from '../services/realtimeEngine';
import { aiService } from '../services/aiService';
import { Bot } from 'lucide-react';

interface StudentArenaViewProps {
  quizTitle?: string;
  onExit: () => void;
  onResultSubmitted?: (sub: StudentSubmission) => void;
}

export const StudentArenaView: React.FC<StudentArenaViewProps> = ({
  quizTitle = 'ÔN CN12-1-2-3',
  onExit,
  onResultSubmitted
}) => {
  // Steps: 'landing' (Screenshot 6) -> 'info-modal' (Screenshot 7) -> 'testing' (Screenshot 8) -> 'result'
  const [step, setStep] = useState<'landing' | 'info-modal' | 'testing' | 'result'>('landing');

  // Student Info
  const [studentName, setStudentName] = useState('Nguyễn Thành Nam');
  const [studentInfo, setStudentInfo] = useState('12A5 - SBD: 052');

  // Test state
  const questions = sampleQuestions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, OptionKey>>({});
  const [selectedOption, setSelectedOption] = useState<OptionKey | null>(null);
  const [hasConfirmedCurrent, setHasConfirmedCurrent] = useState(false);
  const [streak, setStreak] = useState(0);
  const [fontSizeOffset, setFontSizeOffset] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(3627); // ~01:00:27 matching screenshot!
  const [finalSubmission, setFinalSubmission] = useState<StudentSubmission | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [isAiExplaining, setIsAiExplaining] = useState(false);
  const [aiExplanationText, setAiExplanationText] = useState<string | null>(null);

  // Network monitor for 4G/5G/Wifi stability
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for existing saved draft in case of accidental reload or network drop
    try {
      const saved = localStorage.getItem('testonline_active_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Date.now() - parsed.timestamp < 3600000 * 2) { // within 2 hours
          setUserAnswers(parsed.userAnswers || {});
          setCurrentIndex(parsed.currentIndex || 0);
          setStreak(parsed.streak || 0);
          setStudentName(parsed.studentName || 'Nguyễn Thành Nam');
          setStudentInfo(parsed.studentInfo || '12A5 - SBD: 052');
          setHasRestoredDraft(true);
        }
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Continuous autosave of answers to protect against 4G disconnection
  useEffect(() => {
    if (step === 'testing') {
      try {
        localStorage.setItem(
          'testonline_active_draft',
          JSON.stringify({
            quizTitle,
            studentName,
            studentInfo,
            currentIndex,
            userAnswers,
            streak,
            secondsRemaining,
            timestamp: Date.now()
          })
        );
      } catch {
        // ignore
      }
    }
  }, [step, currentIndex, userAnswers, streak, secondsRemaining, quizTitle, studentName, studentInfo]);

  // Timer countdown during testing
  useEffect(() => {
    if (step !== 'testing') return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const currentQ = questions[currentIndex];

  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours.toString().padStart(2, '0')} : ${minutes.toString().padStart(2, '0')} : ${seconds.toString().padStart(2, '0')}`;
  };

  const handlePickOption = (key: OptionKey) => {
    soundEffects.playClick();
    setSelectedOption(key);
  };

  const handleAskAITutor = async () => {
    soundEffects.playClick();
    setIsAiExplaining(true);
    setAiExplanationText('Đang kết nối với Trợ lý AI Gemini 3.8 Flash...');

    try {
      const explanation = await aiService.explainQuestion({
        questionContent: currentQ.content,
        options: currentQ.options,
        selectedAnswer: selectedOption || undefined,
        correctAnswer: currentQ.correctAnswer,
        subject: 'Công nghệ Nông nghiệp 12',
      });
      setAiExplanationText(explanation);
      soundEffects.playCorrect();
    } catch (err: any) {
      setAiExplanationText('Không thể kết nối AI: ' + err?.message);
    } finally {
      setIsAiExplaining(false);
    }
  };

  const handleConfirmAnswer = () => {
    if (!selectedOption) return;

    const isCorrect = selectedOption === currentQ.correctAnswer;
    if (isCorrect) {
      soundEffects.playCorrect();
      setStreak((s) => s + 1);
    } else {
      soundEffects.playIncorrect();
      setStreak(0);
    }

    const updatedAnswers = { ...userAnswers, [currentQ.id]: selectedOption };
    setUserAnswers(updatedAnswers);
    setHasConfirmedCurrent(true);

    // Auto advance or finalize after brief animation
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((i) => i + 1);
        setSelectedOption(null);
        setHasConfirmedCurrent(false);
      } else {
        // Complete exam & auto grade!
        finishAndAutoSubmit(updatedAnswers);
      }
    }, 700);
  };

  const finishAndAutoSubmit = (answers: Record<string, OptionKey>) => {
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

    let correctCount = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });

    const score = +((correctCount / questions.length) * 10).toFixed(2);
    const duration = 3627 - secondsRemaining;

    // Call Realtime Engine: Auto-grades & instantly transmits back to Teacher Dashboard!
    const sub = realtimeEngine.submitStudentExam({
      sessionId: '4975878',
      studentName: studentName || 'Học sinh ẩn danh',
      studentInfo: studentInfo || 'Lớp 12A5',
      score,
      totalPoints: 10.0,
      correctAnswersCount: correctCount,
      totalQuestions: questions.length,
      durationSeconds: duration,
      streakMax: Math.max(streak, correctCount),
      answers
    });

    try {
      localStorage.removeItem('testonline_active_draft');
    } catch {
      // ignore
    }

    setFinalSubmission(sub);
    setStep('result');
    if (onResultSubmitted) {
      onResultSubmitted(sub);
    }
  };

  /* =========================================================================
     1. LANDING SCREEN (Matching Screenshot 6: image_f182bacd.png)
     ========================================================================= */
  if (step === 'landing') {
    return (
      <div className="min-h-[82vh] bg-gradient-to-b from-[#2a1b3d] via-[#1f1530] to-[#120a21] rounded-3xl p-6 sm:p-10 flex items-center justify-center relative overflow-hidden shadow-2xl">
        {/* Subtle decorative background stars */}
        <div className="absolute top-10 left-12 text-pink-300/20 text-3xl select-none">★</div>
        <div className="absolute bottom-16 right-16 text-pink-400/20 text-4xl select-none">★</div>
        <div className="absolute top-1/2 left-8 text-purple-300/15 text-2xl select-none">★</div>

        {/* Central Arena Card matching screenshot 6 */}
        <div className="w-full max-w-2xl bg-[#36274e]/90 border-2 border-pink-500/40 rounded-3xl p-6 sm:p-8 text-center text-white shadow-2xl backdrop-blur-md relative z-10">
          {/* Top badges */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="bg-white/10 text-pink-200 text-xs font-bold tracking-wider px-3.5 py-1 rounded-full uppercase">
              Trò chơi học tập • Tương tác
            </span>
            <span className="bg-rose-500/80 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
              Công nghệ 12
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">
            {quizTitle}
          </h1>

          <p className="text-pink-200/90 text-sm font-medium mb-6">
            Chuẩn bị sẵn sàng – nhiệm vụ của bạn sắp bắt đầu!
          </p>

          {/* Stats Bar Grid matching Screenshot 6 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-8">
            {/* Thời gian */}
            <div className="bg-[#241935]/80 border border-pink-400/20 rounded-2xl p-3 flex flex-col items-center justify-center">
              <span className="text-[11px] text-pink-200/70 font-semibold mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-pink-400" /> Thời gian
              </span>
              <span className="text-base font-extrabold text-white">60&apos;</span>
            </div>

            {/* Bắt đầu */}
            <div className="bg-[#241935]/80 border border-pink-400/20 rounded-2xl p-3 flex flex-col items-center justify-center">
              <span className="text-[11px] text-pink-200/70 font-semibold mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-pink-400" /> Bắt đầu
              </span>
              <span className="text-xs font-extrabold text-white leading-tight">20:37:00</span>
              <span className="text-[10px] text-pink-300/80 font-mono">27/10/2025</span>
            </div>

            {/* Câu hỏi */}
            <div className="bg-[#241935]/80 border border-pink-400/20 rounded-2xl p-3 flex flex-col items-center justify-center">
              <span className="text-[11px] text-pink-200/70 font-semibold mb-1">≡ Câu hỏi</span>
              <span className="text-base font-extrabold text-white">{questions.length}</span>
            </div>

            {/* Điểm */}
            <div className="bg-gradient-to-b from-[#3a2754] to-[#241935] border border-pink-400/30 rounded-2xl p-3 flex flex-col items-center justify-center">
              <span className="text-[11px] text-pink-200/70 font-semibold mb-1">≡ Điểm</span>
              <span className="text-base font-extrabold text-white">10.0</span>
            </div>

            {/* Lượt làm */}
            <div className="bg-[#241935]/80 border border-pink-400/20 rounded-2xl p-3 flex flex-col items-center justify-center col-span-2 sm:col-span-1">
              <span className="text-[11px] text-pink-200/70 font-semibold mb-1">✦ Lượt làm</span>
              <span className="text-base font-extrabold text-white">100</span>
            </div>
          </div>

          {/* Big Vibrant 3D Start Button matching screenshot 6 */}
          <button
            onClick={() => {
              soundEffects.playClick();
              setStep('info-modal');
            }}
            className="btn-3d btn-3d-pink w-full py-3.5 text-base rounded-2xl flex items-center justify-center gap-2 cursor-pointer font-black tracking-wide uppercase shadow-xl"
          >
            <span>▶ Bắt đầu làm bài</span>
          </button>
        </div>
      </div>
    );
  }

  /* =========================================================================
     2. INFO CONFIRMATION MODAL (Matching Screenshot 7: image_c7cd7886.png)
     ========================================================================= */
  if (step === 'info-modal') {
    return (
      <div className="min-h-[82vh] bg-gradient-to-b from-[#2a1b3d] via-[#1f1530] to-[#120a21] rounded-3xl p-6 sm:p-10 flex items-center justify-center relative">
        <div className="w-full max-w-lg bg-[#3a2952] border-2 border-pink-500/50 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-white">Xác nhận thông tin</h2>
            <p className="text-pink-200/80 text-xs mt-1">Điền thông tin cần thiết để bắt đầu ✨</p>
          </div>

          <div className="space-y-4 text-xs font-semibold">
            <div>
              <label className="block text-pink-100 mb-1.5 font-bold">Tên học sinh</label>
              <div className="relative">
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Nhập tên học sinh"
                  className="w-full pl-4 pr-4 py-2.5 bg-white text-slate-800 rounded-2xl font-bold border-2 border-pink-300 focus:outline-none focus:border-pink-500 text-xs shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="block text-pink-100 mb-1.5 font-bold">Thông tin thêm (tuỳ chọn):</label>
              <div className="relative">
                <input
                  type="text"
                  value={studentInfo}
                  onChange={(e) => setStudentInfo(e.target.value)}
                  placeholder="Nhập Lớp/STT/SBD ..."
                  className="w-full pl-4 pr-4 py-2.5 bg-white text-slate-800 rounded-2xl font-bold border-2 border-pink-300 focus:outline-none focus:border-pink-500 text-xs shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2">
            <button
              onClick={() => {
                soundEffects.playClick();
                setStep('testing');
              }}
              className="btn-3d btn-3d-pink w-full py-3 text-sm rounded-2xl font-black cursor-pointer shadow-lg"
            >
              Xác nhận
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                setStep('landing');
              }}
              className="text-pink-300/70 hover:text-pink-100 text-xs py-1.5 font-medium text-center"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
     3. LIVE EXAM ARENA SCREEN (Matching Screenshot 8: image_eb0adeda.png)
     ========================================================================= */
  if (step === 'testing') {
    const isLastQuestion = currentIndex === questions.length - 1;

    return (
      <div className="min-h-[85vh] bg-[#db2777] rounded-3xl p-4 sm:p-6 text-white flex flex-col justify-between shadow-2xl relative select-none">
        {/* Top Header Bar matching Screenshot 8 */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-pink-400/40">
          {/* Power/Exit button */}
          <button
            onClick={() => {
              soundEffects.playClick();
              if (confirm('Bạn có chắc chắn muốn rời phòng thi không?')) {
                onExit();
              }
            }}
            className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 flex items-center justify-center text-white cursor-pointer transition-colors"
            title="Thoát phòng thi"
          >
            <Power className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Student identifier chip & network resilience status */}
          <div className="text-center flex flex-col items-center">
            <span className="font-extrabold text-sm sm:text-base text-white tracking-wide">
              {studentName} - {studentInfo}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 mt-0.5 ${
              isOnline ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40' : 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{isOnline ? '4G/5G: Ổn định (Chống rớt mạng)' : 'Mạng yếu: Đã lưu tự động trong máy'}</span>
            </span>
          </div>

          {/* Clock Timer Pill with Zoom +/- */}
          <div className="flex items-center gap-1.5">
            <div className="bg-gradient-to-r from-pink-400/50 to-purple-900/60 border border-white/40 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-md">
              <Clock className="w-3.5 h-3.5 text-amber-300 animate-spin" />
              <span className="font-mono font-black text-xs sm:text-sm tracking-wider">
                {formatTimer(secondsRemaining)}
              </span>
            </div>

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

        {/* Question Statement Box matching Screenshot 8 */}
        <div className="my-5 bg-white/10 backdrop-blur-xs border border-white/30 rounded-2xl p-5 text-white shadow-lg text-center">
          <div className="text-xs font-bold text-pink-100 uppercase tracking-wider mb-1">
            Câu {currentIndex + 1} / {questions.length}
          </div>
          <h2
            className="font-bold text-slate-50 leading-relaxed"
            style={{ fontSize: `${18 + fontSizeOffset}px` }}
          >
            {currentQ.content}
          </h2>
        </div>

        {/* 4 Big 3D Tactile Buttons (A, B, C, D) Matching Screenshot 8 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-2 flex-1 items-stretch">
          {currentQ.options.map((opt) => {
            const isSelected = selectedOption === opt.key;
            // Palette matching screenshot 8: A=Blue, B=Teal, C=Orange, D=Purple
            let colorClass = 'btn-3d-blue';
            if (opt.key === 'B') colorClass = 'btn-3d-emerald';
            if (opt.key === 'C') colorClass = 'btn-3d-orange';
            if (opt.key === 'D') colorClass = 'btn-3d-purple';

            return (
              <button
                key={opt.key}
                onClick={() => handlePickOption(opt.key)}
                className={`btn-3d ${colorClass} p-5 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer min-h-[140px] relative transition-all ${
                  isSelected ? 'ring-4 ring-white scale-102 shadow-2xl brightness-110' : 'opacity-95'
                }`}
              >
                {/* Geometric icon badge */}
                <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center font-black text-lg mb-2 shadow-inner">
                  {opt.key}
                </div>
                {/* Option text */}
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

        {/* Bottom Action & Progress Bar matching Screenshot 8 */}
        <div className="pt-4 flex items-center justify-between gap-4 border-t border-pink-400/40 mt-3">
          {/* Left: Streak Fire Counter */}
          <div className="flex items-center gap-1.5 bg-black/20 px-3.5 py-1.5 rounded-full text-white font-bold text-xs">
            <Flame className={`w-4 h-4 ${streak > 0 ? 'text-amber-400 fill-amber-400 animate-bounce' : 'text-slate-300'}`} />
            <span>{streak}</span>
          </div>

          {/* Center: Question Progress */}
          <div className="bg-black/30 px-4 py-1.5 rounded-full font-mono font-bold text-xs text-white">
            {currentIndex + 1} / {questions.length}
          </div>

          {/* Right: AI Tutor button + 3D Confirm / Next Button "Đồng ý >" */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAskAITutor}
              disabled={isAiExplaining}
              className="btn-3d btn-3d-amber px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer text-amber-950 shadow-md"
              title="Nhận hướng dẫn và giải thích từ Gia sư AI Gemini"
            >
              <Bot className="w-4 h-4 text-amber-900" />
              <span>{isAiExplaining ? 'AI đang suy nghĩ...' : 'Hỏi Gia Sư AI'}</span>
            </button>

            <button
              onClick={handleConfirmAnswer}
              disabled={!selectedOption || hasConfirmedCurrent}
              className={`btn-3d px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition-all ${
                selectedOption
                  ? 'btn-3d-blue text-white'
                  : 'bg-white/20 text-white/50 cursor-not-allowed shadow-none'
              }`}
            >
              <span>{isLastQuestion ? 'Nộp bài & Chấm điểm ✦' : 'Đồng ý >'}</span>
            </button>
          </div>
        </div>

        {/* AI Tutor Explanation Modal */}
        {aiExplanationText && (
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full text-slate-800 shadow-2xl border border-slate-100 overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-teal-800 font-extrabold text-sm">
                  <Bot className="w-5 h-5 text-teal-600" />
                  <span>Gia Sư Ảo AI Gemini 3.8 Flash • THPT Mang Thít</span>
                </div>
                <button
                  onClick={() => setAiExplanationText(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-slate-600">Nội dung câu hỏi:</span>
                <p className="font-semibold text-slate-900">{currentQ.content}</p>
              </div>

              <div className="text-xs text-slate-700 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-line p-3 bg-teal-50/50 rounded-xl border border-teal-100">
                {aiExplanationText}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setAiExplanationText(null)}
                  className="btn-3d btn-3d-teal px-5 py-2 text-xs rounded-xl font-bold cursor-pointer"
                >
                  Đã hiểu bài! Tiếp tục làm bài
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* =========================================================================
     4. RESULT & AUTO-RETURNED TO DASHBOARD SCREEN
     ========================================================================= */
  if (step === 'result' && finalSubmission) {
    return (
      <div className="min-h-[82vh] bg-gradient-to-b from-[#2a1b3d] via-[#1f1530] to-[#120a21] rounded-3xl p-6 sm:p-10 flex items-center justify-center text-white relative shadow-2xl">
        <div className="w-full max-w-lg bg-[#3a2952] border-2 border-emerald-400/50 rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400 flex items-center justify-center mx-auto shadow-lg animate-bounce">
            <Award className="w-9 h-9 stroke-[2.5]" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
              Chấm điểm tự động hoàn tất!
            </span>
            <h2 className="text-3xl font-black text-white">{studentName}</h2>
            <p className="text-xs text-pink-200/80">{studentInfo}</p>
          </div>

          {/* Score Display */}
          <div className="bg-[#241935] border border-emerald-400/30 rounded-2xl p-4 flex items-center justify-around">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Điểm số</div>
              <div className="text-3xl font-black text-emerald-400 font-mono">
                {finalSubmission.score} <span className="text-xs text-slate-400">/ 10</span>
              </div>
            </div>
            <div className="w-px h-10 bg-slate-700"></div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Số câu đúng</div>
              <div className="text-2xl font-black text-white font-mono">
                {finalSubmission.correctAnswersCount}/{finalSubmission.totalQuestions}
              </div>
            </div>
            <div className="w-px h-10 bg-slate-700"></div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Thời gian</div>
              <div className="text-lg font-bold text-amber-300 font-mono">
                {Math.floor(finalSubmission.durationSeconds / 60)}m {finalSubmission.durationSeconds % 60}s
              </div>
            </div>
          </div>

          {/* Real-time sync confirmation card */}
          <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-left text-xs space-y-1 text-emerald-200">
            <div className="font-bold flex items-center gap-1.5 text-emerald-400">
              <Send className="w-4 h-4" />
              <span>Đã tự động trả kết quả về Trang Chủ của Giáo Viên!</span>
            </div>
            <p className="text-[11px] text-emerald-300/80 leading-relaxed">
              Điểm số và phân tích bài làm đã được đồng bộ trực tiếp lên Bảng tổng hợp của Thầy Hồ Tấn Khải (Trường THPT Mang Thít) qua kênh thời gian thực (Zero latency).
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                soundEffects.playClick();
                setStep('landing');
                setCurrentIndex(0);
                setSelectedOption(null);
                setUserAnswers({});
              }}
              className="btn-3d btn-3d-slate flex-1 py-2.5 text-xs rounded-xl font-bold cursor-pointer"
            >
              Làm lại bài thi
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                onExit();
              }}
              className="btn-3d btn-3d-teal flex-1 py-2.5 text-xs rounded-xl font-bold cursor-pointer"
            >
              Về Trang Quản Trị
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
