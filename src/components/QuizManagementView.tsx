import React, { useState } from 'react';
import {
  Folder,
  FileText,
  Search,
  FolderPlus,
  Plus,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
  Trash2,
  Sparkles,
  CheckCircle,
  Upload,
  Download,
  Copy,
  Edit3,
  Shuffle,
  X,
  ClipboardCopy
} from 'lucide-react';
import { Quiz } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';
import {
  ShuffledVariantResult,
  buildAnswerKeyText,
  extractBaseCode,
  generateShuffledVariants
} from '../utils/shuffleEngine';

interface QuizManagementViewProps {
  quizzes: Quiz[];
  onCreateQuiz: () => void;
  onDeployQuiz: (quiz: Quiz) => void;
  onPreviewQuiz: (quiz: Quiz) => void;
  onEditQuiz: (quiz: Quiz) => void;
  onDuplicateQuiz: (quiz: Quiz) => void;
  onDeleteQuiz: (quizId: string) => void;
  onAddShuffledVariants?: (variants: Quiz[]) => void;
}

export const QuizManagementView: React.FC<QuizManagementViewProps> = ({
  quizzes,
  onCreateQuiz,
  onDeployQuiz,
  onPreviewQuiz,
  onEditQuiz,
  onDuplicateQuiz,
  onDeleteQuiz,
  onAddShuffledVariants
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // ---- Trộn đề (Phase C) ----
  const [shuffleTarget, setShuffleTarget] = useState<Quiz | null>(null);
  const [shuffleCount, setShuffleCount] = useState(4);
  const [shuffleBaseCode, setShuffleBaseCode] = useState(101);
  const [shuffleOptPart1Questions, setShuffleOptPart1Questions] = useState(true);
  const [shuffleOptOptions, setShuffleOptOptions] = useState(true);
  const [shuffleOptPart2Items, setShuffleOptPart2Items] = useState(true);
  const [shuffleOptPart3Questions, setShuffleOptPart3Questions] = useState(false);
  const [shuffleResults, setShuffleResults] = useState<ShuffledVariantResult[] | null>(null);
  const [copiedKeyTable, setCopiedKeyTable] = useState(false);

  const openShuffleModal = (quiz: Quiz) => {
    setShuffleTarget(quiz);
    setShuffleCount(4);
    setShuffleBaseCode(extractBaseCode(quiz));
    setShuffleOptPart1Questions(true);
    setShuffleOptOptions(true);
    setShuffleOptPart2Items(true);
    setShuffleOptPart3Questions(false);
    setShuffleResults(null);
    setCopiedKeyTable(false);
  };

  const closeShuffleModal = () => {
    setShuffleTarget(null);
    setShuffleResults(null);
  };

  const handleRunShuffle = () => {
    if (!shuffleTarget || !onAddShuffledVariants) return;
    soundEffects.playClick();
    const results = generateShuffledVariants(shuffleTarget, {
      count: shuffleCount,
      baseCode: shuffleBaseCode,
      shufflePart1Questions: shuffleOptPart1Questions,
      shuffleOptions: shuffleOptOptions,
      shufflePart2Items: shuffleOptPart2Items,
      shufflePart3Questions: shuffleOptPart3Questions
    });
    onAddShuffledVariants(results.map((r) => r.quiz));
    setShuffleResults(results);
    soundEffects.playCorrect();
  };

  const handleCopyKeyTable = async () => {
    if (!shuffleTarget || !shuffleResults) return;
    const text = buildAnswerKeyText(shuffleTarget.title, shuffleResults);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyTable(true);
    } catch {
      // Dự phòng cho trình duyệt chặn Clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopiedKeyTable(true);
      } catch {
        // ignore
      }
      document.body.removeChild(ta);
    }
  };
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('testonline_custom_folders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return ['CÔNG NGHỆ 12', 'ĐỀ THI HỌC KỲ', 'KIỂM TRA 15 PHÚT'];
  });
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // All distinct folders from system and quizzes
  const allFolders = Array.from(
    new Set([
      ...customFolders,
      ...quizzes.map((q) => q.folder).filter(Boolean) as string[]
    ])
  );

  const filteredQuizzes = quizzes.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFolder = selectedFolder ? q.folder === selectedFolder : true;
    return matchesSearch && matchesFolder;
  });

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    soundEffects.playClick();
    const formatted = newFolderName.trim().toUpperCase();
    let updated = customFolders;
    if (!customFolders.includes(formatted)) {
      updated = [...customFolders, formatted];
      setCustomFolders(updated);
      try {
        localStorage.setItem('testonline_custom_folders', JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
    setSelectedFolder(formatted);
    setNewFolderName('');
    setIsFolderModalOpen(false);
    soundEffects.playCorrect();
  };

  const handleDownloadQuizFile = (quiz: Quiz) => {
    soundEffects.playClick();
    const content = `BÀI THI TRẮC NGHIỆM TRỰC TUYẾN
Tên đề: ${quiz.title}
Môn học: ${quiz.subject} (${quiz.grade})
Thời gian làm bài: ${quiz.durationMinutes} phút
Tổng số câu: ${quiz.questionCount} câu

${quiz.questions?.map((q, idx) => `
Câu ${idx + 1}: ${q.content}
${q.options ? q.options.map(o => `  ${o.key}. ${o.text}`).join('\n') : q.subItems ? q.subItems.map(si => `  ${si.key}) ${si.content} [${si.isCorrect ? 'ĐÚNG' : 'SAI'}]`).join('\n') : `  Đáp án 4 ký tự: ${q.shortAnswerCorrect || '1234'}`}
=> Đáp án chuẩn: ${q.correctAnswer || q.shortAnswerCorrect || 'A'}
=> Hướng dẫn giải: ${q.explanation || 'Theo chuẩn GDPT Bộ Giáo dục & Đào tạo.'}
`).join('\n----------------------------------------\n') || 'Nội dung câu hỏi đang được biên tập.'}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz.fileName.replace('.docx', '')}_DeThi.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    soundEffects.playCorrect();
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Search Bar Matching Screenshot 2 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Quản lý đề kiểm tra</h1>
          <p className="text-xs text-slate-500 mt-0.5">Kho lưu trữ đề thi, bài tập và ngân hàng câu hỏi • Tác giả: Hồ Tấn Khải</p>
        </div>

        {/* Action Bar with 3D buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search box with 3D button */}
          <div className="flex items-center">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nhập tên đề..."
              className="bg-white border border-slate-300 rounded-l-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500 w-44 sm:w-56 font-medium"
            />
            <button
              onClick={() => soundEffects.playClick()}
              className="btn-3d btn-3d-teal px-3 py-1.5 text-xs rounded-r-xl rounded-l-none cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* 3D Button: Tạo mới thư mục */}
          <button
            onClick={() => {
              soundEffects.playClick();
              setIsFolderModalOpen(true);
            }}
            className="btn-3d btn-3d-slate px-3.5 py-1.5 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <FolderPlus className="w-4 h-4 text-teal-600" />
            <span>Tạo mới thư mục</span>
          </button>

          {/* 3D Button: Tải file Word */}
          <button
            onClick={() => {
              soundEffects.playClick();
              onCreateQuiz();
            }}
            className="btn-3d btn-3d-slate px-3.5 py-1.5 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold border border-emerald-300 text-emerald-800 bg-emerald-50"
            title="Tải lên tệp Word (.docx) nhận dạng 3 phần Thông tư 7991"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Upload Word 7991</span>
          </button>

          {/* 3D Button: Tạo mới đề */}
          <button
            onClick={() => {
              soundEffects.playClick();
              onCreateQuiz();
            }}
            className="btn-3d btn-3d-teal px-4 py-1.5 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo mới đề</span>
          </button>
        </div>
      </div>

      {/* Section: Được đề xuất (Featured Carousel matching screenshot 2) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Được đề xuất</span>
          <div className="flex items-center gap-1 text-slate-400">
            <button className="p-1 hover:text-slate-700"><ChevronLeft className="w-4 h-4" /></button>
            <button className="p-1 hover:text-slate-700"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {quizzes.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="card-3d card-3d-blue p-4 flex flex-col justify-between group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-xs text-slate-800 truncate group-hover:text-teal-700 transition-colors" title={item.title}>
                    {item.title}
                  </h4>
                  <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                    <div>Ngày tạo: {item.createdAt}</div>
                    <div className="font-mono text-teal-700 font-semibold">Số câu: {item.breakdown}</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                  {item.subject}
                </span>
                <div className="flex items-center gap-1">
                  {onAddShuffledVariants && (
                    <button
                      onClick={() => {
                        soundEffects.playClick();
                        openShuffleModal(item);
                      }}
                      className="p-1 text-slate-400 hover:text-purple-600 rounded-md cursor-pointer"
                      title="Trộn đề — sinh nhiều mã đề"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      onEditQuiz(item);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600 rounded-md cursor-pointer"
                    title="Chỉnh sửa câu hỏi"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      onPreviewQuiz(item);
                    }}
                    className="p-1 text-slate-400 hover:text-teal-600 rounded-md cursor-pointer"
                    title="Xem chi tiết"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      onDeployQuiz(item);
                    }}
                    className="btn-3d btn-3d-teal px-2 py-0.5 text-[11px] rounded-lg flex items-center gap-1 cursor-pointer"
                    title="Giao đề trực tuyến"
                  >
                    <Send className="w-3 h-3" />
                    <span>Giao đề</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Folder Tabs Bar (INSTANT DISPLAY & ACCESS) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => {
            soundEffects.playClick();
            setSelectedFolder(null);
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
            selectedFolder === null
              ? 'bg-teal-700 text-white shadow-sm ring-2 ring-teal-400/50'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
          <span>Tất cả đề ({quizzes.length})</span>
        </button>

        {allFolders.map((folderName) => {
          const count = quizzes.filter(q => q.folder === folderName).length;
          const isSelected = selectedFolder === folderName;
          return (
            <button
              key={folderName}
              onClick={() => {
                soundEffects.playClick();
                setSelectedFolder(folderName);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Folder className={`w-3.5 h-3.5 ${isSelected ? 'fill-white text-white' : 'fill-amber-400 text-amber-500'}`} />
              <span>{folderName}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isSelected ? 'bg-amber-700 text-amber-100' : 'bg-slate-100 text-slate-600'}`}>
                {count}
              </span>
            </button>
          );
        })}

        <button
          onClick={() => {
            soundEffects.playClick();
            setIsFolderModalOpen(true);
          }}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 border border-dashed border-teal-300 hover:bg-teal-100/70 shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>+ Thư mục mới</span>
        </button>
      </div>

      {/* Section: Tất cả (Table matching Screenshot 2) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900">
              {selectedFolder ? `Thư mục: ${selectedFolder}` : 'Tất cả đề thi'}
            </span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {filteredQuizzes.length} đề
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedFolder && (
              <button
                onClick={() => setSelectedFolder(null)}
                className="text-xs text-teal-600 hover:underline font-semibold"
              >
                ← Xem toàn bộ
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-5">Tên đề ↑</th>
                <th className="py-3 px-5">Ngày tạo</th>
                <th className="py-3 px-5">Số câu</th>
                <th className="py-3 px-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {/* Folder list when at root */}
              {!selectedFolder && customFolders.map((folderName) => (
                <tr
                  key={folderName}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer font-bold"
                >
                  <td
                    onClick={() => {
                      soundEffects.playClick();
                      setSelectedFolder(folderName);
                    }}
                    className="py-3.5 px-5 flex items-center gap-2.5 text-slate-900"
                  >
                    <Folder className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>{folderName}</span>
                  </td>
                  <td className="py-3.5 px-5 text-slate-400">—</td>
                  <td className="py-3.5 px-5 text-slate-400 font-mono">
                    {quizzes.filter(q => q.folder === folderName).length} đề
                  </td>
                  <td className="py-3.5 px-5 text-right text-slate-400 text-[11px]">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEffects.playClick();
                          setSelectedFolder(folderName);
                        }}
                        className="text-teal-600 hover:underline font-semibold"
                      >
                        Mở thư mục →
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEffects.playClick();
                          if (confirm(`Bạn có chắc chắn muốn xóa thư mục "${folderName}"?`)) {
                            setCustomFolders((prev) => prev.filter((f) => f !== folderName));
                            soundEffects.playCorrect();
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Xóa thư mục này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Quizzes items */}
              {filteredQuizzes.map((quiz) => (
                <tr key={quiz.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                      <div>
                        <span
                          className="font-semibold text-slate-900 hover:text-teal-700 cursor-pointer"
                          onClick={() => onPreviewQuiz(quiz)}
                        >
                          {quiz.fileName}
                        </span>
                        {quiz.folder && (
                          <span className="ml-2 text-[10px] bg-amber-50 text-amber-800 font-bold px-1.5 py-0.5 rounded-md border border-amber-200">
                            📁 {quiz.folder}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-slate-600 font-mono">{quiz.createdAt}</td>
                  <td className="py-3.5 px-5">
                    <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="text-emerald-700 font-black">
                        {(quiz.questions && quiz.questions.length > 0) ? quiz.questions.length : quiz.questionCount} câu
                      </span>
                      <span className="text-[10px] bg-teal-50 text-teal-700 font-mono px-1.5 py-0.5 rounded-md border border-teal-200">
                        {quiz.breakdown || `${quiz.questionCount}-0-0-0`}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          onDeployQuiz(quiz);
                        }}
                        className="btn-3d btn-3d-teal px-2.5 py-1 text-[11px] rounded-lg cursor-pointer flex items-center gap-1 font-bold"
                        title="Giao đề cho học sinh"
                      >
                        <Send className="w-3 h-3" />
                        <span>Giao đề</span>
                      </button>

                      {onAddShuffledVariants && (
                        <button
                          onClick={() => {
                            soundEffects.playClick();
                            openShuffleModal(quiz);
                          }}
                          className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="Trộn đề — sinh nhiều mã đề từ đề này"
                        >
                          <Shuffle className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          onEditQuiz(quiz);
                        }}
                        className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Chỉnh sửa câu hỏi"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          onDuplicateQuiz(quiz);
                        }}
                        className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Nhân bản đề này"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDownloadQuizFile(quiz)}
                        className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Tải tệp đề thi (.txt / Word)"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          onPreviewQuiz(quiz);
                        }}
                        className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Làm thử / Xem câu hỏi"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          soundEffects.playClick();
                          if (confirm(`Bạn có chắc chắn muốn xóa đề thi: "${quiz.title}"?`)) {
                            onDeleteQuiz(quiz.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Xóa đề"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* EMPTY STATE (Clear, immediate visual feedback for new folders and search) */}
              {filteredQuizzes.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 px-6 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
                        <Folder className="w-7 h-7 fill-amber-400 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-800">
                          {selectedFolder ? `Thư mục "${selectedFolder}" sẵn sàng` : 'Không tìm thấy đề thi phù hợp'}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {selectedFolder 
                            ? `Thư mục "${selectedFolder}" vừa được tạo thành công! Hãy bấm nút bên dưới để tạo đề hoặc tải file Word vào thư mục này ngay.` 
                            : 'Thử tìm với từ khóa khác hoặc bấm nút Tạo mới đề để thêm đề vào hệ thống.'}
                        </p>
                      </div>
                      <div className="pt-1 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            soundEffects.playClick();
                            onCreateQuiz();
                          }}
                          className="btn-3d btn-3d-teal px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Tạo mới đề ngay</span>
                        </button>
                        {selectedFolder && (
                          <button
                            type="button"
                            onClick={() => {
                              soundEffects.playClick();
                              setSelectedFolder(null);
                            }}
                            className="btn-3d btn-3d-slate px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Xem tất cả đề</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">Tạo Thư Mục Đề Thi Mới</h3>
            <form onSubmit={handleCreateFolder} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Tên thư mục:</label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ví dụ: CÔNG NGHỆ 11 HK2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-teal-500 uppercase font-bold"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="btn-3d btn-3d-slate px-3.5 py-1.5 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-3d btn-3d-teal px-4 py-1.5 rounded-xl font-bold cursor-pointer"
                >
                  Tạo Thư Mục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shuffle (Trộn đề) Modal */}
      {shuffleTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <Shuffle className="w-5 h-5 text-purple-600" />
                  Trộn đề — sinh nhiều mã đề
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 font-medium" title={shuffleTarget.title}>
                  Đề gốc: <span className="font-bold text-slate-700">{shuffleTarget.title}</span>
                </p>
              </div>
              <button
                onClick={closeShuffleModal}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!shuffleResults ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 mb-1 font-bold">Số lượng mã đề (1–12):</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={shuffleCount}
                      onChange={(e) => setShuffleCount(Math.max(1, Math.min(12, parseInt(e.target.value || '1', 10) || 1)))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-purple-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1 font-bold">Mã đề bắt đầu:</label>
                    <input
                      type="number"
                      min={1}
                      value={shuffleBaseCode}
                      onChange={(e) => setShuffleBaseCode(Math.max(1, parseInt(e.target.value || '101', 10) || 101))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-purple-500 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2 text-xs font-semibold text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shuffleOptPart1Questions}
                      onChange={(e) => setShuffleOptPart1Questions(e.target.checked)}
                      className="w-4 h-4 accent-purple-600"
                    />
                    Trộn thứ tự câu hỏi Phần I
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shuffleOptOptions}
                      onChange={(e) => setShuffleOptOptions(e.target.checked)}
                      className="w-4 h-4 accent-purple-600"
                    />
                    Trộn phương án A–D trong mỗi câu Phần I
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shuffleOptPart2Items}
                      onChange={(e) => setShuffleOptPart2Items(e.target.checked)}
                      className="w-4 h-4 accent-purple-600"
                    />
                    Trộn các ý a–d trong mỗi câu Phần II (thứ tự câu Phần II giữ nguyên)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shuffleOptPart3Questions}
                      onChange={(e) => setShuffleOptPart3Questions(e.target.checked)}
                      className="w-4 h-4 accent-purple-600"
                    />
                    Trộn thứ tự câu hỏi Phần III
                  </label>
                </div>

                <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 font-medium">
                  Đáp án sẽ tự bám theo nội dung: công thức, hình ảnh và bảng số liệu nằm trong từng
                  câu hỏi nên luôn đi cùng câu khi trộn — đáp án đúng được tính lại theo vị trí mới
                  của phương án/ý đúng.
                </p>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeShuffleModal}
                    className="btn-3d btn-3d-slate px-3.5 py-1.5 text-xs rounded-xl cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleRunShuffle}
                    className="btn-3d btn-3d-teal px-4 py-1.5 text-xs rounded-xl font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Trộn & tạo {shuffleCount} mã đề
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <CheckCircle className="w-4 h-4" />
                  Đã tạo {shuffleResults.length} mã đề trong cùng thư mục của đề gốc. Mỗi mã đề là một đề thường — giao online như bình thường.
                </div>

                <div className="space-y-2.5">
                  {shuffleResults.map((r) => (
                    <div key={r.quiz.id} className="border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">Mã {r.code}</span>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                          A {r.distribution.A} · B {r.distribution.B} · C {r.distribution.C} · D {r.distribution.D}
                        </span>
                      </div>
                      {r.part1Key.length > 0 && (
                        <div className="font-mono text-[11px] text-slate-700 break-words">
                          <span className="font-sans font-bold text-slate-500">Phần I: </span>
                          {r.part1Key.map((k, i) => `${i + 1}${k}`).join('  ')}
                        </div>
                      )}
                      {r.part2TrueLetters.length > 0 && (
                        <div className="text-[11px] text-slate-700">
                          <span className="font-bold text-slate-500">Phần II (ý đúng): </span>
                          {r.part2TrueLetters.map((letters, i) => `Câu ${i + 1}: ${letters.join(',') || '—'}`).join(' · ')}
                        </div>
                      )}
                      {r.part3Key.length > 0 && (
                        <div className="text-[11px] text-slate-700">
                          <span className="font-bold text-slate-500">Phần III: </span>
                          {r.part3Key.join(' · ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyKeyTable}
                    className="btn-3d btn-3d-slate px-3.5 py-1.5 text-xs rounded-xl cursor-pointer flex items-center gap-1.5 font-bold"
                  >
                    <ClipboardCopy className="w-3.5 h-3.5" />
                    {copiedKeyTable ? 'Đã sao chép ✓' : 'Sao chép bảng đáp án'}
                  </button>
                  <button
                    type="button"
                    onClick={closeShuffleModal}
                    className="btn-3d btn-3d-teal px-4 py-1.5 text-xs rounded-xl font-bold cursor-pointer"
                  >
                    Xong
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
