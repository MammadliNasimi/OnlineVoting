const { ethers } = require('ethers');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('../config/database-sqlite');
const state = require('../config/state');
const { createWallet, encryptPrivateKey } = require('./walletUtils');

async function getUserFromSession(req) {
    let token = req.cookies?.jwt_token || req.cookies?.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return null;
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) return null;
      const decoded = jwt.verify(token, jwtSecret);
      const session = await db.getSession(decoded.sessionId);
      if (!session) return null;
      return { id: session.user_id, name: session.name, role: session.role, sessionId: decoded.sessionId };
    } catch (e) { return null; }
}

function extractStudentIdFromEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const localPart = email.split('@')[0] || '';
  const digitsOnly = localPart.replace(/\D/g, '');
  return digitsOnly || null;
}

function isAkdenizStudentEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const domain = (email.split('@')[1] || '').trim().toLowerCase();
  return domain === 'ogr.akdeniz.edu.tr';
}

function isValidAkdenizStudentIdFormat(studentId) {
  if (!studentId || typeof studentId !== 'string') return false;
  return /^\d{4}0808\d{3}$/.test(studentId.trim());
}

function isValidStudentId(studentId) {
  if (!studentId || typeof studentId !== 'string') return false;
  return studentId.trim().length > 0;
}

function validateUserIdentityMapping(userRecord) {
  if (!userRecord || userRecord.role === 'admin') return { ok: true };
  if (!userRecord.email) return { ok: false, message: 'Missing email' };

  // Enforced mapping only for official student mail accounts.
  if (!isAkdenizStudentEmail(userRecord.email)) return { ok: true };

  if (!userRecord.student_id) return { ok: false, message: 'Missing student ID' };
  const extractedStudentId = extractStudentIdFromEmail(userRecord.email);
  if (!isValidAkdenizStudentIdFormat(extractedStudentId)) return { ok: false, message: 'Invalid ID' };
  if (userRecord.student_id !== extractedStudentId) return { ok: false, message: 'Mapping broken' };
  return { ok: true };
}

function isValidFaceDescriptor(descriptor) {
  return Array.isArray(descriptor) && descriptor.length >= 64 && descriptor.length <= 256 && descriptor.every(v => typeof v === 'number' && Number.isFinite(v));
}

function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) { const d = a[i] - b[i]; sum += d * d; }
  return Math.sqrt(sum);
}

function hashEmail(email) {
  return state.credentialIssuer ? state.credentialIssuer.hashEmail(email) : ethers.keccak256(ethers.toUtf8Bytes(email.toLowerCase() + 'ZKEMAIL_VOTING_SSI_2026'));
}

async function createSessionForUser(user) {
  const tempWallet = createWallet();
  const createSessionId = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));

  // Production'da relayer gas'i odedigi icin burner cuzdana fund gerekmez.
  // Local Hardhat'ta yine de fund'liyoruz ki eski testler calissin.
  // Sepolia/production'da fund'i arka plana al, login response'unu bekletme.
  const fundTemporaryWalletAsync = () => {
    const rpcUrl = (process.env.RPC_URL || process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545').trim();
    const isLocal = rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost');
    if (!isLocal) {
      // Production: skip funding (relayer gasless mimarisi var)
      return Promise.resolve({ success: true, skipped: true });
    }
    return (async () => {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const funderPrivateKey = (process.env.ADMIN_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80').trim();
        const funderWallet = new ethers.Wallet(funderPrivateKey, provider);
        const tx = await funderWallet.sendTransaction({ to: tempWallet.address, value: ethers.parseEther('1.0') });
        await tx.wait();
        return { success: true, txHash: tx.hash };
      } catch (e) { return { success: false, error: e.message }; }
    })();
  };

  const expiresAt = new Date(Date.now() + parseInt(process.env.SESSION_TIMEOUT || 28800000));
  const encryptedPrivateKey = encryptPrivateKey(tempWallet.privateKey);
  const fundingResult = await fundTemporaryWalletAsync();
  let sessionId = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidateSessionId = createSessionId();
    try { await db.createSession(candidateSessionId, user.id, expiresAt, tempWallet.address, encryptedPrivateKey, fundingResult.success, fundingResult.success ? null : fundingResult.error); sessionId = candidateSessionId; break; } catch (e) {}
  }
  return { success: true, sessionId, user: { id: user.id, name: user.name, role: user.role }, walletAddress: tempWallet.address, expiresAt, sessionFunded: fundingResult.success };
}

function createMailTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, tls: { ciphers: 'SSLv3', rejectUnauthorized: false } });
  }
  return null;
}

module.exports = { getUserFromSession, extractStudentIdFromEmail, isAkdenizStudentEmail, isValidAkdenizStudentIdFormat, isValidStudentId, validateUserIdentityMapping, isValidFaceDescriptor, euclideanDistance, hashEmail, createSessionForUser, createMailTransporter };
