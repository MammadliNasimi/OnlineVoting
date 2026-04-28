// Centralized API + Socket configuration.
// Tek REACT_APP_API_URL set etmek yeterli; diğerleri otomatik türetilir.
// Override istersen REACT_APP_API_BASE_URL ve REACT_APP_SOCKET_URL kullanılabilir.

const stripTrailingSlash = (value) => (value || '').replace(/\/$/, '');

const RAW_API_URL = stripTrailingSlash(process.env.REACT_APP_API_URL || 'http://localhost:5000');

export const API_URL = RAW_API_URL;

export const API_BASE = stripTrailingSlash(
  process.env.REACT_APP_API_BASE_URL || `${RAW_API_URL}/api`
);

export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || RAW_API_URL;

// ============== BLOCKCHAIN / EXPLORER ==============

export const CHAIN_ID = parseInt(process.env.REACT_APP_CHAIN_ID || '11155111', 10);

export const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS
  || '0x62a8878de43d5d6fd9B199d92556843a57F39aae';

// Chain ID -> Block explorer base URL
const EXPLORER_MAP = {
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  5: 'https://goerli.etherscan.io',
  137: 'https://polygonscan.com',
  80001: 'https://mumbai.polygonscan.com',
  31337: null // Local Hardhat — explorer yok
};

export const EXPLORER_BASE_URL = EXPLORER_MAP[CHAIN_ID] || null;

export const explorerTxUrl = (txHash) => {
  if (!EXPLORER_BASE_URL || !txHash) return null;
  return `${EXPLORER_BASE_URL}/tx/${txHash}`;
};

export const explorerAddressUrl = (address) => {
  if (!EXPLORER_BASE_URL || !address) return null;
  return `${EXPLORER_BASE_URL}/address/${address}`;
};

export const explorerContractUrl = () => explorerAddressUrl(CONTRACT_ADDRESS);
