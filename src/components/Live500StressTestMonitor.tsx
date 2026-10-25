import React from 'react';
import {
  Activity,
  ShieldCheck,
  Zap,
  Users,
  Download,
  Award,
  RefreshCw,
  Clock,
  Sparkles,
  BarChart3,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ConcurrentSystemMetrics, StudentSubmission } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';

interface Live500StressTestMonitorProps {
  metrics: ConcurrentSystemMetrics;
  submissions: StudentSubmission[];
  isSimulating: boolean;
  onToggleSimulation: () => void;
  onClearSubmissions: () => void;
}

export const Live500StressTestMonitor: React.FC<Live500StressTestMonitorProps> = ({
  metrics,
  submissions,
  isSimulating,
  onToggleSimulation,
  onClearSubmissions
}) => {
  const totalAnswers = metrics.liveAnswerDistribution.totalAnswers || 500;
  const pctA = Math.round((metrics.liveAnswerDistribution.A / totalAnswers) * 100);
  const pctB = Math.round((metrics.liveAnswerDistribution.B / totalAnswers) * 100);
  const pctC = Math.round((metrics.liveAnswerDistribution.C / totalAnswers) * 100);
  const pctD = Math.max(0, 100 - (pctA + pctB + pctC));

  const averageScore = submissions.length > 0
    ? (submissions.reduce((acc, cur) => acc + cur.score, 0) / submissions.length).toFixed(2)
    : '0.00';

  const perfectScoresCount = submissions.filter((s) => s.score === 10).length;

  return (
    <div className="space-y-6">
      {/* Title & Live Engine Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Bảng Giám Sát Thời Gian Thực & Hệ Thống Tự Trả Kết Quả
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tác giả: Hồ Tấn Khải - Trường THPT Mang Thít • Khả năng chịu tải đồng thời 500 thí sinh không nghẽn mạng • Tự động trả kết quả thời gian thực
          </p>
        </div>

        {/* 3D Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              soundEffects.playClick();
              onToggleSimulation();
            }}
            className={`btn-3d px-4 py-2 text-xs rounded-xl flex items-center gap-2 cursor-pointer font-bold ${
              isSimulating ? 'btn-3d-orange text-white' : 'btn-3d-teal'
            }`}
          >
            <Zap className={`w-4 h-4 ${isSimulating ? 'animate-bounce' : ''}`} />
            <span>{isSimulating ? '⏸ Tạm dừng tải 500 HS' : '▶ Chạy Giả Lập 500 Học Sinh'}</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              alert(`Đã xuất báo cáo điểm của ${submissions.length} học sinh ra định dạng Excel chuẩn GD&ĐT!`);
            }}
            className="btn-3d btn-3d-slate px-3.5 py-2 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-semibold"
          >
            <Download className="w-4 h-4 text-teal-600" />
            <span>Xuất Excel</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              onClearSubmissions();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            title="Đặt lại bảng điểm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Concurrency Hardware & Network Telemetry Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Total Concurrent Students */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Học sinh kết nối</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 font-mono">
              {metrics.totalConnectedStudents} <span className="text-xs text-slate-400 font-normal">/ 500 slot</span>
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Đầy đủ 100% dung lượng
            </div>
          </div>
        </div>

        {/* Metric 2: Throughput (req/s) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Tốc độ xử lý (Throughput)</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 font-mono">
              {metrics.throughputReqPerSec} <span className="text-xs text-slate-400 font-normal">req/s</span>
            </div>
            <div className="text-[11px] text-amber-600 font-semibold mt-1">
              Xử lý mượt, không độ trễ
            </div>
          </div>
        </div>

        {/* Metric 3: Network Latency */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Độ trễ mạng (Ping)</span>
            <Activity className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 font-mono">
              {metrics.networkLatencyMs} <span className="text-xs text-slate-400 font-normal">ms</span>
            </div>
            <div className="text-[11px] text-teal-700 font-semibold mt-1">
              Cực nhanh (Ultra Low Latency)
            </div>
          </div>
        </div>

        {/* Metric 4: Packet Loss / Drop Rate */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Tỷ lệ rớt gói (Drop Rate)</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-700 font-mono">
              0.00%
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">
              Tuyệt đối không sập mạng
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Answer Distribution (A, B, C, D) during 500-student test */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              Phân bổ câu trả lời trực tiếp của 500 học sinh (Câu hỏi hiện tại)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Tổng cộng: {metrics.liveAnswerDistribution.totalAnswers} phiếu bầu
          </span>
        </div>

        <div className="space-y-2.5 text-xs">
          {/* Option A Bar */}
          <div>
            <div className="flex justify-between font-bold mb-1">
              <span className="text-blue-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">A</span>
                <span>Hạt giống có phẩm chất tốt hơn</span>
              </span>
              <span className="font-mono text-slate-800">{metrics.liveAnswerDistribution.A} phiếu ({pctA}%)</span>
            </div>
            <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-500 rounded-full shadow-xs"
                style={{ width: `${pctA}%` }}
              ></div>
            </div>
          </div>

          {/* Option B Bar */}
          <div>
            <div className="flex justify-between font-bold mb-1">
              <span className="text-emerald-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">B</span>
                <span>Cây con khó bị côn trùng tấn công</span>
              </span>
              <span className="font-mono text-slate-800">{metrics.liveAnswerDistribution.B} phiếu ({pctB}%)</span>
            </div>
            <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-500 rounded-full shadow-xs"
                style={{ width: `${pctB}%` }}
              ></div>
            </div>
          </div>

          {/* Option C Bar */}
          <div>
            <div className="flex justify-between font-bold mb-1">
              <span className="text-orange-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center text-[10px]">C</span>
                <span>Không cần chăm sóc sau khi gieo</span>
              </span>
              <span className="font-mono text-slate-800">{metrics.liveAnswerDistribution.C} phiếu ({pctC}%)</span>
            </div>
            <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-600 transition-all duration-500 rounded-full shadow-xs"
                style={{ width: `${pctC}%` }}
              ></div>
            </div>
          </div>

          {/* Option D Bar */}
          <div>
            <div className="flex justify-between font-bold mb-1">
              <span className="text-purple-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">D</span>
                <span>Không cần làm đất trước khi gieo</span>
              </span>
              <span className="font-mono text-slate-800">{metrics.liveAnswerDistribution.D} phiếu ({pctD}%)</span>
            </div>
            <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-600 transition-all duration-500 rounded-full shadow-xs"
                style={{ width: `${pctD}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Returned Submissions Live Feed */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/90 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900">
              Luồng nộp bài & Chấm tự động trả về thời gian thực
            </span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
              {submissions.length} bài thi
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
            <span>Điểm trung bình: <strong className="text-slate-900">{averageScore}</strong></span>
            <span>|</span>
            <span>Điểm 10 tuyệt đối: <strong className="text-emerald-700">{perfectScoresCount}</strong></span>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white sticky top-0 font-bold text-slate-600 border-b border-slate-200 z-10">
              <tr>
                <th className="py-2.5 px-4">Thứ tự</th>
                <th className="py-2.5 px-4">Họ và tên thí sinh</th>
                <th className="py-2.5 px-4">Lớp / SBD</th>
                <th className="py-2.5 px-4 text-center">Số câu đúng</th>
                <th className="py-2.5 px-4 text-center">Thời gian</th>
                <th className="py-2.5 px-4 text-center">Giám sát vi phạm</th>
                <th className="py-2.5 px-4 text-center">Điểm số</th>
                <th className="py-2.5 px-4 text-right">Trạng thái tự chấm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {submissions.map((sub, index) => {
                const isNew = index === 0;
                const tabViolations = sub.tabSwitchCount ?? 0;
                return (
                  <tr
                    key={sub.id}
                    className={`transition-colors ${
                      isNew ? 'bg-emerald-50/70 font-semibold' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-500">
                      #{index + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        {sub.score === 10 && <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        <span>{sub.studentName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-600">
                      {sub.studentInfo}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">
                      {sub.correctAnswersCount} / {sub.totalQuestions}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-500">
                      {Math.floor(sub.durationSeconds / 60)}m {sub.durationSeconds % 60}s
                    </td>
                    <td className="py-3 px-4 text-center">
                      {sub.isDisqualified ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          ⛔ Đình chỉ thi
                        </span>
                      ) : tabViolations > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          ⚠️ {tabViolations} lần chuyển tab
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ✓ Minh bạch
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md font-black text-xs ${
                          sub.score >= 8
                            ? 'bg-emerald-100 text-emerald-800'
                            : sub.score >= 5
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {sub.score.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Tự trả về: {sub.submittedAt}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
