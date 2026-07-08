const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/attendance.db');

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initializeDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nomor_induk TEXT UNIQUE NOT NULL,
      photo_url TEXT,
      compreface_subject_id TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS attendance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      timestamp DATETIME DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'HADIR',
      confidence REAL
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_nomor_induk ON users(nomor_induk);
  `);

  console.log('[DB] Database initialized at:', DB_PATH);
}

module.exports = { getDb, initializeDatabase };
