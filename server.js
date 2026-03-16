const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { ethers } = require('ethers');
const crypto = require('crypto');
const VoteAuthService = require('./services/authService');
const CredentialIssuer = require('./services/credentialIssuer');
const RelayerService = require('./services/relayerService');
const { createWallet, encryptPrivateKey, decryptPrivateKey } = require('./utils/walletUtils');
const db = require('./config/database-sqlite');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});
const path = require('path');

// roomId -> streamerSocketId
const webrtcRooms = new Map();

// Initialize services
let authService;
let credentialIssuer;
let relayerService;
let useDatabase = false;

async function initializeServices() {
  // Initialize Vote Authorization Service (Legacy)
  try {
    authService = new VoteAuthService();
    console.log('✅ Vote Authorization Service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize authService:', error.message);
    console.log('⚠️  Anonymous voting will not be available');
  }

  // Initialize Credential Issuer Service (SSI)
  try {
    const contractAddress = process.env.VOTING_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
    const issuerPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    const chainId = process.env.CHAIN_ID || 31337;
    
    if (issuerPrivateKey) {
      credentialIssuer = new CredentialIssuer(issuerPrivateKey, contractAddress, parseInt(chainId));
      console.log('✅ Credential Issuer Service (SSI) initialized');
    } else {
      console.log('⚠️  Credential Issuer not available - ADMIN_PRIVATE_KEY missing');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Credential Issuer:', error.message);
    console.log('⚠️  SSI voting will not be available');
  }

  // Initialize Relayer Service (Gas-less transactions)
  try {
    const contractAddress = process.env.VOTING_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    
    if (relayerPrivateKey) {
      relayerService = new RelayerService(relayerPrivateKey, contractAddress, rpcUrl);
      console.log('✅ Relayer Service initialized');
      
      // Clean old submission history every hour
      setInterval(() => {
        relayerService.cleanOldHistory();
      }, 60 * 60 * 1000);
    } else {
      console.log('⚠️  Relayer Service not available - RELAYER_PRIVATE_KEY missing');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Relayer Service:', error.message);
    console.log('⚠️  Gas-less voting will not be available');
  }

  // Initialize Database
  try {
    useDatabase = await db.connect();
    if (!useDatabase) {
      console.log('⚠️  Using in-memory storage (database not available)');
    } else {
      // Clean expired sessions at startup and periodically to avoid session table growth.
      const removed = db.cleanupExpiredSessions();
      if (removed > 0) {
        console.log(`🧹 Startup cleanup removed ${removed} expired sessions`);
      }

      setInterval(() => {
        try {
          const deletedCount = db.cleanupExpiredSessions();
          if (deletedCount > 0) {
            console.log(`🧹 Session cleanup removed ${deletedCount} expired sessions`);
          }
        } catch (cleanupError) {
          console.error('Session cleanup error:', cleanupError.message);
        }
      }, 10 * 60 * 1000);
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.log('⚠️  Falling back to in-memory storage');
    useDatabase = false;
  }
}

// Call initialization
initializeServices();

app.use(cors());
app.use(express.json());

// Voting period (default: always open)
let votingPeriod = {
  start: null, // Date string or null
  end: null    // Date string or null
};

function isVotingOpen() {
  const now = new Date();
  if (votingPeriod.start && now < new Date(votingPeriod.start)) return false;
  if (votingPeriod.end && now > new Date(votingPeriod.end)) return false;
  return true;
}

// Session ile kullanıcıyı doğrulama helper
async function getUserFromSession(req) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || !useDatabase) return null;

  const session = await db.getSession(sessionId);
  if (!session) return null;
  
  return {
    id: session.user_id,
    name: session.name,
    role: session.role
  };
}

// E-posta hash yardımcı fonksiyon — ZK-Email nullifier tohumu
function hashEmail(email) {
  return credentialIssuer
    ? credentialIssuer.hashEmail(email)
    : ethers.keccak256(ethers.toUtf8Bytes(email.toLowerCase() + 'ZKEMAIL_VOTING_SSI_2026'));
}

function isValidFaceDescriptor(descriptor) {
  return Array.isArray(descriptor)
    && descriptor.length >= 64
    && descriptor.length <= 256
    && descriptor.every(v => typeof v === 'number' && Number.isFinite(v));
}

// Physical-to-digital identity mapping rules:
// Student id format: YYYY 08 08 XXX (e.g. 20190808081)
function extractStudentIdFromEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const localPart = email.split('@')[0] || '';
  const digitsOnly = localPart.replace(/\D/g, '');
  return digitsOnly || null;
}

function isValidStudentId(studentId) {
  if (!studentId || typeof studentId !== 'string') return false;
  return /^20\d{2}0808\d{3}$/.test(studentId.trim());
}

function validateUserIdentityMapping(userRecord) {
  // Admin account stays outside student mapping checks.
  if (!userRecord || userRecord.role === 'admin') return { ok: true };

  if (!userRecord.email) {
    return { ok: false, message: 'Kimlik eşlemesi için kullanıcı e-postası eksik.' };
  }

  if (!userRecord.student_id) {
    return { ok: false, message: 'Kimlik eşlemesi için öğrenci numarası eksik.' };
  }

  const extractedStudentId = extractStudentIdFromEmail(userRecord.email);
  if (!isValidStudentId(extractedStudentId)) {
    return { ok: false, message: 'Kurumsal e-postadan geçerli öğrenci numarası türetilemedi.' };
  }

  if (userRecord.student_id !== extractedStudentId) {
    return {
      ok: false,
      message: 'Fiziksel-dijital kimlik eşlemesi bozuk. E-posta ve öğrenci numarası uyuşmuyor.'
    };
  }

  return { ok: true };
}

function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

