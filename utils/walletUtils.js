/**
 * Wallet Utility Functions
 * Temporary wallet creation, encryption/decryption for session-based voting
 */

const crypto = require('crypto');
const { ethers } = require('ethers');

const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || 'default-32-char-encryption-key!!!';
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

/**
 * Create a new random wallet
 * @returns {Object} Wallet with address and private key
 */
function createWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
}

/**
 * Encrypt private key for secure storage
 * @param {string} privateKey - Wallet private key
 * @returns {string} Encrypted private key (format: iv:encryptedData)
 */
function encryptPrivateKey(privateKey) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt private key from storage
 * @param {string} encryptedData - Encrypted private key (format: iv:encryptedData)
 * @returns {string} Decrypted private key
 */
function decryptPrivateKey(encryptedData) {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = {
  createWallet,
  encryptPrivateKey,
  decryptPrivateKey
};
