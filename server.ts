import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Initialize GoogleGenAI SDK
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Cloud Storage persistent directory with Sync Key support
const DATA_DIR = path.join(__dirname, '.data');
const SYNC_KEYS_DIR = path.join(DATA_DIR, 'sync_keys');
const CLOUD_STORE_FILE = path.join(DATA_DIR, 'cloud_store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SYNC_KEYS_DIR)) {
  fs.mkdirSync(SYNC_KEYS_DIR, { recursive: true });
}

function sanitizeSyncKey(key?: any): string {
  if (!key || typeof key !== 'string') return 'THPT-MANGTHIT-KHAI-2026';
  const clean = key.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return clean || 'THPT-MANGTHIT-KHAI-2026';
}

// Ensure cloud state by sync key with fallback
function getCloudData(syncKey?: string) {
  const cleanKey = sanitizeSyncKey(syncKey);
  const keyFile = path.join(SYNC_KEYS_DIR, `${cleanKey}.json`);

  if (fs.existsSync(keyFile)) {
    try {
      const content = fs.readFileSync(keyFile, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.error(`Error reading sync key store (${cleanKey}):`, err);
    }
  }

  // Fallback to default cloud_store.json
  if (fs.existsSync(CLOUD_STORE_FILE)) {
    try {
      const content = fs.readFileSync(CLOUD_STORE_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.error('Error reading cloud store:', err);
    }
  }
  return null;
}

function saveCloudData(data: any, syncKey?: string) {
  const cleanKey = sanitizeSyncKey(syncKey || data?.syncKey);
  const keyFile = path.join(SYNC_KEYS_DIR, `${cleanKey}.json`);

  try {
    const payloadWithMeta = {
      ...data,
      syncKey: cleanKey,
      serverSavedAt: new Date().toISOString()
    };
    const content = JSON.stringify(payloadWithMeta, null, 2);

    // Write under specific sync key
    fs.writeFileSync(keyFile, content, 'utf-8');

    // Also update default active file for instant access
    fs.writeFileSync(CLOUD_STORE_FILE, content, 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error saving cloud store (${cleanKey}):`, err);
    return false;
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    appName: 'Test Online - THPT Mang Thít',
    author: 'Hồ Tấn Khải',
    hasGeminiKey: Boolean(apiKey),
    timestamp: new Date().toISOString(),
  });
});

// Cloud Sync endpoints with Sync Key support
app.get('/api/cloud/data', (req, res) => {
  const syncKey = (req.query.syncKey as string) || (req.query.key as string);
  const data = getCloudData(syncKey);
  res.json({
    success: true,
    data,
    syncKey: sanitizeSyncKey(syncKey),
    found: Boolean(data)
  });
});

app.post('/api/cloud/sync', (req, res) => {
  const payload = req.body;
  if (!payload) {
    return res.status(400).json({ success: false, error: 'Thiếu dữ liệu' });
  }
  const syncKey = sanitizeSyncKey(payload.syncKey || (req.query.syncKey as string));
  const saved = saveCloudData(payload, syncKey);
  res.json({
    success: saved,
    syncKey,
    message: saved
      ? `Đã lưu và đồng bộ thành công lên máy chủ với Mã Khóa [${syncKey}]!`
      : 'Lỗi khi lưu trữ đám mây',
    timestamp: new Date().toLocaleString('vi-VN'),
  });
});

// Student exam fetch endpoint: allows student devices to directly fetch questions from server
app.get('/api/exam/:id', (req, res) => {
  const examId = req.params.id;
  if (!examId) return res.status(400).json({ success: false, error: 'Thiếu mã đề/phiên thi' });

  // Read latest server state
  const data = getCloudData();
  if (!data) {
    return res.json({ success: false, error: 'Chưa có dữ liệu đề thi trên máy chủ', questions: [] });
  }

  // Look for matching session
  const session = data.sessions?.find((s: any) => s.id === examId || s.quizId === examId);
  // Look for matching quiz
  const quiz = data.quizzes?.find(
    (q: any) =>
      q.id === examId ||
      (session && q.id === session.quizId) ||
      q.id?.slice(0, 6) === examId ||
      q.title === examId ||
      examId.startsWith(q.id?.slice(0, 6))
  );

  const questions = (quiz?.questions && quiz.questions.length > 0)
    ? quiz.questions
    : [];

  return res.json({
    success: true,
    examId,
    session,
    quiz,
    questions,
    found: Boolean(quiz || session)
  });
});

// AI Generate Quiz Endpoint
app.post('/api/ai/generate-quiz', async (req, res) => {
  try {
    const { topic, subject, grade, questionCount, difficulty } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Chủ đề thi không được để trống' });
    }

    const count = Math.min(Math.max(parseInt(questionCount, 10) || 5, 1), 30);
    const targetSubject = subject || 'Công nghệ 12';
    const targetGrade = grade || 'Lớp 12';

    const prompt = `Bạn là chuyên gia sư phạm THPT tại Việt Nam (thuộc trường THPT Mang Thít).
Hãy tạo ${count} câu hỏi trắc nghiệm khách quan chuẩn chương trình GDPT 2018 cho môn "${targetSubject}", ${targetGrade}.
Chủ đề: "${topic}".
Mức độ: ${difficulty || 'Thông hiểu và Vận dụng'}.

Yêu cầu định dạng:
- Mỗi câu hỏi có 4 phương án lựa chọn: A, B, C, D.
- Xác định rõ đáp án đúng (correctAnswer là "A", "B", "C", hoặc "D").
- Kèm lời giải thích chi tiết, sư phạm, khoa học chuẩn SGK.
- Trả về JSON theo định dạng chuẩn.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            quizTitle: {
              type: Type.STRING,
              description: 'Tiêu đề đề thi chuẩn',
            },
            description: {
              type: Type.STRING,
              description: 'Mô tả ngắn gọn về nội dung ôn tập',
            },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  order: { type: Type.INTEGER },
                  content: { type: Type.STRING, description: 'Nội dung câu hỏi' },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        key: { type: Type.STRING, description: 'A, B, C hoặc D' },
                        text: { type: Type.STRING, description: 'Nội dung phương án' },
                        isCorrect: { type: Type.BOOLEAN },
                      },
                      required: ['key', 'text', 'isCorrect'],
                    },
                  },
                  correctAnswer: { type: Type.STRING, description: 'A, B, C hoặc D' },
                  explanation: { type: Type.STRING, description: 'Lời giải thích sư phạm chi tiết' },
                },
                required: ['order', 'content', 'options', 'correctAnswer', 'explanation'],
              },
            },
          },
          required: ['quizTitle', 'questions'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Gemini Generate Quiz Error:', error);
    return res.status(500).json({
      error: 'Không thể tạo đề thi bằng AI: ' + (error?.message || 'Lỗi kết nối'),
    });
  }
});