async function createSessionForUser(user) {
  const tempWallet = createWallet();
  console.log(`🔑 Temporary wallet created for ${user.name}: ${tempWallet.address}`);

  const createSessionId = () => (
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex')
  );

  const fundTemporaryWallet = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545');
      const funderPrivateKey = process.env.ADMIN_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const funderWallet = new ethers.Wallet(funderPrivateKey, provider);
      const tx = await funderWallet.sendTransaction({
        to: tempWallet.address,
        value: ethers.parseEther('1.0')
      });
      await tx.wait();
      console.log(`💰 Funded temp wallet with 1 ETH: ${tx.hash}`);
      return { success: true, txHash: tx.hash };
    } catch (fundError) {
      console.error('⚠️  Failed to fund temp wallet:', fundError.message);
      return { success: false, error: fundError.message || 'Temporary wallet funding failed' };
    }
  };

  const expiresAt = new Date(Date.now() + parseInt(process.env.SESSION_TIMEOUT || 28800000));
  const encryptedPrivateKey = encryptPrivateKey(tempWallet.privateKey);
  const fundingResult = await fundTemporaryWallet();

  let sessionId = null;
  let createSessionError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidateSessionId = createSessionId();
    try {
      await db.createSession(
        candidateSessionId,
        user.id,
        expiresAt,
        tempWallet.address,
        encryptedPrivateKey,
        fundingResult.success,
        fundingResult.success ? null : fundingResult.error
      );
      sessionId = candidateSessionId;
      createSessionError = null;
      break;
    } catch (sessionError) {
      createSessionError = sessionError;
      const isUniqueIdError = String(sessionError?.message || '').toLowerCase().includes('unique');
      if (!isUniqueIdError) {
        break;
      }
    }
  }

  if (!sessionId) {
    throw createSessionError || new Error('Session could not be created');
  }

  const walletFundingWarning = fundingResult.success
    ? undefined
    : 'Geçici oy cüzdanı fonlanamadı. Oy gönderme sırasında hata alırsanız tekrar giriş yapın ya da yöneticinize bildirin.';

  return {
    sessionId,
    user: { name: user.name, role: user.role },
    tempWalletAddress: tempWallet.address,
    walletFundingStatus: fundingResult.success ? 'ready' : 'warning',
    walletFundingWarning
  };
}

// Root endpoint
app.get('/', (req, res) => {
  res.send('Blockchain-Based Online Voting System API');
});

/**
 * POST /api/register/send-otp
 * Public — no auth required. Sends OTP to email for registration verification.
 */
app.post('/api/register/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Geçerli bir e-posta adresi giriniz' });
    }

    // Check domain whitelist
    const domainAllowed = db.isEmailDomainAllowed(email);
    if (!domainAllowed) {
      return res.status(403).json({ message: `Bu e-posta domaini izin listesinde yok. Lütfen admin ile iletişime geçin. (${email.split('@')[1]})` });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp + email.toLowerCase()).digest('hex');
    const emailHash = hashEmail(email);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    db.createEmailVerification(email, emailHash, otpHash, expiresAt);

    let emailSent = false;
    const transporter = createMailTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"SSI Voting" <noreply@voting.local>',
          to: email,
          subject: '🔐 SSI Voting - Kayıt Doğrulama Kodunuz',
          html: `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:auto;background:#0f0c29;border-radius:16px;overflow:hidden">
              <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 32px">
                <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">🗳️ SSI Blockchain Oylama</h1>
                <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px">Hesap Kayıt Doğrulaması</p>
              </div>
              <div style="padding:32px">
                <p style="color:#c4b5fd;font-size:15px;margin:0 0 8px">Kayıt doğrulama kodunuz:</p>
                <div style="background:#1e1b4b;border:2px solid #7c3aed;border-radius:12px;padding:24px;text-align:center;margin:16px 0">
                  <span style="font-size:44px;font-weight:900;letter-spacing:12px;color:#4ade80;font-family:monospace">${otp}</span>
                </div>
                <p style="color:#9ca3af;font-size:13px;margin:16px 0 0">⏰ Bu kod <strong style="color:#fbbf24">10 dakika</strong> geçerlidir.</p>
                <p style="color:#9ca3af;font-size:13px;margin:8px 0 0">🛡️ Kodu kimseyle paylaşmayınız.</p>
                <hr style="border:none;border-top:1px solid #374151;margin:24px 0">
                <p style="color:#6b7280;font-size:12px;margin:0">Bu isteği siz yapmadıysanız, bu e-postayı dikkate almayınız.</p>
              </div>
            </div>
          `
        });
        emailSent = true;
        console.log(`📧 Register OTP sent to: ${email}`);
      } catch (e) {
        console.error('Register OTP email error:', e.message);
      }
    }

    const devMode = !transporter || !emailSent;
    console.log(`🔑 Register OTP for ${email}: ${otp}`);

    res.json({
      success: true,
      message: emailSent ? `Doğrulama kodu ${email} adresine gönderildi` : `[DEV] OTP: ${otp}`,
      devOtp: devMode ? otp : undefined,
      expiresIn: 600
    });
  } catch (error) {
    console.error('Register send-otp error:', error);
    res.status(500).json({ message: 'OTP gönderilemedi', error: error.message });
  }
});

