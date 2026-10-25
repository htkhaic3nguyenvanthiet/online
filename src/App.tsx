import React, { useState, useEffect } from 'react';
import { ActiveTab, Classroom, ConcurrentSystemMetrics, ExamSession, Quiz, StudentSubmission, Question } from './types/quiz';
import { mockQuizzes, mockClassrooms, mockSessions, sampleQuestions } from './data/mockData';
import { realtimeEngine } from './services/realtimeEngine';
import { soundEffects } from './utils/soundEffects';
import { cloudStorageService } from './services/cloudStorageService';
import { getStudentExamShareUrl, getExamIdFromUrl } from './utils/urlHelper';

import { TopNavbar } from './components/TopNavbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { QuizManagementView } from './components/QuizManagementView';
import { ClassroomsView } from './components/ClassroomsView';
import { OnlineSessionsView } from './components/OnlineSessionsView';
import { GameArenaTeacherView } from './components/GameArenaTeacherView';
import { SharedContentStoreView } from './components/SharedContentStoreView';
import { PaperExamView } from './components/PaperExamView';
import { OfflineExamView } from './components/OfflineExamView';
import { Live500StressTestMonitor } from './components/Live500StressTestMonitor';
import { StudentArenaView } from './components/StudentArenaView';
import { CreateQuizModal } from './components/CreateQuizModal';
import { EditQuizModal } from './components/EditQuizModal';
import { CloudDriveModal } from './components/CloudDriveModal';
import { LiveNotificationToast } from './components/LiveNotificationToast';
import { Award, School, UserCheck, ShieldCheck, Cloud, Sparkles } from 'lucide-react';

