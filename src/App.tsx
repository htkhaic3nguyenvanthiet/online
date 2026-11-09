import React, { useState, useEffect } from 'react';
import { ActiveTab, Classroom, ConcurrentSystemMetrics, ExamSession, Quiz, StudentSubmission, Question } from './types/quiz';
import { mockClassrooms, mockSessions } from './data/mockData';
import { realtimeEngine } from './services/realtimeEngine';
import { soundEffects } from './utils/soundEffects';
import { cloudStorageService } from './services/cloudStorageService';
import { getStudentExamShareUrl, getExamIdFromUrl } from './utils/urlHelper';

import { TopNavbar } from './components/TopNavbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { QuizManagementView } from './components/QuizManagementView';

import { OnlineSessionsView } from './components/OnlineSessionsView';
import { Live500StressTestMonitor } from './components/Live500StressTestMonitor';
import { StudentArenaView } from './components/StudentArenaView';
import { CreateQuizModal } from './components/CreateQuizModal';
import { EditQuizModal } from './components/EditQuizModal';
import { CloudDriveModal } from './components/CloudDriveModal';
import { LiveNotificationToast } from './components/LiveNotificationToast';
import { ExamSummaryAttendanceView } from './components/ExamSummaryAttendanceView';
import { Award, School, UserCheck, ShieldCheck, Cloud, Sparkles } from 'lucide-react';

