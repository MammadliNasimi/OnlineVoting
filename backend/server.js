const path = require('path');
// Load env files: prefer process env (host platform like Render), fall back to project root .env, then backend-local .env
const rootEnvPath = path.resolve(__dirname, '..', '.env');
require('dotenv').config({ path: rootEnvPath });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

const fs = require('fs');
const app = express();
const server = http.createServer(app);
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
const frontendBuildExists = fs.existsSync(path.join(frontendBuildPath, 'index.html'));
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Vercel her deploy icin unique URL uretir (preview deploy'lar):
// https://<proje>-<hash>-<team>.vercel.app  veya  https://<proje>-git-<branch>-<team>.vercel.app
// Bu pattern'lere de izin ver - aksi halde her redeploy CORS hatasi verir.
const VERCEL_PREVIEW_REGEX = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

const corsOriginValidator = (origin, callback) => {
  // Same-origin requests (server-side, curl, mobile apps) origin gondermez
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  if (VERCEL_PREVIEW_REGEX.test(origin)) return callback(null, true);
  return callback(new Error(`CORS: origin '${origin}' not allowed`));
};

const io = new Server(server, {
  cors: {
    origin: corsOriginValidator,
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
const host = process.env.HOST || '0.0.0.0';

// Render/Railway/Vercel proxy uyumu (X-Forwarded-* headers)
app.set('trust proxy', 1);

// Global Middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: corsOriginValidator,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-session-id']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if (frontendBuildExists) {
  app.use(express.static(frontendBuildPath));
}

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

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (frontendBuildExists) {
    return res.sendFile(path.join(frontendBuildPath, 'index.html'));
  }
  return res.status(404).json({
    success: false,
    message: 'API only deployment. Frontend ayri host ediliyor / Frontend is hosted separately.'
  });
});

app.use(errorHandler);

// Start node server logic
async function startServer() {
  try {
    console.log('Veritabanı başlatılıyor... / Initializing database...');   
    await db.connect();
    state.useDatabase = true;
    console.log('Veritabanı başarıyla başlatıldı. / Database initialized successfully.');

    // Env değerlerini trim et — Render/Railway/Fly gibi panellerden yapıştırırken
    // arkaya kaçan \n veya boşluklar ethers v6'da "invalid BytesLike" hatasına yol açar.
    const cleanEnv = (v) => (typeof v === 'string' ? v.trim() : v);

    console.log('Kurum Servisi (Credential Issuer) başlatılıyor... / Initializing Credential Issuer...');
    const issuerPrivateKey = cleanEnv(process.env.ADMIN_PRIVATE_KEY);
    const contractAddress = cleanEnv(process.env.VOTING_CONTRACT_ADDRESS);
    const chainId = cleanEnv(process.env.CHAIN_ID) || '31337';
    if (issuerPrivateKey) {
      state.credentialIssuer = new CredentialIssuer(issuerPrivateKey, contractAddress, parseInt(chainId));
    }

    console.log('Relayer Servisi başlatılıyor... / Initializing Relayer Service...');
    const relayerPrivateKey = cleanEnv(process.env.RELAYER_PRIVATE_KEY) || cleanEnv(process.env.ADMIN_PRIVATE_KEY);
    const rpcUrl = cleanEnv(process.env.BLOCKCHAIN_RPC_URL) || 'http://127.0.0.1:8545';
    if (relayerPrivateKey && contractAddress) {
      state.relayerService = new RelayerService(relayerPrivateKey, contractAddress, rpcUrl);
    }

    server.listen(port, host, () => {
      console.log(`==================================================`);
      // Start Cron Service for processing ended elections
      const cronService = require('./src/services/cronService');
      cronService.start();

      const { voteJobQueue } = require('./src/services/voteQueue.service');
      voteJobQueue.processNext();
      console.log(`SSI & ZK Based Voting System Started`);
      console.log(`Listening on: ${host}:${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
      console.log(`Tarih: ${new Date().toLocaleString()}`);
      console.log(`==================================================`);
    });
  } catch (error) {
    console.error('Sunucu başlatılırken kritik hata / Critical error starting server:', error);
    process.exit(1);
  }
}

startServer();