// Register endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { name, password, studentId, email, otp, faceDescriptor } = req.body;
    if (!name || !password) {
      return res.status(400).json({ message: 'İsim ve şifre zorunludur' });
    }

    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const existingUser = await db.findUserByName(name);
    if (existingUser) {
      return res.status(400).json({ message: 'Bu kullanıcı adı zaten kayıtlı' });
    }

    // Student id is mapped from institutional email local part by default.
    const mappedStudentId = (studentId && String(studentId).trim()) || extractStudentIdFromEmail(email);
    if (!isValidStudentId(mappedStudentId)) {
      return res.status(400).json({
        message: 'Öğrenci numarası formatı geçersiz. Beklenen format: YYYY0808XXX (ör: 20190808081)'
      });
    }

    // If email provided, require OTP verification
    if (email) {
      const domainAllowed = db.isEmailDomainAllowed(email);
      if (!domainAllowed) {
        return res.status(400).json({ message: 'E-posta adresi için izin verilen bir domain kullanılmalıdır' });
      }
      if (!otp) {
        return res.status(400).json({ message: 'E-posta doğrulama kodu (OTP) gereklidir' });
      }
      const otpHash = crypto.createHash('sha256').update(otp + email.toLowerCase()).digest('hex');
      const record = db.getEmailVerification(email, otpHash);
      if (!record) {
        return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş OTP kodu' });
      }
      db.markEmailVerificationUsed(record.id);
    }

    if (faceDescriptor !== undefined && !isValidFaceDescriptor(faceDescriptor)) {
      return res.status(400).json({ message: 'Geçersiz yüz verisi' });
    }

    const createdUser = await db.createUser(name, hashedPassword, 'user', mappedStudentId, email || null);
    if (faceDescriptor && createdUser?.id) {
      db.setUserFaceProfile(createdUser.id, faceDescriptor);
    }
    console.log(`✅ User registered: ${name}${email ? ' (' + email + ')' : ''}`);

    res.json({ message: 'Kayıt başarılı' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const user = await db.findUserByName(name);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const mappingCheck = validateUserIdentityMapping(user);
    if (!mappingCheck.ok) {
      return res.status(403).json({ message: mappingCheck.message });
    }

    const response = await createSessionForUser(user);
    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// POST /api/face/register - Save/update face template for current user
app.post('/api/face/register', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const user = await getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { descriptor } = req.body;
    if (!isValidFaceDescriptor(descriptor)) {
      return res.status(400).json({ message: 'Invalid face descriptor' });
    }

    db.setUserFaceProfile(user.id, descriptor);
    res.json({ success: true, message: 'Face profile saved' });
  } catch (error) {
    console.error('Face register error:', error);
    res.status(500).json({ message: 'Face profile could not be saved' });
  }
});

// POST /api/face/login - Fast login with name + face descriptor
app.post('/api/face/login', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { name, descriptor } = req.body;
    if (!name || !isValidFaceDescriptor(descriptor)) {
      return res.status(400).json({ message: 'Name and valid face descriptor are required' });
    }

    const user = await db.findUserByName(name);
    if (!user) {
      return res.status(401).json({ message: 'Face login failed' });
    }

    const mappingCheck = validateUserIdentityMapping(user);
    if (!mappingCheck.ok) {
      return res.status(403).json({ message: mappingCheck.message });
    }

    const faceProfile = db.getUserFaceProfile(user.id);
    if (!faceProfile) {
      return res.status(404).json({ message: 'No face profile found for this user' });
    }

    const distance = euclideanDistance(descriptor, faceProfile.descriptor);
    const threshold = parseFloat(process.env.FACE_LOGIN_THRESHOLD || '0.48');
    if (!Number.isFinite(distance) || distance > threshold) {
      return res.status(401).json({ message: 'Face verification failed' });
    }

    const response = await createSessionForUser(user);
    res.json({
      ...response,
      faceDistance: Number(distance.toFixed(4)),
      faceThreshold: threshold
    });
  } catch (error) {
    console.error('Face login error:', error);
    res.status(500).json({ message: 'Face login failed' });
  }
});

// POST /api/logout - Logout ve session'ı sil
app.post('/api/logout', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      return res.status(400).json({ message: 'No session found' });
    }
    
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }
    
    await db.deleteSession(sessionId);
    console.log(`🚪 Session deleted: ${sessionId}`);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
});

// Admin: Aday ekleme (currently returns static data - TODO: implement database)
app.post('/api/candidates', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Only admin can add candidates' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Aday ismi gerekli' });
  // TODO: Implement database candidate creation
  res.json({ message: 'Feature not yet implemented - candidates are pre-loaded from database' });
});

app.get('/api/candidates', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }
    const candidates = await db.getAllCandidates();
    res.json(candidates.map(c => c.name));
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ message: 'Failed to fetch candidates' });
  }
});

// GET /api/elections - Get active elections (for users)
app.get('/api/elections', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }
    
    // Get user info from session
    const user = await getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Get user's email from database
    const userDetails = await db.findUserByName(user.name);
    const userEmail = userDetails?.email;
    const userDomain = userEmail ? userEmail.split('@')[1]?.toLowerCase() : null;
    
    const allElections = db.getAllElections();
    // Return only active elections for regular users
    const activeElections = allElections.filter(e => e.is_active === 1);
    
    // Filter elections based on user's email domain
    const accessibleElections = activeElections.filter(election => {
      // If no domain restrictions, everyone can access
      if (!election.allowedDomains || election.allowedDomains.length === 0) {
        return true;
      }
      
      // If user has no email, they can't access domain-restricted elections
      if (!userDomain) {
        return false;
      }
      
      // Check if user's domain is in the allowed list
      return election.allowedDomains.some(d => d.domain.toLowerCase() === userDomain);
    });
    
    res.json(accessibleElections);
  } catch (error) {
    console.error('Error fetching elections:', error);
    res.status(500).json({ message: 'Failed to fetch elections' });
  }
});

// GET /api/candidates/:electionId - Get candidates for a specific election
app.get('/api/candidates/:electionId', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }
    const electionId = parseInt(req.params.electionId);
    if (isNaN(electionId)) {
      return res.status(400).json({ message: 'Invalid election ID' });
    }
    const allElections = db.getAllElections();
    const election = allElections.find(e => e.id === electionId);
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    res.json(election.candidates || []);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ message: 'Failed to fetch candidates' });
  }
});