export default function App() {
  const [appMode, setAppMode] = useState<'teacher' | 'student'>('teacher');
  const [currentTab, setCurrentTab] = useState<ActiveTab>('dashboard');
  const [selectedSummarySessionId, setSelectedSummarySessionId] = useState<string>('');

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>(mockClassrooms);
  const [sessions, setSessions] = useState<ExamSession[]>(mockSessions);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>(realtimeEngine.getSubmissions());
  const [metrics, setMetrics] = useState<ConcurrentSystemMetrics>(realtimeEngine.getMetrics());

  const [is500SimActive, setIs500SimActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isCreateQuizModalOpen, setIsCreateQuizModalOpen] = useState(false);
  const [isEditQuizModalOpen, setIsEditQuizModalOpen] = useState(false);
  const [quizToEdit, setQuizToEdit] = useState<Quiz | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [latestToastSub, setLatestToastSub] = useState<StudentSubmission | null>(null);
  const [activeStudentExamTitle, setActiveStudentExamTitle] = useState('ÔN CN12-1-2-3');
  const [activeStudentExamSession, setActiveStudentExamSession] = useState<ExamSession | null>(null);
  const [isDirectStudentMode, setIsDirectStudentMode] = useState<boolean>(() => {
    return typeof window !== 'undefined' && getExamIdFromUrl() !== null;
  });
  const [isExamLoading, setIsExamLoading] = useState<boolean>(() => {
    return typeof window !== 'undefined' && getExamIdFromUrl() !== null;
  });

  const [currentSyncKey, setCurrentSyncKey] = useState<string>(() => cloudStorageService.getSyncKey());
  const [autoBackupEnabled, setAutoBackupEnabled] = useState<boolean>(() => cloudStorageService.isAutoBackupEnabled());
  const [autoBackupToast, setAutoBackupToast] = useState<string | null>(null);

  // Auto-backup function that immediately persists questions & exams to cloud server
  const triggerAutoBackup = (
    qList: Quiz[] = quizzes,
    cList: Classroom[] = classrooms,
    sList: ExamSession[] = sessions
  ) => {
    if (!autoBackupEnabled) return;
    cloudStorageService
      .syncToCloud(
        {
          quizzes: qList,
          classrooms: cList,
          sessions: sList,
          submissions,
        },
        currentSyncKey
      )
      .then((res) => {
        if (res.success) {
          setAutoBackupToast(`✓ Đã tự động lưu lên máy chủ: ${new Date().toLocaleTimeString('vi-VN')}`);
          setTimeout(() => setAutoBackupToast(null), 3500);
        }
      });
  };

  // URL Routing check for direct student exam link (?exam=... or #exam/...)
  useEffect(() => {
    const handleUrlRouting = () => {
      const examParam = getExamIdFromUrl();
      if (examParam) {
        setIsDirectStudentMode(true);
        setIsExamLoading(true);
        setAppMode('student');

        // ALWAYS fetch live exam & questions from server to ensure 100% updated teacher questions!
        cloudStorageService
          .fetchExamFromServer(examParam)
          .then((res) => {
            if (res.found && res.questions && res.questions.length > 0) {
              const fetchedQuestions = res.questions;
              const title = res.session?.title || res.quiz?.title || 'Bài kiểm tra trực tuyến';

              const updatedSess: ExamSession = {
                id: res.session?.id || examParam,
                title,
                quizId: res.session?.quizId || res.quiz?.id || 'quiz-' + examParam,
                className: res.session?.className || 'Khối 12',
                startTime: res.session?.startTime || 'Đang mở',
                endTime: res.session?.endTime || 'Sau 30 ngày',
                status: 'active',
                shareUrl: getStudentExamShareUrl(examParam),
                allowedAttempts: res.session?.allowedAttempts || 5,
                durationMinutes: res.session?.durationMinutes || res.quiz?.durationMinutes || 45,
                totalSubmissions: 0,
                maxSlots: 500,
                isArenaMode: true,
                questionCount: fetchedQuestions.length,
                questions: fetchedQuestions,
                scoringConfig: res.session?.scoringConfig || {
                  totalPoints: 10,
                  durationMinutes: 45,
                  part1PointPerQuestion: 0.25,
                  part2PointPerQuestion: 1.0,
                  part3PointPerQuestion: 0.25,
                  allowViewAnswerKey: true,
                  viewAnswerMinScore: 4.0,
                  allowAiTutorExplanation: true,
                }
              };

              setActiveStudentExamSession(updatedSess);
              setActiveStudentExamTitle(title);
              setSessions((prev) => [updatedSess, ...prev.filter((s) => s.id !== updatedSess.id)]);

              if (res.quiz) {
                setQuizzes((prev) => [{ ...res.quiz!, questions: fetchedQuestions }, ...prev.filter((q) => q.id !== res.quiz?.id)]);
              }
            } else {
              // Fallback to local state if server has not synced yet
              const localSess = sessions.find((s) => s.id === examParam || s.quizId === examParam);
              const localQuiz = quizzes.find(
                (q) =>
                  q.id === examParam ||
                  q.title.toLowerCase() === examParam.toLowerCase() ||
                  examParam.startsWith(q.id.slice(0, 6))
              );

              if (localSess && localSess.questions && localSess.questions.length > 0) {
                setActiveStudentExamSession(localSess);
                setActiveStudentExamTitle(localSess.title);
              } else if (localQuiz && localQuiz.questions && localQuiz.questions.length > 0) {
                setActiveStudentExamTitle(localQuiz.title);
                setActiveStudentExamSession({
                  id: 'sess-' + localQuiz.id,
                  title: localQuiz.title,
                  quizId: localQuiz.id,
                  className: 'Khối 12',
                  startTime: 'Vừa tạo',
                  endTime: 'Sau 30 ngày',
                  status: 'active',
                  shareUrl: getStudentExamShareUrl(localQuiz.id),
                  allowedAttempts: 5,
                  durationMinutes: localQuiz.durationMinutes || 50,
                  totalSubmissions: 0,
                  maxSlots: 500,
                  isArenaMode: localQuiz.isInteractive,
                  questions: localQuiz.questions,
                });
              }
            }
          })
          .finally(() => {
            setIsExamLoading(false);
          });
      }
    };

    handleUrlRouting();
    window.addEventListener('popstate', handleUrlRouting);
    return () => window.removeEventListener('popstate', handleUrlRouting);
  }, []);

  // Load persistent cloud state on mount using teacher's Sync Key
  useEffect(() => {
    cloudStorageService.fetchFromCloud(currentSyncKey).then((cloudData) => {
      if (cloudData) {
        if (cloudData.quizzes && cloudData.quizzes.length > 0) {
          setQuizzes(cloudData.quizzes);
        }
        if (cloudData.classrooms && cloudData.classrooms.length > 0) {
          const cleanClassrooms = cloudData.classrooms.filter(
            (c) => c.code !== '12A5MT' && c.code !== 'CNNN25' && c.code !== 'CN12TN' && !c.name.includes('THPT MANG THÍT')
          );
          setClassrooms(cleanClassrooms);
        }
        if (cloudData.sessions && cloudData.sessions.length > 0) {
          setSessions(cloudData.sessions);
        }
      }
    });
  }, [currentSyncKey]);

  // Auto-publish all existing sessions & quizzes to server on teacher mount
  useEffect(() => {
    if (!isDirectStudentMode && (quizzes.length > 0 || sessions.length > 0)) {
      sessions.forEach((s) => {
        const linkedQuiz = quizzes.find((q) => q.id === s.quizId || q.title === s.title);
        const qList = (s.questions && s.questions.length > 0) ? s.questions : (linkedQuiz?.questions || []);
        cloudStorageService.publishExamDirectly({
          session: { ...s, questions: qList },
          quiz: linkedQuiz,
          questions: qList
        }).catch(() => {});
      });
    }
  }, [sessions.length, quizzes.length, isDirectStudentMode]);

  // Real-time synchronization
  useEffect(() => {
    const unsubscribe = realtimeEngine.subscribe((event) => {
      if (event.type === 'NEW_SUBMISSION') {
        const sub = event.data as StudentSubmission;
        setSubmissions(realtimeEngine.getSubmissions());
        setLatestToastSub(sub);
      } else if (event.type === 'METRICS_UPDATE') {
        const updated = realtimeEngine.getMetrics();
        setMetrics(updated);
        setIs500SimActive(updated.is500SimulationActive);
      }
    });

    return () => unsubscribe();
  }, []);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!latestToastSub) return;
    const timer = setTimeout(() => {
      setLatestToastSub(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [latestToastSub]);

  const handleToggle500Sim = () => {
    const newState = realtimeEngine.toggle500Simulation();
    setIs500SimActive(newState);
    setMetrics(realtimeEngine.getMetrics());
    if (newState) {
      soundEffects.playCorrect();
    }
  };

  const handleToggleSound = () => {
    const newSetting = soundEffects.toggleSound();
    setSoundEnabled(newSetting);
  };

  const handleCreateClassroom = (newClass: Omit<Classroom, 'id' | 'createdAt' | 'students'>) => {
    const created: Classroom = {
      ...newClass,
      id: 'cls-' + Date.now(),
      createdAt: new Date().toLocaleDateString('vi-VN'),
      students: [
        { id: 'st-new-1', fullName: 'Võ Minh Quân', studentCode: '26CN' + Math.floor(100 + Math.random() * 800), completedExams: 1, lastScore: 9.5 }
      ]
    };
    const updated = [created, ...classrooms];
    setClassrooms(updated);
    triggerAutoBackup(quizzes, updated, sessions);
  };

  const handleSaveQuiz = (newQuiz: Quiz) => {
    const updated = [newQuiz, ...quizzes];
    setQuizzes(updated);
    cloudStorageService.publishExamDirectly({
      quiz: newQuiz,
      questions: newQuiz.questions
    }).catch(() => {});
    if (newQuiz.folder) {
      try {
        const saved = localStorage.getItem('testonline_custom_folders');
        const list = saved ? JSON.parse(saved) : [];
        if (!list.includes(newQuiz.folder)) {
          list.push(newQuiz.folder);
          localStorage.setItem('testonline_custom_folders', JSON.stringify(list));
        }
      } catch {
        // ignore
      }
    }
    triggerAutoBackup(updated, classrooms, sessions);
  };

  const handleUpdateQuiz = (updatedQuiz: Quiz) => {
    const updated = quizzes.map((q) => (q.id === updatedQuiz.id ? updatedQuiz : q));
    setQuizzes(updated);
    cloudStorageService.publishExamDirectly({
      quiz: updatedQuiz,
      questions: updatedQuiz.questions
    }).catch(() => {});
    triggerAutoBackup(updated, classrooms, sessions);
  };

  const handleDeployQuiz = (quiz: Quiz) => {
    const newSessionId = 'sess-' + Math.floor(1000000 + Math.random() * 9000000);
    const newSession: ExamSession = {
      id: newSessionId,
      title: quiz.title,
      quizId: quiz.id,
      className: 'Tất cả các lớp (Khối 12)',
      startTime: 'Vừa tạo',
      endTime: 'Sau 30 ngày',
      status: 'active',
      shareUrl: getStudentExamShareUrl(newSessionId),
      allowedAttempts: 5,
      durationMinutes: quiz.durationMinutes || 50,
      totalSubmissions: 0,
      maxSlots: 500,
      isArenaMode: quiz.isInteractive,
      questionCount: (quiz.questions && quiz.questions.length > 0) ? quiz.questions.length : quiz.questionCount,
      questions: quiz.questions,
      scoringConfig: {
        totalPoints: 10,
        durationMinutes: quiz.durationMinutes || 50,
        part1PointPerQuestion: 0.25,
        part2PointPerQuestion: 1.0,
        part3PointPerQuestion: 0.25,
        allowViewAnswerKey: true,
        viewAnswerMinScore: 4.0,
        allowAiTutorExplanation: true,
      },
      antiCheatConfig: {
        maxTabSwitches: 3,
        autoSubmitOnExceed: true,
        requireFullscreen: false,
        preventCopyPaste: true,
        shuffleQuestions: true,
        shuffleOptions: true,
        blockAIInExam: true
      }
    };
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    cloudStorageService.publishExamDirectly({
      session: newSession,
      quiz,
      questions: newSession.questions
    }).catch(() => {});
    triggerAutoBackup(quizzes, classrooms, updatedSessions);
    setCurrentTab('online-sessions');
  };

  const handleClearJunkData = () => {
    // Keep only authentic THPT Mang Thit mock collections and clean temporary caches
    realtimeEngine.clearSubmissions();
    setSubmissions([]);
    localStorage.removeItem('testonline_active_draft');
  };

  // Helper to ensure 100% of authored questions are retrieved without dropping any questions
  const getExamQuestions = (targetSession?: ExamSession | null, targetTitle?: string): Question[] => {
    // 1. Direct Session Questions (Top Priority: Exactly what was authored & deployed for this session)
    if (targetSession?.questions && targetSession.questions.length > 0) {
      return targetSession.questions;
    }
    // 2. By session quizId
    if (targetSession?.quizId) {
      const q = quizzes.find((quiz) => quiz.id === targetSession.quizId);
      if (q?.questions && q.questions.length > 0) return q.questions;
    }
    // 3. By title
    const searchTitle = targetTitle || targetSession?.title;
    if (searchTitle) {
      const q = quizzes.find((quiz) =>
        quiz.title.toLowerCase().trim() === searchTitle.toLowerCase().trim() ||
        searchTitle.toLowerCase().includes(quiz.title.toLowerCase()) ||
        quiz.title.toLowerCase().includes(searchTitle.toLowerCase())
      );
      if (q?.questions && q.questions.length > 0) return q.questions;
    }
    // 4. By URL exam param
    const urlId = getExamIdFromUrl();
    if (urlId) {
      const q = quizzes.find((quiz) => quiz.id === urlId || quiz.id.startsWith(urlId.slice(0, 6)));
      if (q?.questions && q.questions.length > 0) return q.questions;
    }
    // 5. In direct student mode: NEVER fallback to sample fake questions!
    if (isDirectStudentMode) {
      if (targetSession?.questions && targetSession.questions.length > 0) {
        return targetSession.questions;
      }
      return [];
    }

    // 6. Teacher preview fallback
    const firstWithQ = quizzes.find((quiz) => quiz.questions && quiz.questions.length > 0);
    return firstWithQ?.questions || [];
  };

  // ISOLATED DIRECT STUDENT MODE (When student accesses via shared link)
  // Absolutely no TopNavbar, no Sidebar, no teacher administration controls
  if (isDirectStudentMode) {
    if (isExamLoading) {
      return (
        <div className="min-h-screen bg-[#04181b] bg-gradient-to-b from-[#062024] via-[#082a30] to-[#04171a] flex flex-col items-center justify-center font-sans text-slate-100 p-6">
          <div className="bg-[#0b383f]/95 border-2 border-teal-400/50 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-5 backdrop-blur-md">
            <div className="w-16 h-16 mx-auto rounded-full bg-teal-500/20 border-2 border-teal-400 flex items-center justify-center text-teal-300 animate-spin">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Hệ Thống Khảo Thí Trực Tuyến</h2>
              <p className="text-xs text-teal-200/90 mt-1 font-medium">Đang kết nối máy chủ & đồng bộ bộ đề thi của Giáo viên...</p>
            </div>
            <div className="w-full bg-teal-950/80 rounded-full h-2 overflow-hidden border border-teal-500/30">
              <div className="bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-300 h-full w-3/4 animate-pulse"></div>
            </div>
            <span className="text-[11px] text-teal-300/70 font-mono block">Zero-Cache • Realtime Server Sync</span>
          </div>
        </div>
      );
    }

    const questionsToServe = getExamQuestions(activeStudentExamSession, activeStudentExamTitle);

    // If questions are not yet loaded from server, display retry screen instead of showing wrong questions
    if (questionsToServe.length === 0) {
      return (
        <div className="min-h-screen bg-[#04181b] bg-gradient-to-b from-[#062024] via-[#082a30] to-[#04171a] flex flex-col items-center justify-center font-sans text-slate-100 p-6">
          <div className="bg-[#0b383f]/95 border-2 border-amber-400/50 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-5 backdrop-blur-md">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-300">
              <Sparkles className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Đang tải đề thi chính thức</h2>
              <p className="text-xs text-teal-200/90 mt-1 font-medium">
                Hệ thống đang tải toàn bộ câu hỏi do Giáo viên biên soạn từ máy chủ. Vui lòng bấm nút bên dưới nếu đường truyền mạng chậm:
              </p>
            </div>
            <div className="space-y-3 pt-2">
              <button
                onClick={() => {
                  const examParam = getExamIdFromUrl() || 'sess-default';
                  setIsExamLoading(true);
                  cloudStorageService.fetchExamFromServer(examParam).then((res) => {
                    if (res.found && res.questions && res.questions.length > 0) {
                      const updatedSess: ExamSession = {
                        id: examParam,
                        title: res.session?.title || res.quiz?.title || 'Bài kiểm tra trực tuyến',
                        quizId: res.session?.quizId || res.quiz?.id || 'quiz-' + examParam,
                        className: res.session?.className || 'Khối 12',
                        startTime: 'Đang mở',
                        endTime: '31/12/2026',
                        status: 'active',
                        shareUrl: getStudentExamShareUrl(examParam),
                        allowedAttempts: 5,
                        durationMinutes: res.session?.durationMinutes || res.quiz?.durationMinutes || 45,
                        totalSubmissions: 0,
                        maxSlots: 500,
                        isArenaMode: true,
                        questionCount: res.questions.length,
                        questions: res.questions,
                      };
                      setActiveStudentExamSession(updatedSess);
                      setActiveStudentExamTitle(updatedSess.title);
                    }
                  }).finally(() => setIsExamLoading(false));
                }}
                className="btn-3d btn-3d-teal w-full py-3 text-xs rounded-xl font-black cursor-pointer shadow-lg text-white"
              >
                🔄 Bấm vào đây để tải lại đề thi từ Máy Chủ
              </button>

              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="w-full py-2 text-[11px] font-bold text-teal-300 hover:text-white transition-colors cursor-pointer"
              >
                ✨ Làm mới trang web (F5 / Refresh)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-900 bg-gradient-to-b from-[#062024] via-[#082a30] to-[#04171a] flex flex-col font-sans text-slate-100">
        <main className="flex-1 max-w-5xl mx-auto w-full p-2 sm:p-4 md:p-6 flex flex-col justify-center">
          <StudentArenaView
            quizTitle={activeStudentExamTitle || activeStudentExamSession?.title || 'Bài kiểm tra trực tuyến'}
            session={activeStudentExamSession || sessions[0]}
            customQuestions={questionsToServe}
            isDirectStudentMode={true}
            onExit={() => {
              // Direct student mode: student stays within their exam interface
            }}
            onResultSubmitted={() => {
              // result submitted callback
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Navbar Toolbar */}
      <TopNavbar
        appMode={appMode}
        onSwitchMode={(mode) => {
          setAppMode(mode);
          if (mode === 'student') {
            setActiveStudentExamTitle('ÔN CN12-1-2-3 (Đề chuẩn TT 7991)');
          }
        }}
        is500SimActive={is500SimActive}
        onToggle500Sim={handleToggle500Sim}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onNavigateToLiveMonitor={() => {
          setAppMode('teacher');
          setCurrentTab('live-monitor');
        }}
        onOpenCloudModal={() => setIsCloudModalOpen(true)}
        autoBackupEnabled={autoBackupEnabled}
        syncKey={currentSyncKey}
      />

      {/* Main Workspace Body */}
      {appMode === 'student' ? (
        <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6">
          <StudentArenaView
            quizTitle={activeStudentExamTitle}
            session={activeStudentExamSession || sessions[0]}
            customQuestions={getExamQuestions(activeStudentExamSession, activeStudentExamTitle)}
            onExit={() => setAppMode('teacher')}
            onResultSubmitted={() => {
              // result submitted callback
            }}
          />
        </main>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation Sidebar */}
          <Sidebar
            currentTab={currentTab}
            onSelectTab={(tab) => setCurrentTab(tab)}
            pendingSubmissionsCount={submissions.length}
          />

          {/* Right Display Viewport */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50">
            <div className="max-w-7xl mx-auto">
              {currentTab === 'dashboard' && (
                <DashboardView
                  onNavigate={(tab) => setCurrentTab(tab)}
                  onOpenStudentExam={() => {
                    setActiveStudentExamTitle('ÔN CN12-1-2-3');
                    setAppMode('student');
                  }}
                  metrics={metrics}
                  recentSubmissionsCount={submissions.length}
                />
              )}



              {currentTab === 'quizzes' && (
                <QuizManagementView
                  quizzes={quizzes}
                  onCreateQuiz={() => setIsCreateQuizModalOpen(true)}
                  onDeployQuiz={handleDeployQuiz}
                  onPreviewQuiz={(q) => {
                    setActiveStudentExamTitle(q.title);
                    setAppMode('student');
                  }}
                  onEditQuiz={(q) => {
                    setQuizToEdit(q);
                    setIsEditQuizModalOpen(true);
                  }}
                  onDuplicateQuiz={(q) => {
                    const dup: Quiz = {
                      ...q,
                      id: 'quiz-' + Date.now(),
                      title: q.title + ' (Bản sao)',
                      fileName: 'Ban_sao_' + q.fileName,
                      createdAt: new Date().toLocaleDateString('vi-VN')
                    };
                    setQuizzes((prev) => [dup, ...prev]);
                    soundEffects.playCorrect();
                  }}
                  onDeleteQuiz={(quizId) => {
                    const updatedQuizzes = quizzes.filter((q) => q.id !== quizId);
                    const updatedSessions = sessions.filter((s) => s.quizId !== quizId);
                    setQuizzes(updatedQuizzes);
                    setSessions(updatedSessions);
                    triggerAutoBackup(updatedQuizzes, classrooms, updatedSessions);
                  }}
                />
              )}

              {currentTab === 'online-sessions' && (
                <OnlineSessionsView
                  sessions={sessions}
                  quizzes={quizzes}
                  submissions={submissions}
                  classrooms={classrooms}
                  onCreateSession={() => setIsCreateQuizModalOpen(true)}
                  onOpenLiveMonitor={() => setCurrentTab('live-monitor')}
                  onOpenAttendanceSummary={(sess) => {
                    setSelectedSummarySessionId(sess.id);
                    setCurrentTab('attendance-summary');
                  }}
                  onOpenStudentExam={(sessId) => {
                    const sess = sessions.find((s) => s.id === sessId);
                    if (sess) {
                      setActiveStudentExamSession(sess);
                      setActiveStudentExamTitle(sess.title);
                    }
                    setAppMode('student');
                  }}
                  onToggleSessionStatus={(sessId) => {
                    const updated = sessions.map((s) => (s.id === sessId ? { ...s, status: (s.status === 'active' ? 'completed' : 'active') as 'active' | 'completed' } : s));
                    setSessions(updated);
                    triggerAutoBackup(quizzes, classrooms, updated);
                  }}
                  onDeleteSession={(sessId) => {
                    const updatedSessions = sessions.filter((s) => s.id !== sessId);
                    setSessions(updatedSessions);
                    try {
                      localStorage.removeItem(`testonline_draft_${sessId}`);
                    } catch {
                      // ignore
                    }
                    triggerAutoBackup(quizzes, classrooms, updatedSessions);
                  }}
                  onAddNewSession={(newSess) => {
                    const updatedSessions = [newSess, ...sessions];
                    setSessions(updatedSessions);
                    cloudStorageService.publishExamDirectly({
                      session: newSess,
                      questions: newSess.questions
                    }).catch(() => {});
                    triggerAutoBackup(quizzes, classrooms, updatedSessions);
                  }}
                  onUpdateSession={(updatedSess) => {
                    const updatedSessions = sessions.map((s) => (s.id === updatedSess.id ? updatedSess : s));
                    setSessions(updatedSessions);
                    triggerAutoBackup(quizzes, classrooms, updatedSessions);
                  }}
                  onResetStudentAttempts={(sessId, studentName) => {
                    try {
                      localStorage.removeItem(`testonline_attempts_${sessId}_${studentName.trim()}`);
                      setSubmissions((prev) =>
                        prev.filter(
                          (s) =>
                            !(
                              s.sessionId === sessId &&
                              s.studentName.trim().toLowerCase() === studentName.trim().toLowerCase()
                            )
                        )
                      );
                      soundEffects.playCorrect();
                    } catch {
                      // ignore
                    }
                  }}
                />
              )}

              {currentTab === 'attendance-summary' && (
                <ExamSummaryAttendanceView
                  sessions={sessions}
                  quizzes={quizzes}
                  classrooms={classrooms}
                  submissions={submissions}
                  selectedSessionId={selectedSummarySessionId}
                  onSelectSession={(sessId) => setSelectedSummarySessionId(sessId)}
                  onOpenStudentExam={(sessId) => {
                    const sess = sessions.find((s) => s.id === sessId);
                    if (sess) {
                      setActiveStudentExamSession(sess);
                      setActiveStudentExamTitle(sess.title);
                    }
                    setAppMode('student');
                  }}
                  onResetStudentAttempts={(sessId, studentName) => {
                    try {
                      localStorage.removeItem(`testonline_attempts_${sessId}_${studentName.trim()}`);
                      setSubmissions((prev) =>
                        prev.filter(
                          (s) =>
                            !(
                              s.sessionId === sessId &&
                              s.studentName.trim().toLowerCase() === studentName.trim().toLowerCase()
                            )
                        )
                      );
                      soundEffects.playCorrect();
                      alert(`Đã cấp quyền cho học sinh "${studentName}" được thi lại từ đầu!`);
                    } catch {
                      // ignore
                    }
                  }}
                />
              )}


              {currentTab === 'live-monitor' && (
                <Live500StressTestMonitor
                  metrics={metrics}
                  submissions={submissions}
                  isSimulating={is500SimActive}
                  onToggleSimulation={handleToggle500Sim}
                  onClearSubmissions={() => {
                    realtimeEngine.clearSubmissions();
                    setSubmissions(realtimeEngine.getSubmissions());
                  }}
                />
              )}

              {currentTab === 'account' && (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-2xl shadow-xs space-y-6">
                  <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
                      K
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Thầy Hồ Tấn Khải</h2>
                      <p className="text-xs text-slate-500 font-mono">hotankhai@thptmangthit.edu.vn</p>
                      <span className="inline-block mt-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        Tác giả & Quản trị viên hệ thống Test Online
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <span className="font-semibold text-slate-600 flex items-center gap-2">
                        <School className="w-4 h-4 text-teal-600" /> Đơn vị công tác:
                      </span>
                      <span className="font-bold text-slate-900">Hệ Thống Trực Tuyến GDPT</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <span className="font-semibold text-slate-600 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" /> Hệ thống thi trắc nghiệm:
                      </span>
                      <span className="font-bold text-emerald-700 font-mono">Test Online 500 Slots Real-time</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <span className="font-semibold text-slate-600 flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-blue-600" /> Đám mây & Sao lưu:
                      </span>
                      <span className="font-bold text-blue-700 font-mono">Google Drive & Cloud Server Connected</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* Real-time incoming submission toast */}
      <LiveNotificationToast
        submission={latestToastSub}
        onDismiss={() => setLatestToastSub(null)}
        onClick={() => {
          setAppMode('teacher');
          setCurrentTab('live-monitor');
          setLatestToastSub(null);
        }}
      />

      {/* Create Quiz Modal with AI Gemini */}
      <CreateQuizModal
        isOpen={isCreateQuizModalOpen}
        onClose={() => setIsCreateQuizModalOpen(false)}
        onSaveQuiz={handleSaveQuiz}
        availableFolders={Array.from(new Set(['CÔNG NGHỆ 12', 'ĐỀ THI HỌC KỲ', 'KIỂM TRA 15 PHÚT', ...quizzes.map(q => q.folder).filter(Boolean) as string[]]))}
      />

      {/* Edit Quiz Modal */}
      <EditQuizModal
        quiz={quizToEdit}
        isOpen={isEditQuizModalOpen}
        onClose={() => {
          setIsEditQuizModalOpen(false);
          setQuizToEdit(null);
        }}
        onSave={handleUpdateQuiz}
      />

      {/* Cloud & Google Drive Storage Modal */}
      <CloudDriveModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        quizzes={quizzes}
        classrooms={classrooms}
        sessions={sessions}
        submissions={submissions}
        autoBackupEnabled={autoBackupEnabled}
        onToggleAutoBackup={(val) => {
          setAutoBackupEnabled(val);
          cloudStorageService.setAutoBackupEnabled(val);
        }}
        currentSyncKey={currentSyncKey}
        onChangeSyncKey={(key) => setCurrentSyncKey(key)}
        onDataRestored={(data) => {
          if (data.quizzes) setQuizzes(data.quizzes);
          if (data.classrooms) setClassrooms(data.classrooms);
          if (data.sessions) setSessions(data.sessions);
        }}
        onClearJunkData={handleClearJunkData}
      />

      {/* Auto-backup toast indicator */}
      {autoBackupToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-emerald-950/90 text-emerald-200 border border-emerald-400 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{autoBackupToast}</span>
        </div>
      )}
    </div>
  );
}
