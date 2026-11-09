const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/admin/users - List all admin accounts
router.get('/', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, name, role, avatar_url, status, created_at, updated_at
       FROM admin_users
       ORDER BY created_at ASC`
    );
    res.json({ admins: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users - Add a new admin (super_admin only)
router.post('/', requireRole('super_admin'), async (req, res) => {
  const { email, name, role = 'admin' } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: 'Email dan nama wajib diisi' });
  }

  const validRoles = ['super_admin', 'admin', 'operator'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Role tidak valid. Pilihan: ${validRoles.join(', ')}` });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already registered
    const existing = await query('SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email admin ini sudah terdaftar sebelumnya' });
    }

    const result = await query(
      `INSERT INTO admin_users (email, name, role, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING id, email, name, role, avatar_url, status, created_at`,
      [normalizedEmail, name.trim(), role]
    );

    res.status(201).json({
      message: 'Admin berhasil ditambahkan',
      admin: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id - Update role or status (super_admin only)
router.patch('/:id', requireRole('super_admin'), async (req, res) => {
  const { id } = req.params;
  const { role, status, name } = req.body;

  try {
    // Prevent deactivating or demoting the last super_admin
    if (status === 'INACTIVE' || (role && role !== 'super_admin')) {
      const targetUser = await query('SELECT role FROM admin_users WHERE id = $1', [id]);
      if (targetUser.rows.length > 0 && targetUser.rows[0].role === 'super_admin') {
        const superCount = await query("SELECT count(*) as count FROM admin_users WHERE role = 'super_admin' AND status = 'ACTIVE'");
        if (parseInt(superCount.rows[0].count) <= 1) {
          return res.status(400).json({ error: 'Tidak dapat menonaktifkan atau mengubah role satu-satunya Super Admin aktif' });
        }
      }
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (role) {
      const validRoles = ['super_admin', 'admin', 'operator'];
      if (!validRoles.includes(role)) return res.status(400).json({ error: 'Role tidak valid' });
      updates.push(`role = $${idx++}`);
      values.push(role);
    }

    if (status) {
      if (!['ACTIVE', 'INACTIVE'].includes(status)) return res.status(400).json({ error: 'Status tidak valid' });
      updates.push(`status = $${idx++}`);
      values.push(status);
    }

    if (name) {
      updates.push(`name = $${idx++}`);
      values.push(name.trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Tidak ada perubahan yang dikirim' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE admin_users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, name, role, status, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admin tidak ditemukan' });
    }

    res.json({ message: 'Data admin berhasil diperbarui', admin: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id - Delete an admin (super_admin only)
router.delete('/:id', requireRole('super_admin'), async (req, res) => {
  const { id } = req.params;

  try {
    if (parseInt(req.user.id) === parseInt(id)) {
      return res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri' });
    }

    const targetUser = await query('SELECT role FROM admin_users WHERE id = $1', [id]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'Admin tidak ditemukan' });
    }

    if (targetUser.rows[0].role === 'super_admin') {
      const superCount = await query("SELECT count(*) as count FROM admin_users WHERE role = 'super_admin'");
      if (parseInt(superCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Tidak dapat menghapus Super Admin terakhir' });
      }
    }

    await query('DELETE FROM admin_users WHERE id = $1', [id]);
    res.json({ message: 'Admin berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

