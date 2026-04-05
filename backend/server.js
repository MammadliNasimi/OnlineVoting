require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const db = require('./src/config/database-sqlite');
const state = require('./src/config/state');

// Import services and controllers
const CredentialIssuer = require('./src/services/credentialIssuer');
const RelayerService = require('./src/services/relayerService');

const authRoutes = require('./src/routes/auth.routes');
const voteRoutes = require('./src/routes/vote.routes');
const adminRoutes = require('./src/routes/admin.routes');
const electionRoutes = require('./src/routes/election.routes');

const http = require('http');
const { Server } = require('socket.io');
const morgan = require('morgan');
const logger = require('./src/utils/logger');
const { errorHandler } = require('./src/middlewares/error.middleware');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});
state.io = io;

io.on('connection', (socket) => {
  console.log('🔗 WebSocket client connected:', socket.id);
  // Kullanıcı ID'sini odaya atamak için, frontend tarafından "join" event'i dinleyelim
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`👤 User joined room: user_${userId}`);
  });
  socket.on('disconnect', () => {
    console.log('🔗 WebSocket client disconnected:', socket.id);
  });
});

const port = process.env.PORT || 5000;

// Global Middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-session-id']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'client/build')));

// Database initialization state
app.use((req, res, next) => {
  if (!state.useDatabase) {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        return next();
    }
    return res.status(503).json({ success: false, message: 'Veritabanı bağlantısı henüz kurulmadı / Database connection not established yet' });
  }
  next();
});

// API Routes
app.use('/api', authRoutes);
app.use('/api', voteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/elections', electionRoutes);
// Note: We mount auth and vote on /api because their routes explicitly have paths like /register, /login, /candidates which previously began with /api/

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: state.useDatabase ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/stats', async (req, res) => {
    try {
      const stats = await db.getStats();
      res.json({ success: true, stats });
    } catch (error) {
      res.status(500).json({ success: false, message: 'İstatistikler alınamadı / Failed to retrieve stats: ' + error.message });
    }
});

// Serve frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.use(errorHandler);

// Start node server logic
async function startServer() {
  try {
    console.log('Veritabanı başlatılıyor... / Initializing database...');   
    await db.connect();
    state.useDatabase = true;
    console.log('Veritabanı başarıyla başlatıldı. / Database initialized successfully.');

    console.log('Kurum Servisi (Credential Issuer) başlatılıyor... / Initializing Credential Issuer...');
    const issuerPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    const contractAddress = process.env.VOTING_CONTRACT_ADDRESS;
    const chainId = process.env.CHAIN_ID || '31337';
    if (issuerPrivateKey) {
      state.credentialIssuer = new CredentialIssuer(issuerPrivateKey, contractAddress, parseInt(chainId));
    }

    console.log('Relayer Servisi başlatılıyor... / Initializing Relayer Service...');
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY;
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
    if (relayerPrivateKey && contractAddress) {
      state.relayerService = new RelayerService(relayerPrivateKey, contractAddress, rpcUrl);
    }

    server.listen(port, () => {
      console.log(`==================================================`);
      // Start Cron Service for processing ended elections
      const cronService = require('./src/services/cronService');
      cronService.start();

      const { voteJobQueue } = require('./src/services/voteQueue.service');
      voteJobQueue.processNext();
      console.log(`SSI & ZK Based Voting System Started`);
      console.log(`Port: ${port}`);
      console.log(`Tarih: ${new Date().toLocaleString()}`);
      console.log(`==================================================`);      
    });
  } catch (error) {
    console.error('Sunucu başlatılırken kritik hata / Critical error starting server:', error);
    process.exit(1);
  }
}

startServer();
