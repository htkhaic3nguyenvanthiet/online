import React from 'react';
import { Award, CheckCircle2, Send, X, Zap } from 'lucide-react';
import { StudentSubmission } from '../types/quiz';

interface LiveNotificationToastProps {
  submission: StudentSubmission | null;
  onDismiss: () => void;
  onClick: () => void;
}

export const LiveNotificationToast: React.FC<LiveNotificationToastProps> = ({
  submission,
  onDismiss,
  onClick
}) => {
  if (!submission) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-200">
      <div
        onClick={onClick}
        className="bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border-2 border-emerald-500/80 backdrop-blur-md cursor-pointer hover:bg-slate-800 transition-all flex items-start gap-3 relative group"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Kết quả nộp bài Real-time</span>
          </div>

          <h4 className="font-extrabold text-sm text-white truncate mt-0.5">
            {submission.studentName}
          </h4>

          <div className="text-xs text-slate-300 mt-1 flex items-center gap-2">
            <span className="font-mono text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded-sm">
              Điểm: {submission.score.toFixed(1)}/10
            </span>
            <span className="text-slate-400 truncate">{submission.studentInfo}</span>
          </div>

          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Hệ thống đã tự động chấm và đồng bộ xong</span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="text-slate-400 hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