export default function App() {
  const [appMode, setAppMode] = useState<'teacher' | 'student'>('teacher');
  const [currentTab, setCurrentTab] = useState<ActiveTab>('dashboard');

  const [quizzes, setQuizzes] = useState<Quiz[]>(mockQuizzes);
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
        setAppMode('student');

        // Always attempt to fetch live exam from server so student gets newly uploaded questions immediately!
        cloudStorageService.fetchExamFromServer(examParam).then((res) => {
          if (res.found && res.quiz) {
            if (res.quiz.questions && res.quiz.questions.length > 0) {
              setQuizzes((prev) => {
                const exists = prev.some((q) => q.id === res.quiz?.id);
                return exists ? prev.map((q) => (q.id === res.quiz?.id ? res.quiz! : q)) : [res.quiz!, ...prev];
              });
            }
            if (res.session) {
              setActiveStudentExamSession(res.session);
              setActiveStudentExamTitle(res.session.title);
            } else {
              setActiveStudentExamTitle(res.quiz.title);
            }
          }
        });

        // 1. Look for matching session in local state
        const matchedSess = sessions.find(
          (s) => s.id === examParam || s.quizId === examParam
        );
        if (matchedSess) {
          setActiveStudentExamSession(matchedSess);
          setActiveStudentExamTitle(matchedSess.title);
          return;
        }

        // 2. Look for matching quiz in local state
        const matchedQuiz = quizzes.find(
          (q) =>
            q.id === examParam ||
            q.title.toLowerCase() === examParam.toLowerCase() ||
            examParam.startsWith(q.id.slice(0, 6))
        );
        if (matchedQuiz) {
          setActiveStudentExamTitle(matchedQuiz.title);
          setActiveStudentExamSession({
            id: 'sess-' + matchedQuiz.id,
            title: matchedQuiz.title,
            quizId: matchedQuiz.id,
            className: 'Khối 12',
            startTime: 'Vừa tạo',
            endTime: 'Sau 30 ngày',
            status: 'active',
            shareUrl: getStudentExamShareUrl(matchedQuiz.id),
            allowedAttempts: 5,
            durationMinutes: matchedQuiz.durationMinutes || 45,
            totalSubmissions: 0,
            maxSlots: 500,
            isArenaMode: matchedQuiz.isInteractive
          });
        }
      }
    };

    handleUrlRouting();
    window.addEventListener('popstate', handleUrlRouting);
    return () => window.removeEventListener('popstate', handleUrlRouting);
  }, [sessions, quizzes]);

  // Load persistent cloud state on mount using teacher's Sync Key
  useEffect(() => {
    cloudStorageService.fetchFromCloud(currentSyncKey).then((cloudData) => {
      if (cloudData) {
        if (cloudData.quizzes && cloudData.quizzes.length > 0) setQuizzes(cloudData.quizzes);
        if (cloudData.classrooms && cloudData.classrooms.length > 0) setClassrooms(cloudData.classrooms);
        if (cloudData.sessions && cloudData.sessions.length > 0) setSessions(cloudData.sessions);
      }
    });
  }, [currentSyncKey]);

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
    triggerAutoBackup(updated, classrooms, sessions);
  };

  const handleUpdateQuiz = (updatedQuiz: Quiz) => {
    const updated = quizzes.map((q) => (q.id === updatedQuiz.id ? updatedQuiz : q));
    setQuizzes(updated);
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
      durationMinutes: quiz.durationMinutes,
      totalSubmissions: 0,
      maxSlots: 500,
      isArenaMode: quiz.isInteractive
    };
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
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
    // 1. By session quizId
    if (targetSession?.quizId) {
      const q = quizzes.find((quiz) => quiz.id === targetSession.quizId);
      if (q?.questions && q.questions.length > 0) return q.questions;
    }
    // 2. By title
    const searchTitle = targetTitle || targetSession?.title;
    if (searchTitle) {
      const q = quizzes.find((quiz) =>
        quiz.title.toLowerCase().trim() === searchTitle.toLowerCase().trim() ||
        searchTitle.toLowerCase().includes(quiz.title.toLowerCase()) ||
        quiz.title.toLowerCase().includes(searchTitle.toLowerCase())
      );
      if (q?.questions && q.questions.length > 0) return q.questions;
    }
    // 3. By URL exam param
    const urlId = getExamIdFromUrl();
    if (urlId) {
      const q = quizzes.find((quiz) => quiz.id === urlId || quiz.id.startsWith(urlId.slice(0, 6)));
      if (q?.questions && q.questions.length > 0) return q.questions;
    }
    // 4. Fallback to first quiz with questions or sampleQuestions
    const firstWithQ = quizzes.find((quiz) => quiz.questions && quiz.questions.length > 0);
    return firstWithQ?.questions || sampleQuestions;
  };

  // ISOLATED DIRECT STUDENT MODE (When student accesses via shared link)
  // Absolutely no TopNavbar, no Sidebar, no teacher administration controls
  if (isDirectStudentMode) {
    const questionsToServe = getExamQuestions(activeStudentExamSession, activeStudentExamTitle);

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

              {currentTab === 'classes' && (
                <ClassroomsView
                  classrooms={classrooms}
                  onCreateClassroom={handleCreateClassroom}
                  onUpdateClassroom={(updated) => {
                    setClassrooms((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                  }}
                  onDeleteClassroom={(clsId) => {
                    setClassrooms((prev) => prev.filter((c) => c.id !== clsId));
                  }}
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
                    setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
                  }}
                />
              )}

              {currentTab === 'online-sessions' && (
                <OnlineSessionsView
                  sessions={sessions}
                  quizzes={quizzes}
                  onCreateSession={() => setIsCreateQuizModalOpen(true)}
                  onOpenLiveMonitor={() => setCurrentTab('live-monitor')}
                  onOpenStudentExam={(sessId) => {
                    const sess = sessions.find((s) => s.id === sessId);
                    if (sess) {
                      setActiveStudentExamSession(sess);
                      setActiveStudentExamTitle(sess.title);
                    }
                    setAppMode('student');
                  }}
                  onToggleSessionStatus={(sessId) => {
                    setSessions((prev) =>
                      prev.map((s) => (s.id === sessId ? { ...s, status: s.status === 'active' ? 'completed' : 'active' } : s))
                    );
                  }}
                  onDeleteSession={(sessId) => {
                    setSessions((prev) => prev.filter((s) => s.id !== sessId));
                  }}
                  onAddNewSession={(newSess) => {
                    setSessions((prev) => [newSess, ...prev]);
                  }}
                  onUpdateSession={(updatedSess) => {
                    setSessions((prev) => prev.map((s) => (s.id === updatedSess.id ? updatedSess : s)));
                  }}
                />
              )}

              {currentTab === 'game-arena' && (
                <GameArenaTeacherView
                  onStartStudentExam={(title) => {
                    setActiveStudentExamTitle(title);
                    setAppMode('student');
                  }}
                  onOpenLiveMonitor={() => setCurrentTab('live-monitor')}
                />
              )}

              {currentTab === 'kids-quiz' && (
                <GameArenaTeacherView
                  onStartStudentExam={(title) => {
                    setActiveStudentExamTitle('ĐỀ THIẾU NHI - ' + title);
                    setAppMode('student');
                  }}
                  onOpenLiveMonitor={() => setCurrentTab('live-monitor')}
                />
              )}

              {currentTab === 'shared-store' && (
                <SharedContentStoreView
                  onImportToMyLibrary={(title, subject, qCount) => {
                    const newQ: Quiz = {
                      id: 'sq-imp-' + Date.now(),
                      title,
                      fileName: title.replace(/\s+/g, '_').slice(0, 30) + '.docx',
                      subject,
                      grade: 'Lớp 12',
                      createdAt: new Date().toLocaleDateString('vi-VN'),
                      questionCount: qCount,
                      breakdown: `${qCount}-0-0-0`,
                      durationMinutes: 45,
                      totalPoints: 10,
                      folder: subject.toUpperCase(),
                      isInteractive: true,
                      questions: []
                    };
                    setQuizzes((prev) => [newQ, ...prev]);
                  }}
                />
              )}

              {currentTab === 'paper-exam' && <PaperExamView />}

              {currentTab === 'offline-exam' && <OfflineExamView />}

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
                      <span className="font-bold text-slate-900">Trường THPT Mang Thít - Vĩnh Long</span>
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
