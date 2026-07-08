const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const multer = require('multer');
const { recognizeFaceFromBuffer } = require('../services/compreface');
const { processAttendance } = require('../mqtt');

// Use memory storage for fast in-memory image processing
const upload = multer({ storage: multer.memoryStorage() });

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
// Accept an image frame from the kiosk UI and process it with CompreFace
router.post('/recognize', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Call CompreFace to recognize the face
    const result = await recognizeFaceFromBuffer(req.file.buffer, 'frame.jpg');

    if (!result || !result.result || result.result.length === 0) {
      return res.status(200).json({ success: false, message: 'Wajah tidak terdeteksi atau tidak dikenali' });
    }

    // Get the top match
    const match = result.result[0].subjects[0];
    if (!match) {
      return res.status(200).json({ success: false, message: 'Wajah tidak dikenali dalam database' });
    }

    const confidence = match.similarity * 100;
    const subjectName = match.subject;

    // Check confidence against threshold from env or default 80
    const threshold = parseFloat(process.env.CONFIDENCE_THRESHOLD) || 80;
    if (confidence < threshold) {
      return res.status(200).json({ 
        success: false, 
        message: `Kepercayaan rendah (${confidence.toFixed(1)}% < ${threshold}%) untuk ${subjectName}` 
      });
    }

    // Process attendance using existing logic
    const io = req.app.get('io');
    processAttendance(subjectName, confidence, io);

    res.status(200).json({ 
      success: true, 
      subject: subjectName, 
      confidence 
    });

  } catch (err) {
    console.error('[Attendance] Recognize error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
