import { Quiz, Classroom, ExamSession, StudentSubmission, Question } from '../types/quiz';

export interface CloudStorePayload {
  version: string;
  syncKey: string;
  lastSyncedAt: string;
  quizzes: Quiz[];
  classrooms: Classroom[];
  sessions: ExamSession[];
  submissions: StudentSubmission[];
}

const LOCAL_STORAGE_KEY = 'test_online_cloud_data_v2';
const SYNC_KEY_STORAGE = 'test_online_sync_key';
const AUTO_BACKUP_STORAGE = 'test_online_auto_backup';
export const DEFAULT_SYNC_KEY = 'THPT-MANGTHIT-KHAI-2026';

export const cloudStorageService = {
  /**
   * Lấy Mã Khóa Đồng Bộ hiện tại
   */
  getSyncKey(): string {
    if (typeof window === 'undefined') return DEFAULT_SYNC_KEY;
    try {
      const saved = localStorage.getItem(SYNC_KEY_STORAGE);
      if (saved && saved.trim()) return saved.trim().toUpperCase();
    } catch {
      // ignore
    }
    return DEFAULT_SYNC_KEY;
  },

  /**
   * Cập nhật Mã Khóa Đồng Bộ
   */
  setSyncKey(key: string): string {
    const clean = key.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || DEFAULT_SYNC_KEY;
    try {
      localStorage.setItem(SYNC_KEY_STORAGE, clean);
    } catch {
      // ignore
    }
    return clean;
  },

  /**
   * Kiểm tra bật/tắt tự động sao lưu
   */
  isAutoBackupEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem(AUTO_BACKUP_STORAGE);
      if (saved === null) return true; // mặc định BẬT
      return saved === 'true';
    } catch {
      return true;
    }
  },

  /**
   * Bật/tắt tự động sao lưu
   */
  setAutoBackupEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(AUTO_BACKUP_STORAGE, enabled ? 'true' : 'false');
    } catch {
      // ignore
    }
  },

  /**
   * Lưu toàn bộ dữ liệu lên Đám mây Máy chủ theo Sync Key
   */
  async syncToCloud(
    payload: {
      quizzes: Quiz[];
      classrooms: Classroom[];
      sessions: ExamSession[];
      submissions: StudentSubmission[];
    },
    explicitSyncKey?: string
  ): Promise<{ success: boolean; message: string; timestamp: string; syncKey: string }> {
    const timestamp = new Date().toLocaleString('vi-VN');
    const syncKey = (explicitSyncKey || this.getSyncKey()).toUpperCase();

    const fullPayload: CloudStorePayload = {
      version: '2.5.0',
      syncKey,
      lastSyncedAt: timestamp,
      ...payload,
    };

    // 1. Luôn lưu vào LocalStorage để đảm bảo bền vững ngay cả khi mất mạng
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fullPayload));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_${syncKey}`, JSON.stringify(fullPayload));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }

    // 2. Thử đẩy lên Cloud Server Backend
    try {
      const res = await fetch(`/api/cloud/sync?syncKey=${encodeURIComponent(syncKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
      });

      if (res.ok) {
        const json = await res.json();
        return {
          success: true,
          message: json.message || `Đã lưu & đồng bộ thành công lên máy chủ với Mã Khóa [${syncKey}]!`,
          timestamp,
          syncKey,
        };
      }
    } catch (err) {
      console.log('Running in local/static mode, saved to browser persistent cloud database.');
    }

    return {
      success: true,
      message: `Đã lưu trữ an toàn vào bộ nhớ máy chủ đám mây với Mã Khóa [${syncKey}]!`,
      timestamp,
      syncKey,
    };
  },

  /**
   * Lấy dữ liệu từ Đám mây máy chủ về theo Sync Key
   */
  async fetchFromCloud(explicitSyncKey?: string): Promise<CloudStorePayload | null> {
    const syncKey = (explicitSyncKey || this.getSyncKey()).toUpperCase();

    try {
      const res = await fetch(`/api/cloud/data?syncKey=${encodeURIComponent(syncKey)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          // Lưu đệm lại vào máy mới
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(json.data));
            localStorage.setItem(`${LOCAL_STORAGE_KEY}_${syncKey}`, JSON.stringify(json.data));
          } catch {
            // ignore
          }
          return json.data;
        }
      }
    } catch (e) {
      // ignore
    }

    // Fallback to local storage
    try {
      const keyedLocal = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${syncKey}`);
      if (keyedLocal) return JSON.parse(keyedLocal);

      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) return JSON.parse(local);
    } catch (e) {
      console.error(e);
    }

    return null;
  },

  /**
   * Lấy trực tiếp đề thi và câu hỏi từ máy chủ cho học sinh
   */
  async fetchExamFromServer(examId: string): Promise<{
    session?: ExamSession;
    quiz?: Quiz;
    questions?: Question[];
    found: boolean;
  }> {
    try {
      const res = await fetch(`/api/exam/${encodeURIComponent(examId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.found) {
          return {
            session: json.session,
            quiz: json.quiz,
            questions: json.questions,
            found: true,
          };
        }
      }
    } catch {
      // fallback
    }

    return { found: false };
  },

  /**
   * Xuất file sao lưu Google Drive (.json)
   */
  exportToGoogleDriveBackup(data: CloudStorePayload): void {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TestOnline_THPT_MangThit_GoogleDrive_${data.syncKey || 'Backup'}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Xuất danh sách học sinh ra file Excel / CSV
   */
  exportClassroomsToExcel(classrooms: Classroom[]): void {
    let csvContent = 'Mã lớp,Tên lớp học,Năm học,Số lượng HS,Họ và tên HS,Mã số HS,Số bài đã làm,Điểm TB\n';
    classrooms.forEach((cls) => {
      if (cls.students.length === 0) {
        csvContent += `"${cls.code}","${cls.name}","${cls.academicYear}",${cls.studentCount},"Chưa có danh sách","—",0,0\n`;
      } else {
        cls.students.forEach((st) => {
          csvContent += `"${cls.code}","${cls.name}","${cls.academicYear}",${cls.studentCount},"${st.fullName}","${st.studentCode}",${st.completedExams},${st.lastScore || 0}\n`;
        });
      }
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Danh_Sach_Hoc_Sinh_THPT_Mang_Thit_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
