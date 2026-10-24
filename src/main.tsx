import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Test Online Application Runtime Catch:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-emerald-500/40 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center text-2xl font-black">
              ✓
            </div>
            <h1 className="text-xl font-black text-white">Khôi phục hệ thống Test Online</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Trình duyệt vừa phát hiện xung đột bộ nhớ đệm cũ hoặc mạng kết nối. Bấm nút dưới đây để làm mới và tiếp tục sử dụng hệ thống bình thường.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl font-black text-sm text-white shadow-lg cursor-pointer hover:brightness-110 active:scale-95 transition-all"
            >
              Làm mới trang & Khởi chạy ngay
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
