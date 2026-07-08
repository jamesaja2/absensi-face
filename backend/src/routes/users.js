const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db');
const { addSubject, trainFaceFromUrl, trainFaceFromBuffer, deleteSubject } = require('../services/compreface');
const { importUsersFromCSV } = require('../services/csvImport');
const { authenticateToken } = require('../middleware/auth');

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
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare(`
      SELECT 
        u.*,
        COUNT(al.id) as total_attendance
      FROM users u
      LEFT JOIN attendance_logs al ON al.user_id = u.id
      GROUP BY u.id
      ORDER BY u.name ASC
    `).all();
    res.json({ users, total: users.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/users ─────────────────────────────────────────────────────────
router.post('/', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { name, nomor_induk, photo_url } = req.body;
    if (!name || !nomor_induk) {
      return res.status(400).json({ error: 'name and nomor_induk are required' });
    }

    const db = getDb();
    const subjectId = `${nomor_induk}_${name.replace(/\s+/g, '_')}`;

    const result = db.prepare(`
      INSERT INTO users (name, nomor_induk, photo_url, compreface_subject_id)
      VALUES (?, ?, ?, ?)
    `).run(name, nomor_induk, photo_url || null, subjectId);

    // Register in CompreFace
    await addSubject(subjectId);

    // Train face
    if (req.file) {
      await trainFaceFromBuffer(subjectId, req.file.buffer, req.file.originalname);
    } else if (photo_url) {
      await trainFaceFromUrl(subjectId, photo_url);
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Nomor Induk already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────
router.put('/:id', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const { name, nomor_induk, photo_url } = req.body;
    const updatedName = name || existing.name;
    const updatedNomorInduk = nomor_induk || existing.nomor_induk;
    const updatedPhotoUrl = photo_url || existing.photo_url;

    db.prepare(`
      UPDATE users SET name = ?, nomor_induk = ?, photo_url = ? WHERE id = ?
    `).run(updatedName, updatedNomorInduk, updatedPhotoUrl, req.params.id);

    // Re-train if new photo provided
    if (req.file) {
      await trainFaceFromBuffer(existing.compreface_subject_id, req.file.buffer, req.file.originalname);
    } else if (photo_url && photo_url !== existing.photo_url) {
      await trainFaceFromUrl(existing.compreface_subject_id, photo_url);
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Delete from CompreFace
    if (user.compreface_subject_id) {
      await deleteSubject(user.compreface_subject_id);
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
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
