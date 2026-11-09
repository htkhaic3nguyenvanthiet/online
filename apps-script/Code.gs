/****************************************************************************************
 * KHO ĐỀ TRỰC TUYẾN (GOOGLE) — TestOnline_KhoDe
 * Backend cho trang "Bài Kiểm Tra Trực Tuyến" (Test Online) của Thầy Hồ Tấn Khải.
 *
 * CÁCH TRIỂN KHAI (làm 1 lần duy nhất — xem thêm file HUONG_DAN_KHO_DE_GOOGLE.md):
 *   1. Tạo một Google Sheet mới (bảng tính trống cũng được).
 *   2. Trong Sheet: menu "Tiện ích mở rộng" (Extensions) -> "Apps Script".
 *   3. Xóa nội dung mặc định trong trình soạn thảo, dán TOÀN BỘ file Code.gs này vào, bấm Lưu.
 *   4. Chọn hàm "setup" ở thanh công cụ rồi bấm "Chạy" (Run). Lần đầu Google sẽ xin quyền
 *      truy cập Drive/Sheet — hãy cấp quyền (nó chỉ dùng trong tài khoản Google của Thầy).
 *   5. Mở "Nhật ký thực thi" (Execution log) ở panel bên dưới: copy dòng "MÃ BẢO MẬT"
 *      — đây là mã riêng của Thầy, KHÔNG chia sẻ cho học sinh.
 *   6. Bấm "Triển khai" (Deploy) -> "Lần triển khai mới" (New deployment) -> loại
 *      "Ứng dụng web" (Web app): "Thực thi bằng tài khoản của tôi" (Execute as: Me),
 *      "Ai có liên kết đều truy cập được" (Who has access: Anyone) -> Triển khai.
 *   7. Copy "URL ứng dụng web" (dạng https://script.google.com/macros/s/AKfyc.../exec)
 *      và dán vào trang web kiểm tra: mục Cài đặt -> "Kho đề trực tuyến (Google)",
 *      cùng với Mã bảo mật ở bước 5, rồi bấm "Kiểm tra kết nối".
 *
 * CẬP NHẬT MÃ SAU NÀY: nếu Thầy sửa Code.gs, phải tạo BẢN TRIỂN KHAI MỚI
 * (Deploy -> New deployment) thì URL /exec mới dùng bản mã mới. URL sẽ thay đổi —
 * nhớ dán URL mới vào trang web và gửi lại link thi cho học sinh.
 *
 * LƯU TRỮ:
 *   - Nội dung đề thi (JSON, có thể kèm ảnh base64 rất lớn) lưu thành file trong thư mục
 *     Drive tên "TestOnline_KhoDe" — KHÔNG nhét vào ô Sheet vì ô Sheet giới hạn ~50.000 ký tự.
 *   - Sheet "Exams":      examId | title | subject | createdAt | driveFileId | questionCount
 *   - Sheet "Submissions": timestamp | examId | studentName | className | score | totalPoints | detailJson
 ****************************************************************************************/

var FOLDER_NAME = 'TestOnline_KhoDe';
var EXAMS_SHEET = 'Exams';
var SUBMISSIONS_SHEET = 'Submissions';
var TOKEN_PROPERTY = 'TEACHER_TOKEN';

/* ============================== TIỆN ÍCH CHUNG ============================== */

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getToken_() {
  return PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY) || '';
}

function getFolder_() {
  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(FOLDER_NAME);
}

function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function getExamsSheet_() {
  return getSheet_(EXAMS_SHEET, ['examId', 'title', 'subject', 'createdAt', 'driveFileId', 'questionCount']);
}

function getSubmissionsSheet_() {
  return getSheet_(SUBMISSIONS_SHEET, ['timestamp', 'examId', 'studentName', 'className', 'score', 'totalPoints', 'detailJson']);
}

/** Tìm dòng (số thứ tự, bắt đầu từ 2) của một examId trong sheet Exams; -1 nếu không có. */
function findExamRow_(sheet, examId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(examId)) return i + 2;
  }
  return -1;
}

/** Sinh mã đề ngắn 8 ký tự (chữ + số viết hoa), kiểm tra không trùng trong sheet Exams. */
function mintExamId_(sheet) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (var attempt = 0; attempt < 20; attempt++) {
    var id = '';
    for (var i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (findExamRow_(sheet, id) === -1) return id;
  }
  // Cực kỳ hiếm: thêm hậu tố thời gian cho chắc chắn duy nhất
  return (id || 'EXAM') + String(new Date().getTime() % 1000);
}

function examFileName_(examId) {
  return 'exam_' + examId + '.json';
}

/* ============================== SETUP (chạy 1 lần) ============================== */

function setup() {
  var folder = getFolder_();
  var exams = getExamsSheet_();
  var subs = getSubmissionsSheet_();

  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty(TOKEN_PROPERTY);
  if (!token) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    token = '';
    for (var i = 0; i < 24; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    props.setProperty(TOKEN_PROPERTY, token);
  }

  Logger.log('=== KHO ĐỀ TRỰC TUYẾN — THIẾT LẬP THÀNH CÔNG ===');
  Logger.log('Thư mục Drive lưu đề: "' + FOLDER_NAME + '" (id: ' + folder.getId() + ')');
  Logger.log('Sheet Exams: ' + exams.getName() + ' | Sheet Submissions: ' + subs.getName());
  Logger.log('MÃ BẢO MẬT CỦA THẦY (dán vào trang web, KHÔNG gửi cho học sinh): ' + token);
  Logger.log('Bước tiếp theo: Triển khai (Deploy) -> Ứng dụng web, rồi copy URL /exec vào trang web.');
  return token;
}