// POST /api/vote/simple - Simple voting without OTP (uses user's stored email)
app.post('/api/vote/simple', async (req, res) => {
  try {
    const { electionId, candidateId } = req.body;
    const normalizedElectionId = Number(electionId);
    const normalizedCandidateId = Number(candidateId);
    
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!credentialIssuer) {
      return res.status(503).json({ message: 'Credential service unavailable' });
    }

    if (!relayerService) {
      return res.status(503).json({ message: 'Relayer service unavailable' });
    }

    // Get user from session
    const user = await getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get user's email from database
    const userDetails = await db.findUserByName(user.name);
    if (!userDetails || !userDetails.email) {
      return res.status(400).json({ message: 'Kullanıcı email adresi bulunamadı. Lütfen profilinizi güncelleyin.' });
    }

    const email = userDetails.email;

    // Check if user's email domain is allowed for this election
    const allElections = db.getAllElections();
    const election = allElections.find(e => e.id === normalizedElectionId);
    
    if (!election) {
      return res.status(404).json({ message: 'Seçim bulunamadı' });
    }

    if (!election.is_active) {
      return res.status(400).json({ message: 'Bu seçim aktif değil' });
    }

    // Check domain restrictions
    if (election.allowedDomains && election.allowedDomains.length > 0) {
      const userDomain = email.split('@')[1]?.toLowerCase();
      const isAllowed = election.allowedDomains.some(d => d.domain.toLowerCase() === userDomain);
      
      if (!isAllowed) {
        return res.status(403).json({ message: 'Bu seçim için email domain\'iniz yetkili değil' });
      }
    }

    // Get blockchain election ID
    const blockchainElectionId = election.blockchain_election_id;
    
    // Get candidate's blockchain ID
    const candidate = election.candidates.find(c => c.id === normalizedCandidateId);
    if (!candidate) {
      return res.status(404).json({ message: 'Aday bulunamadı' });
    }
    const blockchainCandidateId = candidate.blockchain_candidate_id;

    // Create credential using user's email and blockchain IDs
    const credentialData = await credentialIssuer.issueVoteCredential(
      email,
      blockchainElectionId,
      blockchainCandidateId
    );

    console.log(`\n🗳️ Simple vote from user ${user.name} (${email}) for election ${normalizedElectionId} (blockchain: ${blockchainElectionId}), candidate ${normalizedCandidateId} (blockchain: ${blockchainCandidateId})`);

    // Submit via relayer (use only the credential part, not the wrapper)
    const result = await relayerService.submitVote(
      credentialData.credential,
      `user_${user.id}`,
      credentialIssuer.getIssuerAddress()
    );

    // Record vote in database. Do not swallow this error to avoid false-success responses.
    await db.recordVote(
      user.id,
      normalizedElectionId,
      blockchainCandidateId,
      result.txHash,
      result.txHash
    );

    res.json({
      success: true,
      txHash: result.txHash,
      message: 'Oyunuz başarıyla kaydedildi'
    });

  } catch (error) {
    console.error('Error in simple vote:', error);
    
    if (error.message && error.message.includes('already voted')) {
      return res.status(400).json({ message: 'Bu seçimde zaten oy kullandınız' });
    }
    
    res.status(500).json({ 
      message: error.message || 'Oy kaydedilemedi',
      error: error.toString()
    });
  }
});

// GET /api/votes - Get vote counts
app.get('/api/votes', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const electionId = req.query?.electionId ? Number(req.query.electionId) : null;
    if (electionId !== null && Number.isNaN(electionId)) {
      return res.status(400).json({ message: 'Invalid electionId' });
    }

    const results = db.getVoteResultsByElection(electionId);
    res.json(results);
  } catch (error) {
    console.error('Get vote results error:', error);
    res.status(500).json({ message: 'Failed to fetch vote results' });
  }
});

