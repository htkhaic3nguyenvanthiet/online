import React, { useState, useEffect } from 'react';
import { ActiveTab, Classroom, ConcurrentSystemMetrics, ExamSession, Quiz, StudentSubmission } from './types/quiz';
import { mockQuizzes, mockClassrooms, mockSessions } from './data/mockData';
import { realtimeEngine } from './services/realtimeEngine';
import { soundEffects } from './utils/soundEffects';

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
import { LiveNotificationToast } from './components/LiveNotificationToast';
import { Award, School, UserCheck, ShieldCheck } from 'lucide-react';

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
  const [latestToastSub, setLatestToastSub] = useState<StudentSubmission | null>(null);
  const [activeStudentExamTitle, setActiveStudentExamTitle] = useState('ÔN CN12-1-2-3');

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

  const handleDeployQuiz = (quiz: Quiz) => {
    const newSession: ExamSession = {
      id: 'sess-' + Date.now(),
      title: quiz.title,
      quizId: quiz.id,
      className: 'Tất cả các lớp',
      startTime: 'Vừa tạo',
      endTime: 'Sau 7 ngày',
      status: 'active',
      shareUrl: `https://youngtest.vn/quiz-advance/take/${quiz.id.slice(0, 6)}/start`,
      allowedAttempts: 5,
      durationMinutes: quiz.durationMinutes,
      totalSubmissions: 0,
      maxSlots: 500,
      isArenaMode: quiz.isInteractive
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentTab('online-sessions');
  };

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
      />

      {/* Main Workspace Body */}
      {appMode === 'student' ? (
        <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6">
          <StudentArenaView
            quizTitle={activeStudentExamTitle}
            onExit={() => setAppMode('teacher')}
            onResultSubmitted={() => {
              // when submitted, user can review or jump back
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

          {/* Right Display Viewport ("bên phải là khung hiển thị") */}
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
                  onDeleteQuiz={(quizId) => {
                    setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
                  }}
                />
              )}

              {currentTab === 'online-sessions' && (
                <OnlineSessionsView
                  sessions={sessions}
                  onCreateSession={() => setIsCreateQuizModalOpen(true)}
                  onOpenLiveMonitor={() => setCurrentTab('live-monitor')}
                  onOpenStudentExam={(sessId) => {
                    const sess = sessions.find((s) => s.id === sessId);
                    if (sess) setActiveStudentExamTitle(sess.title);
                    setAppMode('student');
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

      {/* Create Quiz Modal */}
      <CreateQuizModal
        isOpen={isCreateQuizModalOpen}
        onClose={() => setIsCreateQuizModalOpen(false)}
        onSaveQuiz={handleSaveQuiz}
      />
    </div>
  );
}
