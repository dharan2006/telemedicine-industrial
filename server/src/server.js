const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import configurations
const { initDatabase } = require('./config/db');
const turnConfig = require('./config/turn');

// Import middleware
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const { authenticateToken, requireDoctor } = require('./middleware/authMiddleware');

// Import controllers
const authController = require('./controllers/authController');
const roomController = require('./controllers/roomController');

// Import socket handler
const { initializeSignaling } = require('./socket/signalingHandler');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Get TURN server credentials
app.get('/api/turn-credentials', authenticateToken, async (req, res) => {
  try {
    // Option 1: Static credentials
    const iceServers = turnConfig.getIceServers();
    
    // Option 2: Fetch from API (uncomment to use)
    // const iceServers = await turnConfig.getIceServersFromAPI();
    
    res.json({ success: true, iceServers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Authentication routes
app.post('/api/auth/register', authLimiter, authController.register);
app.post('/api/auth/login', authLimiter, authController.login);
app.post('/api/auth/refresh', authController.refreshToken);
app.get('/api/auth/me', authenticateToken, authController.getProfile);

// Room routes
app.post('/api/rooms', authenticateToken, requireDoctor, roomController.createRoom);
app.get('/api/rooms', authenticateToken, roomController.getActiveRooms);
app.post('/api/rooms/verify', authenticateToken, roomController.verifyRoom);
app.post('/api/rooms/end', authenticateToken, requireDoctor, roomController.endRoom);

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const authService = require('./services/authService');
    const decoded = authService.verifyAccessToken(token);
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

// Initialize WebRTC signaling
initializeSignaling(io);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Initialize database
    await initDatabase();
    console.log('✅ Database initialized');

    // Start listening
    server.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🏥 Telemedicine Server - Industrial Edition        ║
║                                                       ║
║   Server running on port: ${PORT}                    ║
║   Environment: ${process.env.NODE_ENV}              ║
║   Database: Connected                                 ║
║   TURN Server: Configured                             ║
║                                                       ║
║   Ready to accept connections! 🚀                    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
