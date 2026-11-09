const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const multer = require('multer');
const { recognizeFaceFromBuffer } = require('../services/compreface');
const { checkLiveness } = require('../services/antispoof');
const { recordAttendance, CONFIDENCE_THRESHOLD } = require('../services/attendanceService');

// Use memory storage for fast in-memory image processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ─── GET /api/attendance ──────────────────────────────────────────────────────
// Query params: date (YYYY-MM-DD), user_id, limit (default 100), offset (default 0)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { date, user_id, limit = 100, offset = 0 } = req.query;

    let whereConditions = [];
    let params = [];

    if (date) {
      whereConditions.push("date(al.timestamp) = date(?)");
      params.push(date);
    }

    if (user_id) {
      whereConditions.push("al.user_id = ?");
      params.push(user_id);
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const logs = db.prepare(`
      SELECT 
        al.id,
        al.timestamp,
        al.status,
        al.confidence,
        u.id as user_id,
        u.name,
        u.nomor_induk,
        u.photo_url
      FROM attendance_logs al
      JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.timestamp DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), parseInt(offset));

    const total = db.prepare(`
      SELECT COUNT(*) as count 
      FROM attendance_logs al
      JOIN users u ON al.user_id = u.id
      ${whereClause}
    `).get(...params);

    res.json({ logs, total: total.count, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/attendance/stats/today ─────────────────────────────────────────
router.get('/stats/today', (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    const totalToday = db.prepare(`
      SELECT COUNT(*) as count FROM attendance_logs
      WHERE date(timestamp) = date(?)
    `).get(today);

    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();

    const latestLog = db.prepare(`
      SELECT al.*, u.name, u.nomor_induk, u.photo_url
      FROM attendance_logs al
      JOIN users u ON al.user_id = u.id
      ORDER BY al.timestamp DESC
      LIMIT 1
    `).get();

    const hourlyBreakdown = db.prepare(`
      SELECT 
        strftime('%H', timestamp) as hour,
        COUNT(*) as count
      FROM attendance_logs
      WHERE date(timestamp) = date(?)
      GROUP BY hour
      ORDER BY hour ASC
    `).all(today);

    res.json({
      date: today,
      totalAttendanceToday: totalToday.count,
      totalUsers: totalUsers.count,
      latestLog,
      hourlyBreakdown,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/attendance/export ───────────────────────────────────────────────
// Export attendance as CSV
router.get('/export', (req, res) => {
  try {
    const db = getDb();
    const { date, user_id } = req.query;

    let whereConditions = [];
    let params = [];

    if (date) {
      whereConditions.push("date(al.timestamp) = date(?)");
      params.push(date);
    }
    if (user_id) {
      whereConditions.push("al.user_id = ?");
      params.push(user_id);
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const logs = db.prepare(`
      SELECT 
        al.id,
        u.nomor_induk,
        u.name,
        al.timestamp,
        al.status,
        al.confidence
      FROM attendance_logs al
      JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.timestamp DESC
    `).all(...params);

    const csvHeader = 'ID,Nomor Induk,Nama,Timestamp,Status,Confidence\n';
    const csvRows = logs.map(log =>
      `${log.id},"${log.nomor_induk}","${log.name}","${log.timestamp}","${log.status}",${log.confidence ? log.confidence.toFixed(1) : ''}`
    ).join('\n');

    const filename = `absensi_${date || 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvHeader + csvRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/attendance/recognize ───────────────────────────────────────────
// Accept an image frame from the kiosk UI, detect multiple faces, check liveness, and log attendance
router.post('/recognize', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const io = req.app.get('io');
    const imageBuffer = req.file.buffer;

    // Recognize all faces in the frame (limit=0 returns all detected faces)
    const result = await recognizeFaceFromBuffer(imageBuffer, 'frame.jpg');

    if (!result || !result.result || result.result.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'Tidak ada wajah terdeteksi',
        total_faces: 0,
        faces: [],
      });
    }

    const detectedFaces = result.result;
    const faceResults = [];

    for (const faceItem of detectedFaces) {
      const box = faceItem.box || {};

      // 1. Anti-Spoofing (Passive Liveness Check)
      const liveness = await checkLiveness(imageBuffer, box);

      if (!liveness.is_real) {
        console.warn(`[Anti-Spoof] Spoof attack detected! Liveness: ${(liveness.score * 100).toFixed(1)}%`);
        faceResults.push({
          status: 'spoof',
          is_real: false,
          liveness_score: liveness.score,
          box,
          message: 'Peringatan: Spoofing terdeteksi (Layar HP / Foto Cetak)',
        });
        continue;
      }

      // 2. Face Recognition Match Check
      const topSubject = faceItem.subjects && faceItem.subjects.length > 0 ? faceItem.subjects[0] : null;

      if (!topSubject) {
        faceResults.push({
          status: 'unknown',
          is_real: true,
          liveness_score: liveness.score,
          box,
          message: 'Wajah tidak terdaftar dalam sistem',
        });
        continue;
      }

      const similarity = topSubject.similarity || 0;
      const confidence = similarity * 100;
      const subjectName = topSubject.subject;

      // 3. Process Attendance Record
      const attendanceResult = recordAttendance(subjectName, confidence, io);

      if (attendanceResult.status === 'recorded') {
        faceResults.push({
          status: 'recognized',
          is_real: true,
          liveness_score: liveness.score,
          user: attendanceResult.user,
          confidence,
          box,
          log: attendanceResult.log,
          message: `Absen berhasil: ${attendanceResult.user.name}`,
        });
      } else if (attendanceResult.status === 'debounced') {
        faceResults.push({
          status: 'debounced',
          is_real: true,
          liveness_score: liveness.score,
          user: attendanceResult.user,
          confidence,
          remaining_seconds: attendanceResult.remainingSeconds,
          box,
          message: `Sudah absen sebelumnya: ${attendanceResult.user.name}`,
        });
      } else if (attendanceResult.status === 'low_confidence') {
        faceResults.push({
          status: 'low_confidence',
          is_real: true,
          liveness_score: liveness.score,
          subject: subjectName,
          confidence,
          box,
          message: `Kepercayaan rendah (${confidence.toFixed(1)}% < ${CONFIDENCE_THRESHOLD}%)`,
        });
      } else {
        faceResults.push({
          status: 'unknown',
          is_real: true,
          liveness_score: liveness.score,
          subject: subjectName,
          box,
          message: 'Data pengguna tidak ditemukan di database',
        });
      }
    }

    res.status(200).json({
      success: true,
      total_faces: detectedFaces.length,
      faces: faceResults,
    });
  } catch (err) {
    console.error('[Attendance] Recognize error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
