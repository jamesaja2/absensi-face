require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { initializeDatabase } = require('./db');
const { startMqttListener } = require('./mqtt');
const usersRouter = require('./routes/users');
const attendanceRouter = require('./routes/attendance');
const authRouter = require('./routes/auth');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
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

// Initialize database then start server
initializeDatabase();
startMqttListener(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Absensi backend running on port ${PORT}`);
  console.log(`[Server] MQTT Broker: ${process.env.MQTT_BROKER}`);
  console.log(`[Server] CompreFace: ${process.env.COMPREFACE_URL}`);
});
