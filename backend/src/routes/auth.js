const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const INITIAL_SUPER_ADMIN_EMAIL = (process.env.INITIAL_SUPER_ADMIN_EMAIL || '').toLowerCase();

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// POST /api/auth/google
router.post('/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Google credential token is required' });
  }

  try {
    let email, name, picture;

    // Verify token either via google-auth-library or google tokeninfo endpoint
    if (googleClient && GOOGLE_CLIENT_ID) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        email = payload.email.toLowerCase();
        name = payload.name || payload.email;
        picture = payload.picture;
      } catch (verifyErr) {
        // Fallback to tokeninfo endpoint
        const infoRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        email = infoRes.data.email.toLowerCase();
        name = infoRes.data.name || infoRes.data.email;
        picture = infoRes.data.picture;
      }
    } else {
      // If GOOGLE_CLIENT_ID is not configured in backend yet, verify directly against Google OAuth tokeninfo
      const infoRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      email = infoRes.data.email.toLowerCase();
      name = infoRes.data.name || infoRes.data.email;
      picture = infoRes.data.picture;
    }

    if (!email) {
      return res.status(400).json({ error: 'Failed to retrieve email from Google Account' });
    }

    // Check admin_users table
    const totalAdminsRes = await query('SELECT count(*) as count FROM admin_users');
    const totalAdmins = parseInt(totalAdminsRes.rows[0].count);

    let userRow = await query('SELECT * FROM admin_users WHERE LOWER(email) = LOWER($1)', [email]);

    // If this is the very first admin login, OR matches INITIAL_SUPER_ADMIN_EMAIL, make super_admin
    if (userRow.rows.length === 0) {
      if (totalAdmins === 0 || (INITIAL_SUPER_ADMIN_EMAIL && email === INITIAL_SUPER_ADMIN_EMAIL)) {
        const insertRes = await query(
          `INSERT INTO admin_users (email, name, role, avatar_url, status)
           VALUES ($1, $2, 'super_admin', $3, 'ACTIVE')
           RETURNING *`,
          [email, name, picture || null]
        );
        userRow = insertRes;
        console.log(`[AUTH] Registered first super_admin: ${email}`);
      } else {
        return res.status(403).json({
          error: 'Akses Ditolak: Akun Google Anda belum didaftarkan sebagai Administrator oleh Super Admin.',
          email,
        });
      }
    }

    const admin = userRow.rows[0];

    if (admin.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Akun administrator Anda dinonaktifkan.' });
    }

    // Update avatar and name if changed
    await query(
      `UPDATE admin_users SET avatar_url = COALESCE($1, avatar_url), name = COALESCE($2, name), updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [picture || null, name, admin.id]
    );

    const tokenPayload = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      avatar_url: picture || admin.avatar_url,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      token,
      expiresIn: JWT_EXPIRES_IN,
      user: tokenPayload,
    });
  } catch (err) {
    console.error('[AUTH] Google OAuth error:', err.response?.data || err.message);
    res.status(401).json({ error: 'Validasi Google OAuth gagal: ' + (err.response?.data?.error_description || err.message) });
  }
});

// POST /api/auth/login (Traditional credentials fallback)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Kredensial tidak valid' });
  }

  // Ensure default admin user exists in DB
  const defaultEmail = `${username}@system.local`;
  let adminRes = await query('SELECT * FROM admin_users WHERE email = $1', [defaultEmail]);
  if (adminRes.rows.length === 0) {
    adminRes = await query(
      `INSERT INTO admin_users (email, name, role, status) VALUES ($1, $2, 'super_admin', 'ACTIVE') RETURNING *`,
      [defaultEmail, 'Administrator Utama']
    );
  }

  const admin = adminRes.rows[0];
  const tokenPayload = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role || 'super_admin',
    avatar_url: admin.avatar_url,
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  res.json({
    token,
    expiresIn: JWT_EXPIRES_IN,
    user: tokenPayload,
  });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const adminRes = await query('SELECT id, email, name, role, avatar_url, status FROM admin_users WHERE id = $1', [req.user.id]);
    if (adminRes.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    res.json({ user: adminRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify
router.post('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (err) {
    res.status(401).json({ valid: false, error: 'Token kedaluwarsa atau tidak valid' });
  }
});

module.exports = router;
