const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

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

module.exports = router;
