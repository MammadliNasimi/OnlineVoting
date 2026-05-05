const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { ethers } = require('ethers');

const db = require('../config/database-sqlite');
const state = require('../config/state');
const { createWallet, encryptPrivateKey } = require('./walletUtils');

const STUDENT_EMAIL_DOMAIN = 'ogr.akdeniz.edu.tr';
const STUDENT_ID_PATTERN = /^\d{4}0808\d{3}$/;
const SESSION_DEFAULT_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const FACE_DESCRIPTOR_MIN_LEN = 64;
const FACE_DESCRIPTOR_MAX_LEN = 256;
const HASH_PEPPER = 'ZKEMAIL_VOTING_SSI_2026';
const HARDHAT_DEFAULT_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

function extractStudentIdFromEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const localPart = email.split('@')[0] || '';
  const digitsOnly = localPart.replace(/\D/g, '');
  return digitsOnly || null;
}

function isAkdenizStudentEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return (email.split('@')[1] || '').trim().toLowerCase() === STUDENT_EMAIL_DOMAIN;
}

function isValidAkdenizStudentIdFormat(studentId) {
  if (!studentId || typeof studentId !== 'string') return false;
  return STUDENT_ID_PATTERN.test(studentId.trim());
}

function isValidStudentId(studentId) {
  return typeof studentId === 'string' && studentId.trim().length > 0;
}

// Yalnızca öğrenci e-postalarında studentID <-> email eşleşmesi zorunlu kılınır.
function validateUserIdentityMapping(userRecord) {
  if (!userRecord || userRecord.role === 'admin') return { ok: true };
  if (!userRecord.email) return { ok: false, message: 'Missing email' };
  if (!isAkdenizStudentEmail(userRecord.email)) return { ok: true };

  if (!userRecord.student_id) return { ok: false, message: 'Missing student ID' };
  const extracted = extractStudentIdFromEmail(userRecord.email);
  if (!isValidAkdenizStudentIdFormat(extracted)) return { ok: false, message: 'Invalid ID' };
  if (userRecord.student_id !== extracted) return { ok: false, message: 'Mapping broken' };
  return { ok: true };
}

function isValidFaceDescriptor(descriptor) {
  return Array.isArray(descriptor)
    && descriptor.length >= FACE_DESCRIPTOR_MIN_LEN
    && descriptor.length <= FACE_DESCRIPTOR_MAX_LEN
    && descriptor.every(v => typeof v === 'number' && Number.isFinite(v));
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

function hashEmail(email) {
  if (state.credentialIssuer) return state.credentialIssuer.hashEmail(email);
  return ethers.keccak256(ethers.toUtf8Bytes(email.toLowerCase() + HASH_PEPPER));
}

function createSessionId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
}

// Burner wallet'ı yalnızca local Hardhat'ta fonla. Production'da relayer gasless
// olarak işlem gönderdiği için ek fonlamaya gerek yoktur.
async function fundLocalWalletIfApplicable(targetAddress) {
  const rpcUrl = (process.env.RPC_URL || process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545').trim();
  const isLocal = rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost');
  if (!isLocal) return { success: true, skipped: true };

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const funderKey = (process.env.ADMIN_PRIVATE_KEY || HARDHAT_DEFAULT_KEY).trim();
    const funder = new ethers.Wallet(funderKey, provider);
    const tx = await funder.sendTransaction({ to: targetAddress, value: ethers.parseEther('1.0') });
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function createSessionForUser(user) {
  const tempWallet = createWallet();
  const expiresAt = new Date(Date.now() + parseInt(process.env.SESSION_TIMEOUT || SESSION_DEFAULT_TIMEOUT_MS, 10));
  const encryptedPrivateKey = encryptPrivateKey(tempWallet.privateKey);
  const fundingResult = await fundLocalWalletIfApplicable(tempWallet.address);

  let sessionId = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = createSessionId();
    try {
      await db.createSession(
        candidate,
        user.id,
        expiresAt,
        tempWallet.address,
        encryptedPrivateKey,
        fundingResult.success,
        fundingResult.success ? null : fundingResult.error
      );
      sessionId = candidate;
      break;
    } catch {
      // Sessionid çakışması — yeniden dene.
    }
  }

  return {
    success: true,
    sessionId,
    user: { id: user.id, name: user.name, role: user.role },
    walletAddress: tempWallet.address,
    expiresAt,
    sessionFunded: fundingResult.success
  };
}

// Trim her değer — panel paste'lerinden arkaya kaçan `\n` / boşluk DNS resolve'i (ENOTFOUND)
// veya auth handshake'i bozar. SSLv3 cipher hack'i yalnızca eski Office365 için gereklidir.
function createMailTransporter() {
  const host = (process.env.SMTP_HOST || process.env.SNTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || process.env.SNTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.SNTP_PASS || '').trim();
  const port = parseInt((process.env.SMTP_PORT || process.env.SNTP_PORT || '587').trim(), 10);
  const secureRaw = (process.env.SMTP_SECURE || process.env.SNTP_SECURE || '').trim().toLowerCase();
  const secure = secureRaw === 'true';

  if (!host || !user || !pass) return null;

  const isOffice365 = /office365|outlook/.test(host);
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    ...(isOffice365 ? { tls: { ciphers: 'SSLv3', rejectUnauthorized: false } } : {})
  });
}

module.exports = {
  extractStudentIdFromEmail,
  isAkdenizStudentEmail,
  isValidAkdenizStudentIdFormat,
  isValidStudentId,
  validateUserIdentityMapping,
  isValidFaceDescriptor,
  euclideanDistance,
  hashEmail,
  createSessionForUser,
  createMailTransporter
};
