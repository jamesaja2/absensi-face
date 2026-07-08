const mqtt = require('mqtt');
const { getDb } = require('./db');

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

function startMqttListener(io) {
  const brokerUrl = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
  const topic = process.env.MQTT_TOPIC || 'double-take/matches/#';

  const client = mqtt.connect(brokerUrl, {
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    clientId: `absensi-backend-${Math.random().toString(16).slice(2, 8)}`,
  });

  client.on('connect', () => {
    console.log(`[MQTT] Connected to broker: ${brokerUrl}`);
    client.subscribe(topic, (err) => {
      if (err) {
        console.error('[MQTT] Subscribe error:', err.message);
      } else {
        console.log(`[MQTT] Subscribed to: ${topic}`);
      }
    });
  });

  client.on('error', (err) => {
    console.error('[MQTT] Connection error:', err.message);
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...');
  });

  client.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      handleMatchMessage(topic, payload, io);
    } catch (err) {
      console.error('[MQTT] Failed to parse message:', err.message, message.toString());
    }
  });

  return client;
}

function handleMatchMessage(topic, payload, io) {
  // Double-Take publishes matches in different formats depending on version
  // Handle both array and single-match payloads
  const matches = Array.isArray(payload) ? payload : [payload];

  for (const match of matches) {
    const name = match.name || match.subject;
    const confidence = parseFloat(match.confidence || match.similarity || 0) * 100;
    // Some DT versions send confidence as 0-1, others as 0-100
    const normalizedConfidence = confidence > 1 ? confidence : confidence * 100;

    if (!name || name === 'unknown') {
      console.log(`[MQTT] Unknown face detected, skipping.`);
      continue;
    }

    if (normalizedConfidence < CONFIDENCE_THRESHOLD) {
      console.log(`[MQTT] Low confidence for "${name}": ${normalizedConfidence.toFixed(1)}% < ${CONFIDENCE_THRESHOLD}%. Skipping.`);
      continue;
    }

    console.log(`[MQTT] Match: "${name}" at ${normalizedConfidence.toFixed(1)}% confidence`);
    processAttendance(name, normalizedConfidence, io);
  }
}

function processAttendance(subjectName, confidence, io) {
  const db = getDb();

  // Find user by compreface_subject_id (which is the name/label in CompreFace)
  const user = db.prepare(`
    SELECT * FROM users 
    WHERE compreface_subject_id = ? OR name = ?
    LIMIT 1
  `).get(subjectName, subjectName);

  if (!user) {
    console.log(`[MQTT] No user found for subject: "${subjectName}". Register the user first.`);
    return;
  }

  // Debounce check
  if (isInDebounce(user.id)) {
    const lastSeen = debounceMap.get(user.id);
    const remainingMs = DEBOUNCE_MS - (Date.now() - lastSeen);
    console.log(`[MQTT] Debounce active for "${user.name}". ${Math.ceil(remainingMs / 1000)}s remaining.`);
    return;
  }

  // Log attendance
  const result = db.prepare(`
    INSERT INTO attendance_logs (user_id, status, confidence)
    VALUES (?, 'HADIR', ?)
  `).run(user.id, confidence);

  setDebounce(user.id);
  console.log(`[DB] Attendance logged for "${user.name}" (ID: ${user.id}) | Confidence: ${confidence.toFixed(1)}%`);

  // Get the full log entry with user info
  const logEntry = db.prepare(`
    SELECT 
      al.id, al.timestamp, al.status, al.confidence,
      u.id as user_id, u.name, u.nomor_induk, u.photo_url
    FROM attendance_logs al
    JOIN users u ON al.user_id = u.id
    WHERE al.id = ?
  `).get(result.lastInsertRowid);

  // Emit to all connected Socket.io clients
  io.emit('attendance:new', {
    log: logEntry,
    message: `Berhasil Absen: ${user.name}`,
  });

  console.log(`[Socket.io] Emitted attendance:new for "${user.name}"`);
}

module.exports = { startMqttListener, processAttendance };
