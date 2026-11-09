const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://absensi:absensi_pass_2026@postgres_absensi:5432/absensi_db';

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_SQL === 'true') {
    console.log('[DB SQL]', { text, duration, rows: res.rowCount });
  }
  return res;
}

async function initializeDatabase() {
  console.log('[DB] Connecting to PostgreSQL at:', DATABASE_URL.replace(/:[^:]+@/, ':****@'));

  // Ensure tables exist
  await query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin', -- 'super_admin', 'admin', 'operator'
      avatar_url TEXT,
      status VARCHAR(50) DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE'
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS kiosks (
      id SERIAL PRIMARY KEY,
      kiosk_id VARCHAR(100) UNIQUE NOT NULL,
      secret_token VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
      ip_address VARCHAR(50),
      user_agent TEXT,
      last_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE kiosks ADD COLUMN IF NOT EXISTS secret_token VARCHAR(255);

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      nomor_induk VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255),
      photo_url TEXT,
      compreface_subject_id VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      kiosk_id VARCHAR(100),
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) DEFAULT 'HADIR',
      confidence REAL,
      is_real BOOLEAN DEFAULT TRUE,
      liveness_score REAL
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_kiosk_id ON attendance_logs(kiosk_id);
    CREATE INDEX IF NOT EXISTS idx_users_nomor_induk ON users(nomor_induk);
    CREATE INDEX IF NOT EXISTS idx_kiosks_kiosk_id ON kiosks(kiosk_id);
    CREATE INDEX IF NOT EXISTS idx_admin_email ON admin_users(email);
  `);

  console.log('[DB] PostgreSQL tables & indexes verified.');

  // Check and seed Super Admin if env var provided
  const initialAdminEmail = process.env.INITIAL_SUPER_ADMIN_EMAIL;
  if (initialAdminEmail) {
    const adminCheck = await query('SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)', [initialAdminEmail]);
    if (adminCheck.rows.length === 0) {
      await query(
        `INSERT INTO admin_users (email, name, role, status) VALUES ($1, $2, 'super_admin', 'ACTIVE')`,
        [initialAdminEmail.toLowerCase(), 'Super Admin']
      );
      console.log(`[DB] Seeded initial super admin: ${initialAdminEmail}`);
    }
  }

  // Automatic one-time migration from SQLite if exists
  await migrateFromSqliteIfNeeded();
}

async function migrateFromSqliteIfNeeded() {
  const sqlitePath = process.env.DB_PATH || path.join(__dirname, '../../data/attendance.db');
  if (!fs.existsSync(sqlitePath)) return;

  try {
    const userCount = await query('SELECT count(*) as count FROM users');
    if (parseInt(userCount.rows[0].count) > 0) {
      // PostgreSQL already populated, skip migration
      return;
    }

    console.log('[DB Migration] Found SQLite DB with empty PostgreSQL. Beginning migration...');
    const Database = require('better-sqlite3');
    const sqliteDb = new Database(sqlitePath, { readonly: true });

    // Migrate users (exclude any remaining randomuser dummy records)
    const users = sqliteDb.prepare("SELECT * FROM users WHERE photo_url NOT LIKE '%randomuser.me%'").all();
    console.log(`[DB Migration] Migrating ${users.length} users from SQLite...`);

    const userMap = new Map(); // old_id -> new_id
    for (const u of users) {
      const res = await query(
        `INSERT INTO users (name, nomor_induk, photo_url, compreface_subject_id, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (nomor_induk) DO UPDATE SET compreface_subject_id = EXCLUDED.compreface_subject_id
         RETURNING id`,
        [u.name, u.nomor_induk, u.photo_url || null, u.compreface_subject_id, u.created_at ? new Date(u.created_at) : new Date()]
      );
      userMap.set(u.id, res.rows[0].id);
    }

    // Migrate attendance logs
    const logs = sqliteDb.prepare("SELECT * FROM attendance_logs ORDER BY id ASC").all();
    console.log(`[DB Migration] Migrating ${logs.length} attendance logs from SQLite...`);

    for (const l of logs) {
      const newUserId = userMap.get(l.user_id);
      if (newUserId) {
        await query(
          `INSERT INTO attendance_logs (user_id, kiosk_id, timestamp, status, confidence, is_real, liveness_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            newUserId,
            'kiosk_legacy',
            l.timestamp ? new Date(l.timestamp) : new Date(),
            l.status || 'HADIR',
            l.confidence || 0,
            true,
            1.0
          ]
        );
      }
    }

    // Create a default kiosk for legacy records
    await query(
      `INSERT INTO kiosks (kiosk_id, name, status) VALUES ('kiosk_legacy', 'Kiosk Utama (Migrasi)', 'APPROVED')
       ON CONFLICT (kiosk_id) DO NOTHING`
    );

    console.log('[DB Migration] Migration complete! Users and logs successfully transferred to PostgreSQL.');
    sqliteDb.close();
  } catch (err) {
    console.error('[DB Migration] Warning: Failed to auto-migrate SQLite:', err.message);
  }
}

module.exports = {
  pool,
  query,
  initializeDatabase,
};
