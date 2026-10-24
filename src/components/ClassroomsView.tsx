import React, { useState } from 'react';
import {
  Users,
  Plus,
  MoreVertical,
  Calendar,
  GraduationCap,
  QrCode,
  Award,
  FileSpreadsheet,
  X,
  UserCheck,
  Trash2,
  Printer,
  CheckCircle2,
  Edit2
} from 'lucide-react';
import { Classroom, Student } from '../types/quiz';
import { soundEffects } from '../utils/soundEffects';
import { cloudStorageService } from '../services/cloudStorageService';

interface ClassroomsViewProps {
  classrooms: Classroom[];
  onCreateClassroom: (newClass: Omit<Classroom, 'id' | 'createdAt' | 'students'>) => void;
  onUpdateClassroom?: (updated: Classroom) => void;
  onDeleteClassroom?: (classId: string) => void;
}

export const ClassroomsView: React.FC<ClassroomsViewProps> = ({
  classrooms,
  onCreateClassroom,
  onUpdateClassroom,
  onDeleteClassroom
}) => {
  const [selectedClass, setSelectedClass] = useState<Classroom | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [academicYearInput, setAcademicYearInput] = useState('2025 - 2026');
  const [studentCountInput, setStudentCountInput] = useState('30');
  const [codeInput, setCodeInput] = useState('');

  // Add Student inside Class Roster
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentCode, setNewStudentCode] = useState('');
  const [newStudentScore, setNewStudentScore] = useState('8.5');

  // Printable QR Modal
  const [isQrPrintModalOpen, setIsQrPrintModalOpen] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    onCreateClassroom({
      name: nameInput.trim(),
      academicYear: academicYearInput,
      studentCount: parseInt(studentCountInput, 10) || 30,
      code: codeInput.trim().toUpperCase() || 'LOP' + Math.floor(100 + Math.random() * 900),
      teacherName: 'Thầy Hồ Tấn Khải'
    });
    setNameInput('');
    setIsAddModalOpen(false);
    soundEffects.playCorrect();
  };

  const handleAddStudentToClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !newStudentName.trim()) return;

    soundEffects.playClick();
    const newStudent: Student = {
      id: 'st-' + Date.now(),
      fullName: newStudentName.trim(),
      studentCode: newStudentCode.trim() || '26MT' + Math.floor(100 + Math.random() * 900),
      completedExams: 1,
      lastScore: parseFloat(newStudentScore) || 8.0,
    };

    const updatedStudents = [...selectedClass.students, newStudent];
    const updatedClass: Classroom = {
      ...selectedClass,
      studentCount: updatedStudents.length,
      students: updatedStudents,
    };

    setSelectedClass(updatedClass);
    onUpdateClassroom?.(updatedClass);

    setNewStudentName('');
    setNewStudentCode('');
    setIsAddStudentOpen(false);
    soundEffects.playCorrect();
  };

  const handleDeleteStudent = (studentId: string) => {
    if (!selectedClass) return;
    soundEffects.playClick();
    const updatedStudents = selectedClass.students.filter(s => s.id !== studentId);
    const updatedClass: Classroom = {
      ...selectedClass,
      studentCount: updatedStudents.length,
      students: updatedStudents,
    };
    setSelectedClass(updatedClass);
    onUpdateClassroom?.(updatedClass);
  };

  const handleExportExcelSingle = () => {
    soundEffects.playClick();
    cloudStorageService.exportClassroomsToExcel(selectedClass ? [selectedClass] : classrooms);
    soundEffects.playCorrect();
  };

  return (
    <div className="space-y-6">
      {/* Header matching Screenshot 5 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Quản lý lớp học</h1>
          <p className="text-xs text-slate-500 mt-0.5">Danh sách lớp phân quyền, phân bố đề thi và theo dõi tiến độ học sinh</p>
        </div>

        {/* 3D Button: Thêm Lớp Học Mới */}
        <button
          onClick={() => {
            soundEffects.playClick();
            setIsAddModalOpen(true);
          }}
          className="btn-3d btn-3d-teal px-4 py-2 text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer font-bold shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>+ Thêm Lớp Học Mới</span>
        </button>
      </div>

      {/* Classroom Cards Grid matching Screenshot 5 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {classrooms.map((cls) => (
          <div
            key={cls.id}
            className="card-3d card-3d-teal p-5 flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-start justify-between">
                <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-teal-700 transition-colors uppercase tracking-tight">
                  {cls.name}
                </h3>
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    if (confirm(`Bạn có muốn xóa lớp "${cls.name}"?`)) {
                      onDeleteClassroom?.(cls.id);
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                  title="Xóa lớp học"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Số học sinh:</span>
                  <span className="font-bold text-slate-900">{cls.studentCount} học sinh</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Năm học:</span>
                  <span className="font-semibold text-slate-700">{cls.academicYear}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Ngày tạo:</span>
                  <span className="font-mono text-slate-500">{cls.createdAt}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] bg-teal-50 text-teal-700 font-mono font-bold px-2 py-0.5 rounded-md border border-teal-200">
                MÃ: {cls.code}
              </span>
              <button
                onClick={() => {
                  soundEffects.playClick();
                  setSelectedClass(cls);
                }}
                className="btn-3d btn-3d-slate px-3 py-1.5 text-[11px] rounded-lg cursor-pointer flex items-center gap-1.5 font-bold"
              >
                <Users className="w-3.5 h-3.5 text-teal-600" />
                <span>Xem danh sách ({cls.students?.length || 0})</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Class Roster Modal */}
      {selectedClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="bg-gradient-to-r from-teal-700 to-emerald-700 p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-extrabold text-lg">{selectedClass.name}</h3>
                <p className="text-xs text-teal-100">
                  Năm học: {selectedClass.academicYear} • Tổng số: {selectedClass.studentCount} học sinh • Mã lớp: {selectedClass.code}
                </p>
              </div>
              <button
                onClick={() => setSelectedClass(null)}
                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">Danh sách học sinh trong lớp:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setIsAddStudentOpen(true)}
                    className="btn-3d btn-3d-teal px-2.5 py-1 text-xs rounded-lg flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Thêm học sinh</span>
                  </button>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setIsQrPrintModalOpen(true);
                    }}
                    className="btn-3d btn-3d-slate px-2.5 py-1 text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-teal-600" />
                    <span>In QR Code</span>
                  </button>
                  <button
                    onClick={handleExportExcelSingle}
                    className="btn-3d btn-3d-slate px-2.5 py-1 text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Xuất Excel</span>
                  </button>
                </div>
              </div>

              {/* Add Student Sub-Form */}
              {isAddStudentOpen && (
                <form onSubmit={handleAddStudentToClass} className="p-3 bg-teal-50 border border-teal-200 rounded-2xl space-y-2 text-xs">
                  <div className="font-bold text-teal-900">Thêm học sinh mới vào {selectedClass.name}:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Họ và tên học sinh"
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl"
                    />
                    <input
                      type="text"
                      placeholder="Mã số HS (VD: 26CN099)"
                      value={newStudentCode}
                      onChange={(e) => setNewStudentCode(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-mono uppercase"
                    />
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Điểm ban đầu (VD: 9.0)"
                      value={newStudentScore}
                      onChange={(e) => setNewStudentScore(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddStudentOpen(false)}
                      className="btn-3d btn-3d-slate px-3 py-1 rounded-lg text-xs cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="btn-3d btn-3d-teal px-3.5 py-1 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Lưu học sinh
                    </button>
                  </div>
                </form>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">STT</th>
                      <th className="py-2.5 px-4">Họ và tên</th>
                      <th className="py-2.5 px-4">Mã số HS</th>
                      <th className="py-2.5 px-4 text-center">Đã làm</th>
                      <th className="py-2.5 px-4 text-right">Điểm TB</th>
                      <th className="py-2.5 px-4 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {selectedClass.students.map((st, idx) => (
                      <tr key={st.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-medium">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-800 flex items-center gap-2">
                          <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span>{st.fullName}</span>
                        </td>
                        <td className="py-2.5 px-4 font-mono">{st.studentCode}</td>
                        <td className="py-2.5 px-4 text-center font-mono font-semibold">{st.completedExams} bài</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-700 font-mono">
                          {st.lastScore ? st.lastScore.toFixed(1) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => handleDeleteStudent(st.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                            title="Xóa học sinh này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedClass(null)}
                className="btn-3d btn-3d-slate px-4 py-2 text-xs rounded-xl cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable QR Cards Modal */}
      {isQrPrintModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Thẻ Dự Thi & Mã QR Đăng Nhập Tự Động: {selectedClass.name}
                </h3>
                <p className="text-xs text-slate-500">Trường THPT Mang Thít • Tác giả: Hồ Tấn Khải</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="btn-3d btn-3d-teal px-3 py-1.5 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer font-bold"
                >
                  <Printer className="w-4 h-4" />
                  <span>In Thẻ Dự Thi</span>
                </button>
                <button
                  onClick={() => setIsQrPrintModalOpen(false)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full cursor-pointer"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto p-2 flex-1">
              {selectedClass.students.map((st) => (
                <div key={st.id} className="border-2 border-dashed border-teal-300 rounded-2xl p-3 bg-teal-50/30 text-center space-y-1.5">
                  <div className="text-[10px] font-bold text-teal-800 uppercase tracking-tight">THPT MANG THÍT</div>
                  <div className="font-black text-slate-900 text-xs truncate">{st.fullName}</div>
                  <div className="text-[11px] font-mono font-bold text-teal-700 bg-white border border-teal-200 rounded-md py-0.5">
                    SBD: {st.studentCode}
                  </div>
                  <div className="w-24 h-24 bg-white border border-slate-300 rounded-xl mx-auto flex items-center justify-center p-1 shadow-inner">
                    <QrCode className="w-20 h-20 text-slate-800" />
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono">Quét để tự động vào thi</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Add New Class */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">Thêm Lớp Học Mới</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên lớp học:</label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Ví dụ: ÔN THI TỐT NGHIỆP CÔNG NGHỆ 12A1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Năm học:</label>
                  <input
                    type="text"
                    value={academicYearInput}
                    onChange={(e) => setAcademicYearInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số lượng học sinh:</label>
                  <input
                    type="number"
                    value={studentCountInput}
                    onChange={(e) => setStudentCountInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mã lớp (tuỳ chọn):</label>
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="Để trống hệ thống sẽ tự sinh mã"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 font-medium uppercase font-mono"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-3d btn-3d-slate px-3.5 py-1.5 text-xs rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-3d btn-3d-teal px-4 py-1.5 text-xs rounded-xl cursor-pointer font-bold shadow-md"
                >
                  Tạo lớp ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
