const crypto = require('crypto');
const { ethers } = require('ethers');

const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || 'default-32-char-encryption-key!!!';
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

// Face descriptor şifrelemesi için ayrı bir anahtar tercih edilebilir; tanımlı
// değilse cüzdan anahtarına geri düşer. AES-256-GCM kullanılır (auth tag korumalı).
const FACE_ENCRYPTION_KEY = process.env.FACE_ENCRYPTION_KEY || ENCRYPTION_KEY;
const FACE_ALGORITHM = 'aes-256-gcm';

function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, 32);
}

function createWallet() {
  const wallet = ethers.Wallet.createRandom();
  return { address: wallet.address, privateKey: wallet.privateKey };
}

function encryptPrivateKey(privateKey) {
  const iv = crypto.randomBytes(16);
  const key = deriveKey(ENCRYPTION_KEY, 'salt');
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptPrivateKey(encryptedData) {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = deriveKey(ENCRYPTION_KEY, 'salt');
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ============== FACE DESCRIPTOR ENCRYPTION (AES-256-GCM) ==============
// Format: "v1:<saltHex>:<ivHex>:<authTagHex>:<cipherHex>"
// Salt her kayıt için benzersiz; aynı plaintext aynı çıktıyı vermez.

function encryptDescriptor(descriptorArray) {
  if (!Array.isArray(descriptorArray)) {
    throw new Error('Descriptor must be an array');
  }
  const plaintext = JSON.stringify(descriptorArray);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(FACE_ENCRYPTION_KEY, salt);
  const cipher = crypto.createCipheriv(FACE_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    'v1',
    salt.toString('hex'),
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex')
  ].join(':');
}

function decryptDescriptor(payload) {
  if (typeof payload !== 'string' || !payload.startsWith('v1:')) {
    throw new Error('Unsupported descriptor payload format');
  }
  const parts = payload.split(':');
  if (parts.length !== 5) throw new Error('Malformed descriptor payload');
  const [, saltHex, ivHex, tagHex, dataHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const key = deriveKey(FACE_ENCRYPTION_KEY, salt);
  const decipher = crypto.createDecipheriv(FACE_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted);
}

module.exports = {
  createWallet,
  encryptPrivateKey,
  decryptPrivateKey,
  encryptDescriptor,
  decryptDescriptor
};
