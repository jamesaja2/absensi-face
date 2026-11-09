const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/kiosks/status/:kioskId - Public check for kiosk frontend status
router.get('/status/:kioskId', async (req, res) => {
  const { kioskId } = req.params;

  try {
    const result = await query(
      `SELECT kiosk_id, name, status, last_seen FROM kiosks WHERE kiosk_id = $1`,
      [kioskId]
    );

    if (result.rows.length === 0) {
      // Auto-register pending kiosk
      const insertRes = await query(
        `INSERT INTO kiosks (kiosk_id, name, status, ip_address, user_agent)
         VALUES ($1, $2, 'PENDING', $3, $4)
         RETURNING kiosk_id, name, status, last_seen`,
        [kioskId, `Kiosk ${kioskId.slice(-6).toUpperCase()}`, req.ip, req.headers['user-agent'] || '']
      );
      return res.json({ kiosk: insertRes.rows[0], is_approved: false });
    }

    const kiosk = result.rows[0];
    res.json({
      kiosk,
      is_approved: kiosk.status === 'APPROVED',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Protected Admin Endpoints ──
router.use(authenticateToken);

// GET /api/admin/kiosks - List all kiosks
router.get('/', requireRole(['super_admin', 'admin', 'operator']), async (req, res) => {
  try {
    const result = await query(
      `SELECT k.*,
              (SELECT count(*) FROM attendance_logs a WHERE a.kiosk_id = k.kiosk_id) as total_attendance,
              (SELECT count(*) FROM attendance_logs a WHERE a.kiosk_id = k.kiosk_id AND a.timestamp::date = CURRENT_DATE) as today_attendance
       FROM kiosks k
       ORDER BY k.last_seen DESC NULLS LAST, k.created_at DESC`
    );
    res.json({ kiosks: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/kiosks/:kioskId - Update status (Approve/Reject) or name
router.patch('/:kioskId', requireRole(['super_admin', 'admin']), async (req, res) => {
  const { kioskId } = req.params;
  const { status, name } = req.body;

  try {
    const updates = [];
    const values = [];
    let idx = 1;

    if (status) {
      const validStatuses = ['APPROVED', 'PENDING', 'REJECTED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status tidak valid. Pilihan: ${validStatuses.join(', ')}` });
      }
      updates.push(`status = $${idx++}`);
      values.push(status);
    }

    if (name) {
      updates.push(`name = $${idx++}`);
      values.push(name.trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data untuk diperbarui' });
    }

    values.push(kioskId);

    const result = await query(
      `UPDATE kiosks SET ${updates.join(', ')} WHERE kiosk_id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kiosk tidak ditemukan' });
    }

    // Broadcast kiosk status change via socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`kiosk:${kioskId}`).emit('kiosk:status_changed', result.rows[0]);
      io.emit('kiosks:updated', result.rows[0]);
    }

    res.json({ message: 'Status kiosk berhasil diperbarui', kiosk: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/kiosks/:kioskId - Delete kiosk
router.delete('/:kioskId', requireRole(['super_admin', 'admin']), async (req, res) => {
  const { kioskId } = req.params;

  try {
    await query('DELETE FROM kiosks WHERE kiosk_id = $1', [kioskId]);
    res.json({ message: 'Kiosk berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