// POST /api/votes - Vote using backend wallet (for users without MetaMask)
app.post('/api/votes', async (req, res) => {
  try {
    const user = await getUserFromSession(req);
    const { candidate, electionId = 1 } = req.body;
    const sessionId = req.headers['x-session-id'];
    
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (!isVotingOpen()) return res.status(403).json({ message: 'Voting is closed' });
    if (!candidate) return res.status(400).json({ message: 'Candidate required' });
    if (!sessionId) return res.status(400).json({ message: 'No session found' });
    
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }
    
    // Check if user already voted
    const hasVoted = await db.hasUserVoted(user.id, electionId);
    if (hasVoted) {
      return res.status(400).json({ message: 'You have already voted in this election' });
    }
    
    // Get session wallet
    const sessionWallet = await db.getSessionWallet(sessionId);
    if (!sessionWallet || !sessionWallet.temp_wallet_address || !sessionWallet.temp_wallet_private_key_encrypted) {
      return res.status(400).json({ 
        message: 'No temporary wallet found. Please login again.' 
      });
    }

    if (Number(sessionWallet.wallet_funded) !== 1) {
      return res.status(503).json({
        message: sessionWallet.wallet_funding_error
          ? `Temporary wallet funding failed: ${sessionWallet.wallet_funding_error}`
          : 'Temporary wallet is not funded yet. Please login again.'
      });
    }
    
    // Get candidate ID
    const candidates = await db.getCandidatesByElection(electionId);
    const candidateObj = candidates.find(c => c.name === candidate);
    if (!candidateObj) {
      return res.status(400).json({ message: 'Invalid candidate' });
    }
    const candidateIndex = Number(candidateObj.blockchain_candidate_id); // contract expects blockchain candidate index

    // Decrypt session's temporary private key and create wallet
    const privateKey = decryptPrivateKey(sessionWallet.temp_wallet_private_key_encrypted);
    const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545');
    const wallet = new ethers.Wallet(privateKey, provider);
    const minVoteBalance = ethers.parseEther('0.0001');
    const walletBalance = await provider.getBalance(wallet.address);
    if (walletBalance < minVoteBalance) {
      return res.status(503).json({
        message: `Temporary wallet balance is too low (${ethers.formatEther(walletBalance)} ETH). Please login again.`
      });
    }

    // Load contract address — SSI uses VOTING_CONTRACT_ADDRESS, legacy uses CONTRACT_ADDRESS
    const ssiContractAddress = process.env.VOTING_CONTRACT_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
    const legacyContractAddress = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';

    // Try SSI contract first, fall back to VotingAnonymous
    let tx, receipt;

    if (credentialIssuer) {
      // === SSI FLOW (VotingSSI contract) ===
      console.log(`📝 Using SSI voting flow for user ${user.name}`);

      // Issue a signed credential via CredentialIssuer
      // Use the user's stored email; fall back to a derived placeholder so
      // the hash is deterministic for this user even without a real email.
      const userEmail = user.email || `${user.name}@internal.voting`;
      const result = await credentialIssuer.issueVoteCredential(
        userEmail,
        electionId,
        candidateIndex
      );
      const credential = result.credential;

      // Load VotingSSI ABI
      const contractABI = require('./smart-contracts/artifacts/contracts/VotingSSI.sol/VotingSSI.json').abi;
      const contract = new ethers.Contract(ssiContractAddress, contractABI, wallet);

      // Build VoteProof struct for contract call
      const voteProof = {
        emailHash:   credential.emailHash,
        electionID:  credential.electionID,
        candidateID: credential.candidateID,
        timestamp:   credential.timestamp,
        signature:   credential.signature
      };

      console.log(`📤 Submitting SSI vote to blockchain (wallet: ${sessionWallet.temp_wallet_address})...`);
      tx = await contract.vote(voteProof);
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    } else {
      // === LEGACY FLOW (VotingAnonymous contract) ===
      console.log(`📝 Using legacy voting flow for user ${user.name}`);

      const secret = ethers.hexlify(ethers.randomBytes(32));
      const electionIdHex = ethers.toBeHex(electionId, 32);
      const commitment = ethers.keccak256(ethers.concat([secret, electionIdHex]));
      const signature = await authService.signVoteAuth(commitment);

      const contractABI = require('./smart-contracts/artifacts/contracts/VotingAnonymous.sol/VotingAnonymous.json').abi;
      const contract = new ethers.Contract(legacyContractAddress, contractABI, wallet);

      console.log(`📤 Submitting legacy vote to blockchain (wallet: ${sessionWallet.temp_wallet_address})...`);
      tx = await contract.vote(electionId, candidateIndex, commitment, signature);
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    }

    // Record vote in database
    // Use tx hash as commitment for SSI votes (unique per transaction)
    await db.recordVote(user.id, electionId, candidateIndex, receipt.hash, receipt.hash);

    res.json({
      message: 'Vote recorded successfully',
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      candidate
    });
  } catch (error) {
    console.error('Vote error:', error);

    // Decode revert reason for user-friendly messages
    const msg = error.reason || error.message || '';
    if (msg.includes('Nullifier already used') || msg.includes('Commitment already used')) {
      return res.status(400).json({ message: 'You have already voted in this election.' });
    }
    if (error.code === 'CALL_EXCEPTION') {
      return res.status(400).json({ message: 'Smart contract rejected the vote: ' + (error.reason || 'unknown reason') });
    }
    
    res.status(500).json({ 
      message: error.reason || error.message || 'Vote submission failed'
    });
  }
});

// Get voting history for current user
app.get('/api/voting-history', async (req, res) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const history = await db.getUserVotingHistory(user.id);
    res.json(history);
  } catch (error) {
    console.error('Get voting history error:', error);
    res.status(500).json({ message: 'Failed to fetch voting history' });
  }
});

/**
 * GET /api/ssi/domain
 * Get EIP-712 domain information (useful for client-side signing)
 */
app.get('/api/ssi/domain', (req, res) => {
  try {
    if (!credentialIssuer) {
      return res.status(503).json({ 
        message: 'Credential Issuer service unavailable' 
      });
    }

    const domain = credentialIssuer.getDomain();
    
    res.json({
      success: true,
      domain: domain,
      issuer: credentialIssuer.getIssuerAddress()
    });

  } catch (error) {
    console.error('❌ Domain info error:', error);
    res.status(500).json({ 
      message: 'Failed to get domain info',
      error: error.message 
    });
  }
});

// ========== RELAYER ENDPOINTS ==========

/**
 * POST /api/ssi/relayer/submit
 * Submit vote via relayer (gas-less transaction)
 * Relayer pays gas fee to preserve user anonymity
 */
app.post('/api/ssi/relayer/submit', async (req, res) => {
  try {
    const { credential } = req.body;
    const sessionId = req.headers['x-session-id'];
    const userIP = req.ip || req.connection.remoteAddress;

    if (!credential) {
      return res.status(400).json({ message: 'Credential is required' });
    }

    if (!relayerService) {
      return res.status(503).json({ 
        message: 'Relayer service unavailable - check RELAYER_PRIVATE_KEY in .env',
        fallback: 'Please use direct MetaMask transaction instead'
      });
    }

    if (!credentialIssuer) {
      return res.status(503).json({ 
        message: 'Credential Issuer service unavailable' 
      });
    }

    // Get user for logging purposes (optional)
    let userIdentifier = userIP;
    try {
      const user = await getUserFromSession(req);
      if (user) {
        userIdentifier = `user_${user.id}`;
      }
    } catch (err) {
      // Continue with IP-based rate limiting
    }

    console.log('\n🚀 Relayer submission request from:', userIdentifier);

    // Submit via relayer
    const result = await relayerService.submitVote(
      credential,
      userIdentifier,
      credentialIssuer.getIssuerAddress()
    );

    // Record vote in database (optional, for tracking)
    if (useDatabase && sessionId) {
      try {
        const user = await getUserFromSession(req);
        if (user) {
          await db.recordVote(
            user.id,
            credential.electionID,
            credential.candidateID,
            result.txHash,
            result.txHash
          );
        }
      } catch (dbErr) {
        console.error('⚠️  Failed to record vote in database:', dbErr);
        // Don't fail the request - blockchain vote is what matters
      }
    }

    res.json({
      success: true,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      gasUsed: result.gasUsed,
      relayerAddress: result.relayerAddress,
      message: 'Vote successfully submitted via relayer'
    });

    console.log('✅ Vote relayed successfully:', result.txHash);

  } catch (error) {
    console.error('❌ Relayer submission error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to submit vote via relayer',
      error: error.message 
    });
  }
});

