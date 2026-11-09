require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { initializeDatabase } = require('./db');
const { initializeAntiSpoof } = require('./services/antispoof');
const { startMqttListener } = require('./mqtt');
const usersRouter = require('./routes/users');
const attendanceRouter = require('./routes/attendance');
const authRouter = require('./routes/auth');

const app = express();
const server = http.createServer(app);

// CORS configuration supporting dynamic origin (reverse proxy and multi-domain friendly)
const corsOptions = {
  origin: true, // Echoes the request origin header, allowing any reverse proxy domain or port
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  allowEIO3: true,
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/attendance', attendanceRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Make io accessible in routes
app.set('io', io);

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;

// Initialize components
initializeDatabase();
initializeAntiSpoof().catch((err) => {
  console.warn('[Anti-Spoof] Background init warning:', err.message);
});
startMqttListener(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Absensi backend running on port ${PORT}`);
  console.log(`[Server] CompreFace: ${process.env.COMPREFACE_URL || 'http://192.168.100.52:8000'}`);
  console.log(`[Server] Anti-Spoofing: ${process.env.ENABLE_ANTISPOOF !== 'false' ? 'ENABLED (MiniFASNet)' : 'DISABLED'}`);
  console.log(`[Server] MQTT Listener: ${process.env.MQTT_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
});
