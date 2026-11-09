const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/kiosks/status/:kioskId - Check kiosk status & retrieve authorization token
router.get('/status/:kioskId', async (req, res) => {
  const { kioskId } = req.params;
  const clientToken = req.headers['x-kiosk-token'];

  try {
    const result = await query(
      `SELECT id, kiosk_id, name, status, secret_token, last_seen FROM kiosks WHERE kiosk_id = $1`,
      [kioskId]
    );

    if (result.rows.length === 0) {
      // Auto-register pending kiosk with a unique secret token
      const newToken = crypto.randomBytes(32).toString('hex');
      const insertRes = await query(
        `INSERT INTO kiosks (kiosk_id, secret_token, name, status, ip_address, user_agent)
         VALUES ($1, $2, $3, 'PENDING', $4, $5)
         RETURNING kiosk_id, name, status, last_seen, secret_token`,
        [kioskId, newToken, `Kiosk ${kioskId.slice(-6).toUpperCase()}`, req.ip, req.headers['user-agent'] || '']
      );
      return res.json({
        kiosk: insertRes.rows[0],
        secret_token: newToken,
        is_approved: false,
      });
    }

    const kiosk = result.rows[0];

    // If kiosk is already approved and the client has the matching token (or token was just generated)
    let secretToken = kiosk.secret_token;
    if (!secretToken) {
      secretToken = crypto.randomBytes(32).toString('hex');
      await query('UPDATE kiosks SET secret_token = $1 WHERE id = $2', [secretToken, kiosk.id]);
    }

    const isTokenMatching = clientToken && clientToken === secretToken;
    const isApproved = kiosk.status === 'APPROVED' && (!clientToken || isTokenMatching);

    res.json({
      kiosk: {
        kiosk_id: kiosk.kiosk_id,
        name: kiosk.name,
        status: kiosk.status,
        last_seen: kiosk.last_seen,
      },
      secret_token: secretToken,
      is_approved: kiosk.status === 'APPROVED',
      is_authenticated: isTokenMatching,
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
      `SELECT k.id, k.kiosk_id, k.name, k.status, k.secret_token, k.ip_address, k.user_agent, k.last_seen, k.created_at,
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
    const existing = await query('SELECT * FROM kiosks WHERE kiosk_id = $1', [kioskId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Kiosk tidak ditemukan' });
    }

    let secretToken = existing.rows[0].secret_token;
    if (!secretToken) {
      secretToken = crypto.randomBytes(32).toString('hex');
    }

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

    updates.push(`secret_token = $${idx++}`);
    values.push(secretToken);

    values.push(kioskId);

    const result = await query(
      `UPDATE kiosks SET ${updates.join(', ')} WHERE kiosk_id = $${idx} RETURNING *`,
      values
    );

    const updatedKiosk = result.rows[0];

    // Broadcast kiosk status change via socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`kiosk:${kioskId}`).emit('kiosk:status_changed', {
        ...updatedKiosk,
        secret_token: secretToken,
      });
      io.emit('kiosks:updated', updatedKiosk);
    }

    res.json({ message: 'Status kiosk berhasil diperbarui', kiosk: updatedKiosk });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/kiosks/:kioskId/reset-token - Reset cryptographic security token for a kiosk
router.post('/:kioskId/reset-token', requireRole(['super_admin', 'admin']), async (req, res) => {
  const { kioskId } = req.params;
  const newToken = crypto.randomBytes(32).toString('hex');

  try {
    const result = await query(
      `UPDATE kiosks SET secret_token = $1 WHERE kiosk_id = $2 RETURNING *`,
      [newToken, kioskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kiosk tidak ditemukan' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`kiosk:${kioskId}`).emit('kiosk:token_rotated', { secret_token: newToken });
    }

    res.json({ message: 'Kiosk secret token berhasil di-reset', secret_token: newToken });
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