/**
 * GET /api/ssi/relayer/status
 * Get relayer service status and balance
 */
app.get('/api/ssi/relayer/status', async (req, res) => {
  try {
    if (!relayerService) {
      return res.status(503).json({ 
        message: 'Relayer service unavailable' 
      });
    }

    const status = await relayerService.getStatus();

    res.json({
      success: true,
      status: status,
      available: true
    });

  } catch (error) {
    console.error('❌ Relayer status error:', error);
    res.status(500).json({ 
      message: 'Failed to get relayer status',
      error: error.message 
    });
  }
});



/**
 * GET /api/blockchain/info
 * Get blockchain connection information
 */
app.get('/api/blockchain/info', (req, res) => {
  res.json({
    contractAddress: process.env.VOTING_CONTRACT_ADDRESS,
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL,
    chainId: parseInt(process.env.CHAIN_ID || '31337'),
    adminAddress: authService ? authService.getAdminAddress() : null,
    isAvailable: !!authService
  });
});

// ========== END BLOCKCHAIN ENDPOINTS ==========

// Voting period endpoints
app.get('/api/voting-period', (req, res) => {
  res.json(votingPeriod);
});

app.post('/api/voting-period', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Only admin can set voting period' });
  const { start, end } = req.body;
  votingPeriod.start = start ? new Date(start).toISOString() : null;
  votingPeriod.end = end ? new Date(end).toISOString() : null;
  res.json({ message: 'Voting period updated', votingPeriod });
});

// ========== ZK-EMAIL: ADMIN DOMAIN MANAGEMENT ==========

// GET /api/admin/email-domains  — list all whitelisted domains
app.get('/api/admin/email-domains', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  res.json(db.getAllowedEmailDomains());
});

// POST /api/admin/email-domains  — add domain
app.post('/api/admin/email-domains', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ message: 'domain required' });
  const result = db.addEmailDomain(domain, user.name);
  res.json({ success: true, domain: result });
});

// DELETE /api/admin/email-domains/:id  — remove domain
app.delete('/api/admin/email-domains/:id', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  db.removeEmailDomain(parseInt(req.params.id));
  res.json({ success: true });
});

// ========== ZK-EMAIL: OTP FLOW ==========

// Nodemailer transporter (configure via .env)
function createMailTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false  // allow self-signed certs (dev)
      }
    });
  }
  return null;
}

/**
 * POST /api/zkemail/send-otp
 * Step 1: Send OTP to email. Domain must be whitelisted by admin.
 * The OTP itself acts as the "proof of email possession" — 
 * its hash becomes the nullifier seed (emailHash).
 */
app.post('/api/zkemail/send-otp', async (req, res) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ message: 'Valid email required' });

    // Check domain is whitelisted
    if (!db.isEmailDomainAllowed(email)) {
      return res.status(403).json({ 
        message: `Bu e-posta domaini izin listesinde yok. Admin ile iletisime gecin.`,
        domain: email.split('@')[1]
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp + email.toLowerCase()).digest('hex');
    
    // emailHash = ZK-Email nullifier seed (keccak256 like contract expects)
    const emailHash = hashEmail(email);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
    db.createEmailVerification(email, emailHash, otpHash, expiresAt);

    // Try to send email
    let emailSent = false;
    const transporter = createMailTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"SSI Voting" <noreply@voting.local>',
          to: email,
          subject: '\ud83d\udd10 SSI Voting - E-posta Doğrulama Kodunuz',
          html: `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:auto;background:#0f0c29;border-radius:16px;overflow:hidden">
              <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 32px">
                <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">🗳️ SSI Blockchain Oylama</h1>
                <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px">Akdeniz Üniversitesi - Güvenli Oylama Sistemi</p>
              </div>
              <div style="padding:32px">
                <p style="color:#c4b5fd;font-size:15px;margin:0 0 8px">E-posta doğrulama kodunuz:</p>
                <div style="background:#1e1b4b;border:2px solid #7c3aed;border-radius:12px;padding:24px;text-align:center;margin:16px 0">
                  <span style="font-size:44px;font-weight:900;letter-spacing:12px;color:#4ade80;font-family:monospace">${otp}</span>
                </div>
                <p style="color:#9ca3af;font-size:13px;margin:16px 0 0">⏰ Bu kod <strong style="color:#fbbf24">10 dakika</strong> geçerlidir.</p>
                <p style="color:#9ca3af;font-size:13px;margin:8px 0 0">🛡️ Kodu kimseyle paylaşmayınız.</p>
                <hr style="border:none;border-top:1px solid #374151;margin:24px 0">
                <p style="color:#6b7280;font-size:12px;margin:0">Bu isteği siz yapmadıysanız, bu e-postayı dikkate almayınız.</p>
              </div>
            </div>
          `
        });
        emailSent = true;
        console.log(`📧 ZK-Email OTP sent to: ${email}`);
      } catch (e) {
        console.error('Email send error:', e.message);
      }
    }

    // In dev mode (no SMTP), return OTP in response for testing
    const devMode = !transporter || !emailSent;
    console.log(`🔑 ZK-Email OTP for ${email}: ${otp} (hash: ${otpHash.slice(0,16)}...)`);

    res.json({
      success: true,
      message: emailSent ? `Dogrulama kodu ${email} adresine gonderildi` : `[DEV MODE] OTP: ${otp}`,
      devOtp: devMode ? otp : undefined,  // only in dev
      expiresIn: 600
    });

  } catch (error) {
    console.error('ZK-Email send-otp error:', error);
    res.status(500).json({ message: 'OTP gonderilemedi', error: error.message });
  }
});

