const path = require('path');

// Hem backend-local hem proje kökündeki .env'i destekle (host platform env'leri her zaman önceliklidir).
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config();

const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');

const db = require('./src/config/database-sqlite');
const state = require('./src/config/state');
const logger = require('./src/utils/logger');
const { errorHandler } = require('./src/middlewares/error.middleware');

const CredentialIssuer = require('./src/services/credentialIssuer');
const RelayerService = require('./src/services/relayerService');

const authRoutes = require('./src/routes/auth.routes');
const voteRoutes = require('./src/routes/vote.routes');
const adminRoutes = require('./src/routes/admin.routes');
const electionRoutes = require('./src/routes/election.routes');

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const DEFAULT_CHAIN_ID = '31337';
const DEFAULT_RPC_URL = 'http://127.0.0.1:8545';

// Vercel her deploy için unique URL üretir (preview/branch deploy):
// `<proje>-<hash>-<team>.vercel.app`. Tüm `*.vercel.app` origin'lerini kabul ederek
// her redeploy sonrası CORS_ORIGINS güncelleme zorunluluğunu ortadan kaldırıyoruz.
const VERCEL_PREVIEW_REGEX = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

const cleanEnv = (v) => (typeof v === 'string' ? v.trim() : v);

const app = express();
const server = http.createServer(app);

const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
const frontendBuildExists = fs.existsSync(path.join(frontendBuildPath, 'index.html'));

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOriginValidator = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  if (VERCEL_PREVIEW_REGEX.test(origin)) return callback(null, true);
  return callback(new Error(`CORS: origin '${origin}' not allowed`));
};

const io = new Server(server, {
  cors: { origin: corsOriginValidator, credentials: true }
});
state.io = io;

io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
  });
});

// Render/Railway gibi proxy'lerin arkasında secure cookie ve gerçek IP doğru tespit edilsin.
app.set('trust proxy', 1);

app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
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
  if (state.useDatabase) return next();
  if (req.method === 'GET' && !req.path.startsWith('/api/')) return next();
  return res.status(503).json({ success: false, message: 'Database not initialized yet' });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: state.useDatabase ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', authRoutes);
app.use('/api', voteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/elections', electionRoutes);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (frontendBuildExists) {
    return res.sendFile(path.join(frontendBuildPath, 'index.html'));
  }
  return res.status(404).json({
    success: false,
    message: 'API-only deployment. Frontend is hosted separately.'
  });
});

app.use(errorHandler);

async function startServer() {
  try {
    await db.connect();
    state.useDatabase = true;
    logger.info('Database initialized.');

    const issuerPrivateKey = cleanEnv(process.env.ADMIN_PRIVATE_KEY);
    const contractAddress = cleanEnv(process.env.VOTING_CONTRACT_ADDRESS);
    const chainId = parseInt(cleanEnv(process.env.CHAIN_ID) || DEFAULT_CHAIN_ID, 10);
    if (issuerPrivateKey) {
      state.credentialIssuer = new CredentialIssuer(issuerPrivateKey, contractAddress, chainId);
    }

    const relayerPrivateKey = cleanEnv(process.env.RELAYER_PRIVATE_KEY) || issuerPrivateKey;
    const rpcUrl = cleanEnv(process.env.BLOCKCHAIN_RPC_URL) || DEFAULT_RPC_URL;
    if (relayerPrivateKey && contractAddress) {
      state.relayerService = new RelayerService(relayerPrivateKey, contractAddress, rpcUrl);
    }

    server.listen(PORT, HOST, () => {
      const cronService = require('./src/services/cronService');
      cronService.start();

      const { voteJobQueue } = require('./src/services/voteQueue.service');
      voteJobQueue.processNext();

      logger.info(`SSI Voting backend started on ${HOST}:${PORT} (${process.env.NODE_ENV || 'development'})`);
      logger.info(`Allowed origins: ${allowedOrigins.join(', ')}`);
    });
  } catch (error) {
    logger.error('Critical error starting server:', error);
    process.exit(1);
  }
}

startServer();
