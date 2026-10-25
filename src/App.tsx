import React, { useState, useEffect } from 'react';
import { ActiveTab, Classroom, ConcurrentSystemMetrics, ExamSession, Quiz, StudentSubmission } from './types/quiz';
import { mockQuizzes, mockClassrooms, mockSessions } from './data/mockData';
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

  // URL Routing check for direct student exam link (?exam=... or #exam/...)
  useEffect(() => {
    const handleUrlRouting = () => {
      const examParam = getExamIdFromUrl();
      if (examParam) {
        setIsDirectStudentMode(true);
        setAppMode('student');

        // 1. Look for matching session
        const matchedSess = sessions.find(
          (s) => s.id === examParam || s.quizId === examParam
        );
        if (matchedSess) {
          setActiveStudentExamSession(matchedSess);
          setActiveStudentExamTitle(matchedSess.title);
          return;
        }

        // 2. Look for matching quiz
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

  // Load persistent cloud state on mount
  useEffect(() => {
    cloudStorageService.fetchFromCloud().then((cloudData) => {
      if (cloudData) {
        if (cloudData.quizzes && cloudData.quizzes.length > 0) setQuizzes(cloudData.quizzes);
        if (cloudData.classrooms && cloudData.classrooms.length > 0) setClassrooms(cloudData.classrooms);
        if (cloudData.sessions && cloudData.sessions.length > 0) setSessions(cloudData.sessions);
      }
    });
  }, []);

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
    setClassrooms((prev) => [created, ...prev]);
  };

  const handleSaveQuiz = (newQuiz: Quiz) => {
    setQuizzes((prev) => [newQuiz, ...prev]);
  };

  const handleUpdateQuiz = (updated: Quiz) => {
    setQuizzes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
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
    setSessions((prev) => [newSession, ...prev]);
    setCurrentTab('online-sessions');
  };

  const handleClearJunkData = () => {
    // Keep only authentic THPT Mang Thit mock collections and clean temporary caches
    realtimeEngine.clearSubmissions();
    setSubmissions([]);
    localStorage.removeItem('testonline_active_draft');
  };

  // ISOLATED DIRECT STUDENT MODE (When student accesses via shared link)
  // Absolutely no TopNavbar, no Sidebar, no teacher administration controls
  if (isDirectStudentMode) {
    const currentExamId = getExamIdFromUrl();
    const activeQuiz =
      quizzes.find((q) => q.id === activeStudentExamSession?.quizId || q.title === activeStudentExamTitle) ||
      (currentExamId ? quizzes.find((q) => q.id === currentExamId || currentExamId.startsWith(q.id.slice(0, 6))) : null) ||
      quizzes[0];

    const questionsToServe = (activeQuiz?.questions && activeQuiz.questions.length > 0)
      ? activeQuiz.questions
      : undefined;

    return (
      <div className="min-h-screen bg-[#140b22] flex flex-col font-sans text-slate-800">
        <main className="flex-1 max-w-5xl mx-auto w-full p-2 sm:p-4 md:p-6 flex flex-col justify-center">
          <StudentArenaView
            quizTitle={activeStudentExamTitle || activeQuiz?.title || 'Bài kiểm tra trực tuyến'}
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
            setActiveStudentExamTitle('ÔN CN12-1-2-3');
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
      />

      {/* Main Workspace Body */}
      {appMode === 'student' ? (
        <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6">
          <StudentArenaView
            quizTitle={activeStudentExamTitle}
            session={activeStudentExamSession || sessions[0]}
            customQuestions={
              quizzes.find(
                (q) => q.title === activeStudentExamTitle || q.id === activeStudentExamSession?.quizId
              )?.questions
            }
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
        onDataRestored={(data) => {
          if (data.quizzes) setQuizzes(data.quizzes);
          if (data.classrooms) setClassrooms(data.classrooms);
          if (data.sessions) setSessions(data.sessions);
        }}
        onClearJunkData={handleClearJunkData}
      />
    </div>
  );
}