/**
 * POST /api/zkemail/verify-otp
 * Step 2: Verify OTP. If valid, issue a ZK-Email credential.
 * emailHash (nullifier seed) is returned — raw email NEVER leaves this function.
 */
app.post('/api/zkemail/verify-otp', async (req, res) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const { email, otp, electionID, candidateID } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'email and otp required' });
    if (!electionID || candidateID === undefined) return res.status(400).json({ message: 'electionID and candidateID required' });

    const otpHash = crypto.createHash('sha256').update(otp + email.toLowerCase()).digest('hex');
    const record = db.getEmailVerification(email, otpHash);

    if (!record) {
      return res.status(400).json({ message: 'Gecersiz veya suresi dolmus OTP' });
    }

    // Mark OTP as used (single-use)
    db.markEmailVerificationUsed(record.id);

    if (!credentialIssuer) {
      return res.status(503).json({ message: 'Credential Issuer servisi hazir degil' });
    }

    // Check domain-election restriction (if election has restrictions, email domain must match)
    if (!db.isEmailAllowedForElection(email, electionID)) {
      return res.status(403).json({
        message: `Bu e-posta domaini bu secim icin yetkili degil.`,
        domain: email.split('@')[1]
      });
    }

    // Check double-vote
    const hasVoted = await db.hasUserVoted(user.id, electionID);
    if (hasVoted) return res.status(403).json({ message: 'Bu secimde zaten oy kullandınız' });

    // Issue EIP-712 signed credential using emailHash as nullifier
    const result = await credentialIssuer.issueVoteCredential(email, electionID, candidateID);

    console.log(`✅ ZK-Email credential issued for election ${electionID}, nullifier: ${result.credential.emailHash.slice(0,20)}...`);

    res.json({
      success: true,
      credential: result.credential,
      issuer: result.issuer,
      issuedAt: result.issuedAt,
      message: 'E-posta dogrulandi, credential hazir'
    });

  } catch (error) {
    console.error('ZK-Email verify-otp error:', error);
    res.status(500).json({ message: 'OTP dogrulanamadi', error: error.message });
  }
});

// ========== ADMIN: USER CRUD ==========

// POST /api/admin/users — create a user
app.post('/api/admin/users', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const { name, password, role, email } = req.body;
  if (!name || !password) return res.status(400).json({ message: 'name and password required' });
  if (role !== 'admin') return res.status(400).json({ message: 'Bu endpoint ile sadece admin rolu olusturulabilir' });
  try {
    const bcrypt = require('bcryptjs');
    const existing = await db.findUserByName(name);
    if (existing) return res.status(409).json({ message: 'Bu kullanici adi zaten var' });
    const hashed = bcrypt.hashSync(password, 10);
    const newUser = await db.createUser(name, hashed, 'admin', null, email || null);
    res.json({ success: true, user: { id: newUser.id, name: newUser.name, role: newUser.role } });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// PUT /api/admin/users/:id — update role / password / email
app.put('/api/admin/users/:id', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const updated = db.updateUser(parseInt(req.params.id), req.body);
  res.json({ success: true, user: updated });
});

// DELETE /api/admin/users/:id — delete user
app.delete('/api/admin/users/:id', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const targetId = parseInt(req.params.id);
  if (targetId === user.id) return res.status(400).json({ message: 'Kendi hesabinizi silemezsiniz' });
  db.deleteUser(targetId);
  res.json({ success: true });
});

// DELETE /api/admin/sessions/:id — force logout a session
app.delete('/api/admin/sessions/:id', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  db.deleteSession(req.params.id);
  res.json({ success: true });
});

// DELETE /api/admin/votes/:id — delete a vote record
app.delete('/api/admin/votes/:id', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  db.deleteVote(parseInt(req.params.id));
  res.json({ success: true });
});

// DELETE /api/admin/vote-status/:id — delete a vote-status record
app.delete('/api/admin/vote-status/:id', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  db.deleteVoteStatus(parseInt(req.params.id));
  res.json({ success: true });
});

// ========== ADMIN: ELECTION MANAGEMENT ==========

// GET /api/admin/elections — list all elections with candidates and domain restrictions
app.get('/api/admin/elections', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  res.json(db.getAllElections());
});

// POST /api/admin/elections — create a new election
app.post('/api/admin/elections', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const { title, description, startDate, endDate, candidates, allowedDomains } = req.body;
  if (!title || !startDate || !endDate) return res.status(400).json({ message: 'title, startDate, endDate required' });
  
  try {
    // STEP 1: Add election to blockchain first
    if (!relayerService) {
      return res.status(500).json({ message: 'Relayer service not available. Cannot create blockchain election.' });
    }
    
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
    const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
    const contractAddress = process.env.VOTING_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS;
    
    // Load contract ABI
    const VotingSSI = require('./client/src/contracts/VotingAnonymous.json');
    const contract = new ethers.Contract(contractAddress, VotingSSI.abi, adminWallet);
    
    // Convert dates to Unix timestamps
    const startTime = Math.floor(new Date(startDate).getTime() / 1000);
    const endTime = Math.floor(new Date(endDate).getTime() / 1000);
    
    // Prepare candidate names
    const candidateNames = Array.isArray(candidates) ? candidates.filter(c => c && c.trim()) : [];
    if (candidateNames.length === 0) {
      return res.status(400).json({ message: 'At least one candidate required' });
    }
    
    console.log('📝 Creating election on blockchain:', { title, startTime, endTime, candidateNames });
    
    // Call blockchain createElection
    const tx = await contract.createElection(title, startTime, endTime, candidateNames);
    await tx.wait();
    
    // Get the new election ID from blockchain
    const blockchainElectionId = await contract.currentElectionId();
    console.log('✅ Blockchain election created with ID:', blockchainElectionId.toString());
    
    // STEP 2: Add to database with blockchain ID
    const election = db.createElection(title, description, startDate, endDate, Number(blockchainElectionId));
    
    // Add candidates to database with blockchain IDs
    if (Array.isArray(candidates)) {
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        if (c && c.trim()) {
          db.addCandidateToElection(election.id, c.trim(), '', i);
        }
      }
    }
    
    // Add domain restrictions
    if (Array.isArray(allowedDomains)) {
      for (const d of allowedDomains) {
        if (d && d.trim()) db.addElectionDomainRestriction(election.id, d.trim());
      }
    }
    
    res.json(db.getAllElections().find(e => e.id === election.id));
  } catch (error) {
    console.error('❌ Error creating election:', error);
    res.status(500).json({ message: 'Failed to create election: ' + error.message });
  }
});