// AI Explain Question Tutor
app.post('/api/ai/explain-question', async (req, res) => {
  try {
    const { questionContent, options, selectedAnswer, correctAnswer, subject } = req.body;

    const prompt = `Bạn là thầy giáo trợ giảng ảo thân thiện của trường THPT Mang Thít (hệ thống Test Online).
Học sinh vừa làm câu hỏi môn ${subject || 'Công nghệ / Sinh học'}:
Câu hỏi: "${questionContent}"
Các lựa chọn:
${options?.map((o: any) => `${o.key}. ${o.text}`).join('\n')}

Đáp án đúng của đề: ${correctAnswer}
Học sinh đã chọn: ${selectedAnswer || 'Chưa chọn'}

Hãy giải thích bằng tiếng Việt một cách dễ hiểu, sinh động:
1. Vì sao đáp án đúng là ${correctAnswer}?
2. Phân tích vì sao các đáp án còn lại chưa chính xác?
3. Một mẹo ghi nhớ nhanh kiến thức này cho học sinh THPT.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({ success: true, explanation: response.text });
  } catch (error: any) {
    console.error('Gemini Explain Error:', error);
    return res.status(500).json({
      error: 'Không thể gọi gia sư AI: ' + (error?.message || 'Lỗi kết nối'),
    });
  }
});

// AI Analyze Class Results
app.post('/api/ai/analyze-results', async (req, res) => {
  try {
    const { examTitle, submissionsCount, averageScore, lowScoreCount, passRate } = req.body;

    const prompt = `Bạn là chuyên gia phân tích chất lượng giáo dục trường THPT Mang Thít.
Hãy phân tích báo cáo kết quả thi trực tuyến của kỳ thi: "${examTitle || 'Kiểm tra trắc nghiệm'}":
- Tổng số bài nộp đồng thời: ${submissionsCount || 500} học sinh
- Điểm trung bình toàn khối: ${averageScore || 8.2} / 10
- Tỷ lệ đạt chuẩn: ${passRate || '96%'}
- Số học sinh cần hỗ trợ bổ sung: ${lowScoreCount || 12}

Hãy đưa ra đánh giá sư phạm súc tích (khoảng 3-4 đoạn):
1. Nhận xét tổng quan về phổ điểm và mức độ phân hóa đề thi.
2. Đề xuất các mảng kiến thức giáo viên cần củng cố lại cho học sinh.
3. Lời khuyên tối ưu cho các đợt thi trực tuyến quy mô lớn tiếp theo.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({ success: true, analysis: response.text });
  } catch (error: any) {
    console.error('Gemini Analyze Results Error:', error);
    return res.status(500).json({
      error: 'Không thể phân tích bằng AI: ' + (error?.message || 'Lỗi kết nối'),
    });
  }
});

// Setup Vite in Dev or Static files in Production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Vite Dev Server Middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve dist
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Test Online Server running on http://0.0.0.0:${PORT} [${isProd ? 'Production' : 'Development'}]`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
