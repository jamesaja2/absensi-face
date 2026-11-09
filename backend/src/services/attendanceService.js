const { query } = require('../db');

// In-memory debounce map: { `${userId}_${kioskId}`: lastSeenTimestamp }
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
 * Inquire attendance status without recording (for Unapproved/Pending Kiosks)
 */
async function inquireAttendance(subjectName, confidence, kioskId, io) {
  // Find user by compreface_subject_id or name
  const userRes = await query(
    `SELECT * FROM users WHERE compreface_subject_id = $1 OR name = $1 LIMIT 1`,
    [subjectName]
  );

  if (userRes.rows.length === 0) {
    return {
      mode: 'INQUIRY',
      status: 'user_not_found',
      subject: subjectName,
      message: 'Wajah tidak terdaftar di sistem',
    };
  }

  const user = userRes.rows[0];

  if (confidence < CONFIDENCE_THRESHOLD) {
    return {
      mode: 'INQUIRY',
      status: 'low_confidence',
      user,
      confidence,
      threshold: CONFIDENCE_THRESHOLD,
      message: `Tingkat kecocokan wajah rendah (${confidence.toFixed(1)}% < ${CONFIDENCE_THRESHOLD}%)`,
    };
  }

  // Check today's attendance
  const checkRes = await query(
    `SELECT * FROM attendance_logs 
     WHERE user_id = $1 AND timestamp::date = CURRENT_DATE 
     ORDER BY timestamp DESC LIMIT 1`,
    [user.id]
  );

  let resultData;
  if (checkRes.rows.length > 0) {
    const log = checkRes.rows[0];
    const timeStr = new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    resultData = {
      mode: 'INQUIRY',
      status: 'already_attended',
      already_attended: true,
      attendance_time: log.timestamp,
      formatted_time: timeStr,
      user,
      confidence,
      message: `Status: Sudah Absen Hari Ini (Pukul ${timeStr})`,
    };
  } else {
    resultData = {
      mode: 'INQUIRY',
      status: 'not_attended',
      already_attended: false,
      user,
      confidence,
      message: `Status: Belum Terdaftar Absen Hari Ini (Kiosk belum di-approve untuk mencatat kehadiran)`,
    };
  }

  // Emit to this kiosk room
  if (io && kioskId) {
    io.to(`kiosk:${kioskId}`).emit('attendance:inquiry', resultData);
  }

  return resultData;
}

/**
 * Record attendance for an APPROVED kiosk
 */
async function recordAttendance(subjectName, confidence, kioskId, io, liveness = { is_real: true, score: 1.0 }) {
  // Find user by compreface_subject_id or name
  const userRes = await query(
    `SELECT * FROM users WHERE compreface_subject_id = $1 OR name = $1 LIMIT 1`,
    [subjectName]
  );

  if (userRes.rows.length === 0) {
    console.log(`[Attendance] No registered user found for subject: "${subjectName}".`);
    return { mode: 'ATTENDANCE', status: 'user_not_found', subject: subjectName };
  }

  const user = userRes.rows[0];

  // Check confidence threshold
  if (confidence < CONFIDENCE_THRESHOLD) {
    return {
      mode: 'ATTENDANCE',
      status: 'low_confidence',
      user,
      confidence,
      threshold: CONFIDENCE_THRESHOLD,
    };
  }

  // Check debounce
  if (isInDebounce(user.id)) {
    const remainingSeconds = getDebounceRemainingSeconds(user.id);
    return {
      mode: 'ATTENDANCE',
      status: 'debounced',
      user,
      confidence,
      remainingSeconds,
    };
  }

  // Insert attendance record
  const insertRes = await query(
    `INSERT INTO attendance_logs (user_id, kiosk_id, status, confidence, is_real, liveness_score)
     VALUES ($1, $2, 'HADIR', $3, $4, $5)
     RETURNING *`,
    [user.id, kioskId || 'default_kiosk', confidence, liveness.is_real, liveness.score]
  );

  setDebounce(user.id);
  const newLog = insertRes.rows[0];
  console.log(`[DB] Attendance logged for "${user.name}" (${user.nomor_induk}) | Confidence: ${confidence.toFixed(1)}% | Kiosk: ${kioskId}`);

  const logPayload = {
    ...newLog,
    user_id: user.id,
    name: user.name,
    nomor_induk: user.nomor_induk,
    email: user.email,
    photo_url: user.photo_url,
  };

  // Broadcast to this kiosk room AND admin dashboard
  if (io) {
    if (kioskId) {
      io.to(`kiosk:${kioskId}`).emit('attendance:kiosk_event', {
        mode: 'ATTENDANCE',
        status: 'recorded',
        log: logPayload,
        user,
        message: `Berhasil Absen: ${user.name}`,
      });
    }

    // Global broadcast for admin real-time feed
    io.emit('attendance:new', {
      log: logPayload,
      user,
      kiosk_id: kioskId,
      message: `Berhasil Absen: ${user.name}`,
    });
  }

  return {
    mode: 'ATTENDANCE',
    status: 'recorded',
    user,
    confidence,
    log: logPayload,
  };
}

module.exports = {
  recordAttendance,
  inquireAttendance,
  isInDebounce,
  setDebounce,
  getDebounceRemainingSeconds,
  CONFIDENCE_THRESHOLD,
};
