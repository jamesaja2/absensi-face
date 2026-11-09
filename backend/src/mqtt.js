const mqtt = require('mqtt');
const { recordAttendance, isInDebounce, setDebounce } = require('./services/attendanceService');

const MQTT_ENABLED = process.env.MQTT_ENABLED === 'true';

function startMqttListener(io) {
  if (!MQTT_ENABLED) {
    console.log('[MQTT] MQTT Listener disabled (MQTT_ENABLED=false). Web kiosk direct mode active.');
    return null;
  }

  const brokerUrl = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
  const topic = process.env.MQTT_TOPIC || 'double-take/matches/#';

  const client = mqtt.connect(brokerUrl, {
    reconnectPeriod: 10000,
    connectTimeout: 10000,
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
    console.warn('[MQTT] Connection error:', err.message);
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...');
  });

  client.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      handleMatchMessage(topic, payload, io);
    } catch (err) {
      console.error('[MQTT] Failed to parse message:', err.message);
    }
  });

  return client;
}

function handleMatchMessage(topic, payload, io) {
  const matches = Array.isArray(payload) ? payload : [payload];

  for (const match of matches) {
    const name = match.name || match.subject;
    const confidence = parseFloat(match.confidence || match.similarity || 0) * 100;
    const normalizedConfidence = confidence > 1 ? confidence : confidence * 100;

    if (!name || name === 'unknown') continue;

    recordAttendance(name, normalizedConfidence, io);
  }
}

// Backward compatibility export
module.exports = {
  startMqttListener,
  processAttendance: recordAttendance,
};