/* ============================== HTTP: GET ============================== */

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || 'ping';

    if (action === 'ping') {
      return jsonOutput_({ ok: true, service: 'TestOnlineKho', version: 1 });
    }

    if (action === 'getExam') {
      var examId = params.id || params.examId || '';
      if (!examId) return jsonOutput_({ found: false, error: 'missing_id' });

      var sheet = getExamsSheet_();
      var row = findExamRow_(sheet, examId);
      if (row === -1) return jsonOutput_({ found: false });

      var driveFileId = String(sheet.getRange(row, 5).getValue() || '');
      var file = null;
      if (driveFileId) {
        try { file = DriveApp.getFileById(driveFileId); } catch (err) { file = null; }
      }
      if (!file) {
        var files = getFolder_().getFilesByName(examFileName_(examId));
        if (files.hasNext()) file = files.next();
      }
      if (!file) return jsonOutput_({ found: false });

      var payload = JSON.parse(file.getBlob().getDataAsString());
      payload.found = true;
      payload.examId = examId;
      return jsonOutput_(payload);
    }

    return jsonOutput_({ ok: false, error: 'unknown_action', action: action });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  }
}

/* ============================== HTTP: POST ============================== */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return jsonOutput_({ ok: false, error: 'server_busy' });
  }
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action = body.action || '';

    if (action === 'saveExam') return jsonOutput_(handleSaveExam_(body));
    if (action === 'submit') return jsonOutput_(handleSubmit_(body));
    if (action === 'listSubmissions') return jsonOutput_(handleListSubmissions_(body));

    return jsonOutput_({ ok: false, error: 'unknown_action', action: action });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function checkToken_(body) {
  var token = getToken_();
  return !!token && String(body.token || '') === token;
}

/** {action:"saveExam", token, exam:{examId?, session, quiz, questions}} -> {ok, examId} */
function handleSaveExam_(body) {
  if (!checkToken_(body)) return { ok: false, error: 'bad_token' };
  var exam = body.exam || {};
  var questions = exam.questions || [];
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, error: 'no_questions' };
  }

  var sheet = getExamsSheet_();

  // Dùng lại examId do trang web gửi lên nếu hợp lệ (đăng lại cùng một đề),
  // ngược lại tự sinh mã ngắn 8 ký tự không trùng.
  var examId = '';
  var requested = String(exam.examId || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (requested && requested.length >= 4 && requested.length <= 32) {
    examId = requested;
  } else {
    examId = mintExamId_(sheet);
  }

  var title = String((exam.session && exam.session.title) || (exam.quiz && exam.quiz.title) || 'Bài kiểm tra trực tuyến');
  var subject = String((exam.quiz && exam.quiz.subject) || '');
  var nowIso = new Date().toISOString();

  var payloadToStore = {
    examId: examId,
    savedAt: nowIso,
    session: exam.session || null,
    quiz: exam.quiz || null,
    questions: questions
  };
  var content = JSON.stringify(payloadToStore);

  // Ghi (hoặc ghi đè) file JSON trong thư mục Drive
  var folder = getFolder_();
  var file = null;
  var existing = folder.getFilesByName(examFileName_(examId));
  if (existing.hasNext()) file = existing.next();
  if (file) {
    file.setContent(content);
  } else {
    file = folder.createFile(examFileName_(examId), content, MimeType.PLAIN_TEXT);
  }

  // Upsert dòng trong sheet Exams
  var row = findExamRow_(sheet, examId);
  var values = [examId, title, subject, nowIso, file.getId(), questions.length];
  if (row === -1) {
    sheet.appendRow(values);
  } else {
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
  }

  return { ok: true, examId: examId };
}

/** {action:"submit", examId, submission:{studentName, className, score, totalPoints, detail}} -> {ok} */
function handleSubmit_(body) {
  var examId = String(body.examId || '');
  if (!examId) return { ok: false, error: 'missing_exam_id' };

  var examsSheet = getExamsSheet_();
  if (findExamRow_(examsSheet, examId) === -1) {
    return { ok: false, error: 'exam_not_found' };
  }

  var sub = body.submission || {};
  var detail = sub.detail || {};
  var sheet = getSubmissionsSheet_();
  sheet.appendRow([
    new Date().toISOString(),
    examId,
    String(sub.studentName || ''),
    String(sub.className || ''),
    Number(sub.score || 0),
    Number(sub.totalPoints || 10),
    JSON.stringify(detail)
  ]);
  return { ok: true };
}

/** {action:"listSubmissions", token, examId} -> {ok, submissions:[...]} */
function handleListSubmissions_(body) {
  if (!checkToken_(body)) return { ok: false, error: 'bad_token' };
  var examId = String(body.examId || '');
  if (!examId) return { ok: false, error: 'missing_exam_id' };

  var sheet = getSubmissionsSheet_();
  var lastRow = sheet.getLastRow();
  var out = [];
  if (lastRow >= 2) {
    var rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][1]) !== examId) continue;
      var detail = null;
      try { detail = JSON.parse(String(rows[i][6] || '')); } catch (err) { detail = null; }
      out.push({
        timestamp: rows[i][0] instanceof Date ? rows[i][0].toISOString() : String(rows[i][0]),
        examId: examId,
        studentName: String(rows[i][2] || ''),
        className: String(rows[i][3] || ''),
        score: Number(rows[i][4] || 0),
        totalPoints: Number(rows[i][5] || 10),
        detail: detail
      });
    }
  }
  return { ok: true, submissions: out };
}
