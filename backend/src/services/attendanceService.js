const { getDb } = require('../db');

// In-memory debounce map: { userId: lastSeenTimestamp }
const debounceMap = new Map();

const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD) || 80;
const DEBOUNCE_MINUTES = parseInt(process.env.DEBOUNCE_MINUTES) || 3;
const DEBOUNCE_MS = DEBOUNCE_MINUTES * 60 * 1000;

function isInDebounce(userId) {
  const lastSeen = debounceMap.get(userId);
  if (!lastSeen) return false;
  return Date.now() - lastSeen < DEBOUNCE_MS;
}

function setDebounce(userId) {
  debounceMap.set(userId, Date.now());
}

function getDebounceRemainingSeconds(userId) {
  const lastSeen = debounceMap.get(userId);
  if (!lastSeen) return 0;
  const remainingMs = DEBOUNCE_MS - (Date.now() - lastSeen);
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/**
 * Record attendance for a recognized face subject
 * @param {string} subjectName - Name or compreface_subject_id
 * @param {number} confidence - Confidence percentage (0-100)
 * @param {object} io - Socket.io server instance
 * @returns {object} Result status and log entry
 */
function recordAttendance(subjectName, confidence, io) {
  const db = getDb();

  // Find user by compreface_subject_id or name
  const user = db.prepare(`
    SELECT * FROM users 
    WHERE compreface_subject_id = ? OR name = ?
    LIMIT 1
  `).get(subjectName, subjectName);

  if (!user) {
    console.log(`[Attendance] No registered user found for subject: "${subjectName}".`);
    return { status: 'user_not_found', subject: subjectName };
  }

  // Check confidence threshold
  if (confidence < CONFIDENCE_THRESHOLD) {
    return {
      status: 'low_confidence',
      user,
      confidence,
      threshold: CONFIDENCE_THRESHOLD,
    };
  }

  // Check debounce (e.g. within 3 minutes)
  if (isInDebounce(user.id)) {
    const remainingSeconds = getDebounceRemainingSeconds(user.id);
    return {
      status: 'debounced',
      user,
      confidence,
      remainingSeconds,
    };
  }

  // Insert attendance record
  const result = db.prepare(`
    INSERT INTO attendance_logs (user_id, status, confidence)
    VALUES (?, 'HADIR', ?)
  `).run(user.id, confidence);

  setDebounce(user.id);
  console.log(`[DB] Attendance logged for "${user.name}" (${user.nomor_induk}) | Confidence: ${confidence.toFixed(1)}%`);

  // Query the newly inserted record with user details
  const logEntry = db.prepare(`
    SELECT 
      al.id, al.timestamp, al.status, al.confidence,
      u.id as user_id, u.name, u.nomor_induk, u.photo_url
    FROM attendance_logs al
    JOIN users u ON al.user_id = u.id
    WHERE al.id = ?
  `).get(result.lastInsertRowid);

  // Broadcast to all connected clients via Socket.io
  if (io) {
    io.emit('attendance:new', {
      log: logEntry,
      message: `Berhasil Absen: ${user.name}`,
    });
    console.log(`[Socket.io] Emitted attendance:new for "${user.name}"`);
  }

  return {
    status: 'recorded',
    user,
    confidence,
    log: logEntry,
  };
}

module.exports = {
  recordAttendance,
  isInDebounce,
  setDebounce,
  getDebounceRemainingSeconds,
  CONFIDENCE_THRESHOLD,
};