// PUT /api/admin/elections/:id — update election details
app.put('/api/admin/elections/:id', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const { title, description, startDate, endDate } = req.body;
  if (!title || !startDate || !endDate) return res.status(400).json({ message: 'title, startDate, endDate required' });
  const election = db.updateElection(parseInt(req.params.id), title, description, startDate, endDate);
  res.json(election);
});

// DELETE /api/admin/elections/:id — delete election
app.delete('/api/admin/elections/:id', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  db.deleteElection(parseInt(req.params.id));
  res.json({ success: true });
});

// PUT /api/admin/elections/:id/toggle — toggle active/inactive
app.put('/api/admin/elections/:id/toggle', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const election = db.toggleElectionActive(parseInt(req.params.id));
  res.json(election);
});

// POST /api/admin/elections/:id/candidates — add candidate to election
app.post('/api/admin/elections/:id/candidates', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: 'name required' });
  const candidate = db.addCandidateToElection(parseInt(req.params.id), name, description);
  res.json(candidate);
});

// DELETE /api/admin/elections/:id/candidates/:cid — remove candidate
app.delete('/api/admin/elections/:id/candidates/:cid', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  db.removeCandidateFromElection(parseInt(req.params.cid));
  res.json({ success: true });
});

// PUT /api/admin/elections/:id/candidates/:cid/update — update candidate name/description
app.put('/api/admin/elections/:id/candidates/:cid/update', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: 'name required' });
  const candidate = db.updateCandidate(parseInt(req.params.cid), name, description);
  res.json(candidate);
});

// GET /api/admin/elections/:id/domains — list domain restrictions
app.get('/api/admin/elections/:id/domains', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  res.json(db.getElectionDomainRestrictions(parseInt(req.params.id)));
});

// POST /api/admin/elections/:id/domains — add domain restriction
app.post('/api/admin/elections/:id/domains', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ message: 'domain required' });
  const result = db.addElectionDomainRestriction(parseInt(req.params.id), domain);
  res.json({ success: true, domain: result });
});

// DELETE /api/admin/elections/:id/domains/:did — remove domain restriction
app.delete('/api/admin/elections/:id/domains/:did', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  db.removeElectionDomainRestriction(parseInt(req.params.did));
  res.json({ success: true });
});

// ========== ADMIN PANEL ==========

// Admin panel HTML (must be before static middleware)
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// WebRTC pages
app.get('/webrtc/streamer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'webrtc-streamer.html'));
});

app.get('/webrtc/receiver', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'webrtc-receiver.html'));
});

io.on('connection', (socket) => {
  socket.on('webrtc:join', ({ roomId, role }) => {
    if (!roomId || !role) return;

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = role;

    if (role === 'streamer') {
      webrtcRooms.set(roomId, socket.id);
      io.to(roomId).emit('webrtc:streamer-available', { roomId, streamerId: socket.id });
      return;
    }

    if (role === 'receiver') {
      const streamerId = webrtcRooms.get(roomId);
      if (streamerId) {
        io.to(streamerId).emit('webrtc:receiver-ready', { roomId, receiverId: socket.id });
      }
    }
  });

  socket.on('webrtc:signal', ({ to, payload }) => {
    if (!to || !payload) return;
    io.to(to).emit('webrtc:signal', { from: socket.id, payload });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const role = socket.data.role;

    if (role === 'streamer' && roomId && webrtcRooms.get(roomId) === socket.id) {
      webrtcRooms.delete(roomId);
      io.to(roomId).emit('webrtc:streamer-offline', { roomId });
    }
  });
});

// Database API for admin panel
app.get('/api/admin/database', async (req, res) => {
  try {
    const user = await getUserFromSession(req);
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ message: 'Admin girisi gerekli' });
    }

    const data = {
      users: [],
      sessions: [],
      elections: [],
      candidates: [],
      votes: [],
      vote_status: []
    };

    // Get users
    const users = db.db.prepare('SELECT id, name, role, created_at FROM users').all();
    data.users = users;

    // Get sessions
    const sessions = db.db.prepare('SELECT id, user_id, temp_wallet_address, created_at, expires_at FROM sessions').all();
    data.sessions = sessions;

    // Get elections
    const elections = db.db.prepare('SELECT id, title, description, start_date, end_date, is_active FROM elections').all();
    data.elections = elections;

    // Get candidates
    const candidates = db.db.prepare('SELECT id, election_id, name, description, vote_count FROM candidates').all();
    data.candidates = candidates;

    // Get votes
    const votes = db.db.prepare('SELECT id, election_id, candidate_id, commitment, transaction_hash, created_at FROM votes').all();
    data.votes = votes;

    // Get vote status
    const vote_status = db.db.prepare('SELECT id, user_id, election_id, has_voted, voted_at, transaction_hash, commitment FROM vote_status').all();
    data.vote_status = vote_status;

    res.json(data);
  } catch (error) {
    console.error('Admin database error:', error);
    res.status(500).json({ message: 'Failed to fetch database data' });
  }
});



const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
