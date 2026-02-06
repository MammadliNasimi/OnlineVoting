import { ethers } from 'ethers';

/**
 * Generate a random secret for anonymous voting
 * @returns {string} 32-byte hex secret
 */
export const generateSecret = () => {
  const randomBytes = ethers.randomBytes(32);
  return ethers.hexlify(randomBytes);
};

/**
 * Generate commitment from secret and election ID
 * @param {string} secret - User's secret (32 bytes hex)
 * @param {number} electionId - Election ID
 * @returns {string} Commitment hash
 */
export const generateCommitment = (secret, electionId) => {
  // Convert election ID to 32-byte hex
  const electionIdHex = ethers.toBeHex(electionId, 32);
  
  // Concatenate secret + electionId
  const combined = ethers.concat([secret, electionIdHex]);
  
  // Hash to create commitment
  const commitment = ethers.keccak256(combined);
  
  return commitment;
};

/**
 * Store secret in localStorage for later verification
 * @param {number} electionId - Election ID
 * @param {string} secret - User's secret
 */
export const storeSecret = (electionId, secret) => {
  const key = `voting_secret_${electionId}`;
  localStorage.setItem(key, secret);
  console.log(`🔐 Secret stored for election ${electionId}`);
};

/**
 * Retrieve stored secret
 * @param {number} electionId - Election ID
 * @returns {string|null} Stored secret or null
 */
export const getStoredSecret = (electionId) => {
  const key = `voting_secret_${electionId}`;
  return localStorage.getItem(key);
};

/**
 * Check if user has a secret for this election
 * @param {number} electionId - Election ID
 * @returns {boolean}
 */
export const hasStoredSecret = (electionId) => {
  return getStoredSecret(electionId) !== null;
};

/**
 * Format Ethereum address for display
 * @param {string} address - Full address
 * @returns {string} Shortened address (0x1234...5678)
 */
export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

/**
 * Format transaction hash for display
 * @param {string} txHash - Transaction hash
 * @returns {string} Shortened hash
 */
export const formatTxHash = (txHash) => {
  if (!txHash) return '';
  return `${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 8)}`;
};
