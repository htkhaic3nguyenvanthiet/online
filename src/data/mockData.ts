import { Quiz, Classroom, ExamSession, Question } from '../types/quiz';

export const sampleQuestions: Question[] = [
  {
    id: 'q1',
    order: 1,
    content: 'Nội dung nào sau đây đúng khi nói về phương thức trồng rừng bằng gieo hạt?',
    options: [
      { key: 'A', text: 'Hạt giống cần có phẩm chất tốt hơn so với hạt gieo trong vườn ươm.', isCorrect: true },
      { key: 'B', text: 'Cây con mọc lên từ hạt khó bị côn trùng tấn công.', isCorrect: false },
      { key: 'C', text: 'Không cần chăm sóc sau khi gieo hạt.', isCorrect: false },
      { key: 'D', text: 'Không cần làm đất trước khi gieo.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Gieo hạt trực tiếp tại thực địa đòi hỏi hạt giống phải có độ thuần cao, sức nảy mầm mạnh mẽ để vượt qua điều kiện khắc nghiệt của tự nhiên.',
    points: 1
  },
  {
    id: 'q2',
    order: 2,
    content: 'Phương pháp nhân giống vô tính nào cho phép nhân nhanh hàng loạt cây giống sạch bệnh trong thời gian ngắn nhất?',
    options: [
      { key: 'A', text: 'Chiết cành truyền thống lâu năm.', isCorrect: false },
      { key: 'B', text: 'Nuôi cấy mô tế bào thực vật (In vitro).', isCorrect: true },
      { key: 'C', text: 'Ghép áp cành trong vườn ươm.', isCorrect: false },
      { key: 'D', text: 'Giâm hom cành trên luống cát.', isCorrect: false }
    ],
    correctAnswer: 'B',
    explanation: 'Nuôi cấy mô trong điều kiện vô trùng tạo ra hàng vạn cây giống sạch bệnh, đồng nhất về mặt di truyền trong không gian hẹp.',
    points: 1
  },
  {
    id: 'q3',
    order: 3,
    content: 'Mục đích chủ yếu của việc bón phân lót trước khi gieo trồng là gì?',
    options: [
      { key: 'A', text: 'Kích thích quả chín nhanh và mọng nước hơn.', isCorrect: false },
      { key: 'B', text: 'Cung cấp dinh dưỡng kịp thời khi bộ rễ non của cây mới bén đất.', isCorrect: true },
      { key: 'C', text: 'Làm rụng bớt lá vàng thừa trong mùa mưa.', isCorrect: false },
      { key: 'D', text: 'Tạo màu sắc đẹp cho hoa khi chuẩn bị thu hoạch.', isCorrect: false }
    ],
    correctAnswer: 'B',
    explanation: 'Bón lót giúp phân giải dinh dưỡng sẵn sàng trong tầng đất canh tác cho rễ cây non hấp thụ ngay sau khi nảy mầm.',
    points: 1
  },
  {
    id: 'q4',
    order: 4,
    content: 'Biện pháp kỹ thuật nào sau đây thuộc nguyên lý nông nghiệp công nghệ cao thân thiện với môi trường?',
    options: [
      { key: 'A', text: 'Hệ thống tưới nhỏ giọt tự động kết hợp châm phân định lượng.', isCorrect: true },
      { key: 'B', text: 'Phun thuốc trừ sâu hóa học định kỳ hằng ngày bất kể có sâu hay không.', isCorrect: false },
      { key: 'C', text: 'Đốt sạch tàn dư rơm rạ ngay trên đồng ruộng sau thu hoạch.', isCorrect: false },
      { key: 'D', text: 'Bón quá liều phân đạm vô cơ để cây lớn nhanh cấp tốc.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Tưới nhỏ giọt tiết kiệm đến 50-70% nước tưới và đưa phân bón chính xác đến rễ, giảm thất thoát rửa trôi ô nhiễm đất nguồn nước.',
    points: 1
  },
  {
    id: 'q5',
    order: 5,
    content: 'Đất phù sa bồi tụ ở đồng bằng sông Cửu Long thích hợp nhất với nhóm cây trồng nào dưới đây?',
    options: [
      { key: 'A', text: 'Cây lúa nước và cây ăn trái nhiệt đới.', isCorrect: true },
      { key: 'B', text: 'Cây thông ba lá và cây chè tuyết shan vùng lạnh.', isCorrect: false },
      { key: 'C', text: 'Cây cao su trên vùng đồi dốc cằn cỗi.', isCorrect: false },
      { key: 'D', text: 'Cây chịu hạn sa mạc như xương rồng gai.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Đất phù sa ngọt ven sông Tiền, sông Hậu rất giàu mùn dinh dưỡng, giữ nước tốt, cực kỳ lý tưởng cho lúa và cây ăn quả.',
    points: 1
  },
  {
    id: 'q6',
    order: 6,
    content: 'Tại sao cần luân canh cây trồng họ Đậu (như đậu tương, đậu phộng) với cây lúa nước hoặc ngô?',
    options: [
      { key: 'A', text: 'Vì nốt sần rễ cây họ Đậu chứa vi khuẩn Rhizobium cố định đạm tự nhiên.', isCorrect: true },
      { key: 'B', text: 'Vì cây họ Đậu không cần nước để quang hợp.', isCorrect: false },
      { key: 'C', text: 'Để loại bỏ hoàn toàn ánh sáng mặt trời trên ruộng.', isCorrect: false },
      { key: 'D', text: 'Vì cây họ Đậu thu hút chim sâu về diệt hết cỏ dại.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Cây họ Đậu có vi khuẩn cộng sinh cố định đạm từ khí trời vào đất, giúp cải tạo độ phì nhiêu màu mỡ tự nhiên.',
    points: 1
  }
];

export const mockQuizzes: Quiz[] = [
  {
    id: 'quiz-cn12',
    title: 'ÔN CN12-1-2-3',
    fileName: 'ON_CN12-1-2-3.docx',
    subject: 'Công nghệ 12',
    grade: 'Lớp 12',
    createdAt: '21/01/2026',
    questionCount: 112,
    breakdown: '112-0-0-0',
    durationMinutes: 60,
    totalPoints: 112,
    folder: 'CÔNG NGHỆ 12',
    isInteractive: true,
    questions: sampleQuestions
  },
  {
    id: 'quiz-cn10',
    title: 'CHỦ ĐỀ 1 CN10',
    fileName: 'CHU_DE_1_CN10.docx',
    subject: 'Công nghệ 10',
    grade: 'Lớp 10',
    createdAt: '21/01/2026',
    questionCount: 37,
    breakdown: '37-0-0-0',
    durationMinutes: 45,
    totalPoints: 10,
    folder: 'CÔNG NGHỆ 10',
    isInteractive: true,
    questions: sampleQuestions.slice(0, 4)
  },
  {
    id: 'quiz-sinh-2025',
    title: '2025_Sinh.docx',
    fileName: '2025_Sinh.docx',
    subject: 'Sinh học 11',
    grade: 'Lớp 11',
    createdAt: '22/03/2026',
    questionCount: 28,
    breakdown: '18-4-6-0',
    durationMinutes: 50,
    totalPoints: 10,
    folder: 'SINH HỌC 11',
    isInteractive: false,
    questions: sampleQuestions
  },
  {
    id: 'quiz-trong-trot-1',
    title: 'CHỦ ĐỀ 1 GIỚI THIỆU CHUNG VỀ TRỒNG TRỌT.docx',
    fileName: 'CHU_DE_1_GIOI_THIEU_CHUNG_VE_TRONG_TROT.docx',
    subject: 'Công nghệ 12',
    grade: 'Lớp 12',
    createdAt: '07/10/2025',
    questionCount: 37,
    breakdown: '33-4-0-0',
    durationMinutes: 45,
    totalPoints: 10,
    folder: 'CÔNG NGHỆ 12',
    isInteractive: false,
    questions: sampleQuestions
  },
  {
    id: 'quiz-dat-trong-2',
    title: 'CHỦ ĐỀ 2 ĐẤT TRỒNG.docx',
    fileName: 'CHU_DE_2_DAT_TRONG.docx',
    subject: 'Công nghệ 12',
    grade: 'Lớp 12',
    createdAt: '07/10/2025',
    questionCount: 48,
    breakdown: '41-7-0-0',
    durationMinutes: 45,
    totalPoints: 10,
    folder: 'CÔNG NGHỆ 12',
    isInteractive: false,
    questions: sampleQuestions
  },
  {
    id: 'quiz-phan-bon-3',
    title: 'CHỦ ĐỀ 3 PHÂN BÓN.docx',
    fileName: 'CHU_DE_3_PHAN_BON.docx',
    subject: 'Công nghệ 12',
    grade: 'Lớp 12',
    createdAt: '28/10/2025',
    questionCount: 34,
    breakdown: '30-4-0-0',
    durationMinutes: 45,
    totalPoints: 10,
    folder: 'CÔNG NGHỆ 12',
    isInteractive: false,
    questions: sampleQuestions
  }
];

export const mockClassrooms: Classroom[] = [
  {
    id: 'class-cnnn',
    name: 'ÔN THI TỐT NGHIỆP CNNN',
    studentCount: 28,
    academicYear: '2025 - 2026',
    createdAt: '10/04/2026',
    code: 'CNNN25',
    teacherName: 'Thầy Hồ Tấn Khải',
    students: [
      { id: 'st-01', fullName: 'Huỳnh Văn An', studentCode: '25CN001', lastScore: 9.2, completedExams: 14 },
      { id: 'st-02', fullName: 'Trần Thị Mỹ Duyên', studentCode: '25CN002', lastScore: 10.0, completedExams: 15 },
      { id: 'st-03', fullName: 'Lê Hoàng Phúc', studentCode: '25CN003', lastScore: 8.5, completedExams: 13 },
      { id: 'st-04', fullName: 'Nguyễn Minh Trí', studentCode: '25CN004', lastScore: 9.0, completedExams: 14 },
      { id: 'st-05', fullName: 'Phạm Ngọc Thảo', studentCode: '25CN005', lastScore: 9.8, completedExams: 15 }
    ]
  },
  {
    id: 'class-cn12',
    name: 'ÔN THI TỐT NGHIỆP CÔNG NGHỆ 12',
    studentCount: 23,
    academicYear: '2024 - 2025',
    createdAt: '22/05/2025',
    code: 'CN12TN',
    teacherName: 'Thầy Hồ Tấn Khải',
    students: [
      { id: 'st-11', fullName: 'Võ Minh Quân', studentCode: '24CN011', lastScore: 9.5, completedExams: 18 },
      { id: 'st-12', fullName: 'Đỗ Thị Ánh Tuyết', studentCode: '24CN012', lastScore: 8.8, completedExams: 17 },
      { id: 'st-13', fullName: 'Bùi Gia Huy', studentCode: '24CN013', lastScore: 9.0, completedExams: 18 }
    ]
  },
  {
    id: 'class-12a5',
    name: 'LỚP 12A5 - THPT MANG THÍT',
    studentCount: 42,
    academicYear: '2025 - 2026',
    createdAt: '05/09/2025',
    code: '12A5MT',
    teacherName: 'Thầy Hồ Tấn Khải',
    students: [
      { id: 'st-21', fullName: 'Nguyễn Thành Nam', studentCode: '12A501', lastScore: 9.8, completedExams: 22 },
      { id: 'st-22', fullName: 'Lý Kim Ngân', studentCode: '12A502', lastScore: 10.0, completedExams: 22 },
      { id: 'st-23', fullName: 'Phan Quốc Bảo', studentCode: '12A503', lastScore: 9.2, completedExams: 21 }
    ]
  }
];

export const mockSessions: ExamSession[] = [
  {
    id: '4975878',
    title: 'ÔN CN12-1-2-3',
    quizId: 'quiz-cn12',
    className: 'Tất cả lớp học (Khối 12)',
    startTime: '20:37 27/10/2025',
    endTime: '20:37 27/07/2028',
    status: 'active',
    shareUrl: 'https://testonline.thptmangthit.edu.vn/quiz-advance/take/aCyafW/start?name=vip&stt=12a5&sessionId=4975878',
    allowedAttempts: 100,
    durationMinutes: 60,
    totalSubmissions: 312,
    maxSlots: 500,
    isArenaMode: true
  },
  {
    id: 'sess-chude-10',
    title: 'CHỦ ĐỀ 1 CN10',
    quizId: 'quiz-cn10',
    className: 'Không gắn lớp',
    startTime: '16:40 24/10/2025',
    endTime: '16:41 24/07/2027',
    status: 'active',
    shareUrl: 'https://testonline.thptmangthit.edu.vn/quiz-advance/take/bXzkL9/start',
    allowedAttempts: 5,
    durationMinutes: 45,
    totalSubmissions: 145,
    maxSlots: 500,
    isArenaMode: true
  },
  {
    id: 'sess-de-cuong-sinh',
    title: 'DE CUONG SINH 11-CK2- 25-26.XONG.docx',
    quizId: 'quiz-sinh-2025',
    className: 'Khối 11 Tự Nhiên',
    startTime: '13:57:00 12/5/2026',
    endTime: '13:58:00 12/7/2027',
    status: 'active',
    shareUrl: 'https://testonline.thptmangthit.edu.vn/exam/sinh-11-ck2',
    allowedAttempts: 1,
    durationMinutes: 50,
    totalSubmissions: 189,
    maxSlots: 500,
    isArenaMode: false
  },
  {
    id: 'sess-on-tap-nn12',
    title: 'ÔN TẬP CUỐI HỌC KÌ II MÔN CÔNG NGHỆ NÔNG NGHIỆP 12 - GIÁO VIÊN.docx',
    quizId: 'quiz-trong-trot-1',
    className: 'Khối 12',
    startTime: '14:32:00 24/4/2026',
    endTime: '14:32:00 24/6/2027',
    status: 'active',
    shareUrl: 'https://testonline.thptmangthit.edu.vn/exam/nn-12-hk2',
    allowedAttempts: 3,
    durationMinutes: 45,
    totalSubmissions: 240,
    maxSlots: 500,
    isArenaMode: false
  },
  {
    id: 'sess-cuoi-ki-1',
    title: 'Đề kiểm tra: ONLINE Làm đề cuối kì 1.docx',
    quizId: 'quiz-dat-trong-2',
    className: 'Lớp 12A5',
    startTime: '20:06:00 24/12/2025',
    endTime: '20:06:00 24/12/2026',
    status: 'active',
    shareUrl: 'https://testonline.thptmangthit.edu.vn/exam/online-hk1',
    allowedAttempts: 2,
    durationMinutes: 45,
    totalSubmissions: 94,
    maxSlots: 500,
    isArenaMode: false
  }
];
