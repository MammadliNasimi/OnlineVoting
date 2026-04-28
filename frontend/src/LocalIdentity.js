import { ethers } from 'ethers';

// PIN sistemi kaldırıldı: burner cüzdan doğrudan localStorage'da tutulur.
const LEGACY_KEY = 'voting_burner_wallet';

let cachedWallet = null;
function getOrCreateWallet() {
  if (cachedWallet) return cachedWallet;
  const storedPrivateKey = localStorage.getItem(LEGACY_KEY);
  if (storedPrivateKey) {
    cachedWallet = new ethers.Wallet(storedPrivateKey);
    return cachedWallet;
  }

  const wallet = ethers.Wallet.createRandom();
  localStorage.setItem(LEGACY_KEY, wallet.privateKey);
  cachedWallet = wallet;
  return wallet;
}

export function getBurnerAddress() {
  try {
    return getOrCreateWallet().address;
  } catch {
    return '';
  }
}

// Bellekteki cüzdanı temizle (logout / oturum sonu).
export function lockBurnerWallet() {
  cachedWallet = null;
}

export function resetBurnerWallet() {
  localStorage.removeItem(LEGACY_KEY);
  cachedWallet = null;
}

// ============== EIP-712 İmzalama ==============

export const signVoteClientSide = async (candidateID, electionID) => {
  const wallet = getOrCreateWallet();
  const timestamp = Math.floor(Date.now() / 1000);

  const domain = {
    name: 'VotingSSI',
    version: '1.0',
    chainId: parseInt(process.env.REACT_APP_CHAIN_ID || '31337', 10),
    verifyingContract: process.env.REACT_APP_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3'
  };

  const types = {
    Vote: [
      { name: 'candidateID', type: 'uint256' },
      { name: 'electionID', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' }
    ]
  };

  const message = {
    candidateID,
    electionID,
    timestamp
  };

  const signature = await wallet.signTypedData(domain, types, message);

  return {
    burnerAddress: wallet.address,
    burnerSignature: signature,
    timestamp
  };
};

export const getBurnerWallet = () => {
  return getOrCreateWallet();
};
