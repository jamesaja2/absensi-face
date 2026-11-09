const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { query } = require('../db');
const { addSubject, trainFaceFromUrl, trainFaceFromBuffer, deleteSubject } = require('../services/compreface');
const { importUsersFromCSV } = require('../services/csvImport');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Configure multer for photo uploads and CSV
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const photoTypes = /jpeg|jpg|png|webp/;
    const csvTypes = /csv/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (photoTypes.test(ext) || csvTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, and CSV files are allowed'));
    }
  },
});

// ─── GET /api/users ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search.trim().toLowerCase()}%` : null;

    let sql = `
      SELECT 
        u.*,
        COUNT(al.id) as total_attendance,
        MAX(al.timestamp) as last_attendance
      FROM users u
      LEFT JOIN attendance_logs al ON al.user_id = u.id
    `;
    const params = [];

    if (search) {
      params.push(search);
      sql += ` WHERE LOWER(u.name) LIKE $1 OR LOWER(u.nomor_induk) LIKE $1 OR LOWER(COALESCE(u.email, '')) LIKE $1 `;
    }

    sql += ` GROUP BY u.id ORDER BY u.name ASC `;

    const result = await query(sql, params);
    res.json({ users: result.rows, total: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/users ─────────────────────────────────────────────────────────
router.post('/', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { name, nomor_induk, email, photo_url } = req.body;
    if (!name || !nomor_induk) {
      return res.status(400).json({ error: 'name and nomor_induk are required' });
    }

    const cleanSubjectName = name.trim().replace(/[^a-zA-Z0-9]/g, '_');
    const subjectId = `${nomor_induk.trim()}_${cleanSubjectName}`;

    const insertResult = await query(
      `INSERT INTO users (name, nomor_induk, email, photo_url, compreface_subject_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name.trim(), nomor_induk.trim(), email ? email.trim() : null, photo_url ? photo_url.trim() : null, subjectId]
    );

    const newUser = insertResult.rows[0];

    // Register in CompreFace
    try {
      await addSubject(subjectId);

      // Train face
      if (req.file) {
        await trainFaceFromBuffer(subjectId, req.file.buffer, req.file.originalname);
      } else if (photo_url) {
        await trainFaceFromUrl(subjectId, photo_url);
      }
    } catch (faceErr) {
      console.warn(`[USERS] CompreFace warning for ${subjectId}:`, faceErr.message);
    }

    res.status(201).json(newUser);
  } catch (err) {
    if (err.message.includes('unique constraint') || err.code === '23505') {
      return res.status(409).json({ error: 'Nomor Induk already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────
router.put('/:id', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const userRes = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const existing = userRes.rows[0];

    const { name, nomor_induk, email, photo_url } = req.body;
    const updatedName = name ? name.trim() : existing.name;
    const updatedNomorInduk = nomor_induk ? nomor_induk.trim() : existing.nomor_induk;
    const updatedEmail = email !== undefined ? email.trim() : existing.email;
    const updatedPhotoUrl = photo_url || existing.photo_url;

    const updateRes = await query(
      `UPDATE users
       SET name = $1, nomor_induk = $2, email = $3, photo_url = $4
       WHERE id = $5
       RETURNING *`,
      [updatedName, updatedNomorInduk, updatedEmail, updatedPhotoUrl, req.params.id]
    );

    // Re-train if new photo provided
    if (req.file) {
      await trainFaceFromBuffer(existing.compreface_subject_id, req.file.buffer, req.file.originalname);
    } else if (photo_url && photo_url !== existing.photo_url) {
      await trainFaceFromUrl(existing.compreface_subject_id, photo_url);
    }

    res.json(updateRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userRes = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userRes.rows[0];

    // Delete from CompreFace
    if (user.compreface_subject_id) {
      try {
        await deleteSubject(user.compreface_subject_id);
      } catch (e) {
        console.warn(`[USERS] Delete subject in CompreFace error:`, e.message);
      }
    }

    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: `User "${user.name}" deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/users/import-csv ───────────────────────────────────────────────
router.post('/import-csv', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const result = await importUsersFromCSV(req.file.buffer);
    res.json({
      message: `Import complete. ${result.success} succeeded, ${result.failed} failed.`,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
