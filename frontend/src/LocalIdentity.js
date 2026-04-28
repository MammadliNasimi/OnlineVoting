import { ethers } from 'ethers';

// ==========================================================================
// Burner Wallet — WebCrypto (AES-GCM + PBKDF2) ile PIN'le şifrelenmiş kasa
// --------------------------------------------------------------------------
// Eski sürüm: localStorage'da plaintext private key tutardı (XSS / fiziksel
// erişim halinde çalınabilirdi). Yeni sürüm:
//   1. İlk kullanımda kullanıcı bir PIN belirler.
//   2. Private key, PIN'den türetilen anahtarla AES-GCM ile şifrelenip
//      localStorage'a yazılır.
//   3. Her oy verme öncesi PIN sorulur, anahtar bellekte (sessionStorage
//      benzeri in-memory cache) tutulur. Sayfa kapanınca kaybolur.
// --------------------------------------------------------------------------
// Ekstra: eski plaintext anahtarlar varsa otomatik migrate eder.
// ==========================================================================

const VAULT_KEY = 'voting_burner_vault_v1';
const LEGACY_KEY = 'voting_burner_wallet';
const PBKDF2_ITERATIONS = 250_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

let cachedWallet = null;
let pinPromptHandler = null;

function ensureCrypto() {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Bu tarayıcı WebCrypto desteklemiyor. Modern bir tarayıcı kullanın.');
  }
  return window.crypto;
}

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64ToBuf(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(pin, salt) {
  const c = ensureCrypto();
  const enc = new TextEncoder();
  const baseKey = await c.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return c.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptWithPin(plaintext, pin) {
  const c = ensureCrypto();
  const salt = c.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = c.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(pin, salt);
  const enc = new TextEncoder();
  const cipher = await c.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  return {
    v: 1,
    salt: bufToB64(salt),
    iv: bufToB64(iv),
    data: bufToB64(cipher)
  };
}

async function decryptWithPin(payload, pin) {
  const c = ensureCrypto();
  const salt = b64ToBuf(payload.salt);
  const iv = b64ToBuf(payload.iv);
  const data = b64ToBuf(payload.data);
  const key = await deriveKey(pin, salt);
  const plain = await c.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return new TextDecoder().decode(plain);
}

function readVault() {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeVault(vault) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

// Eski plaintext anahtar varsa, kullanıcıdan PIN istenip migrate edilebilir.
export function hasLegacyPlaintextWallet() {
  return !!localStorage.getItem(LEGACY_KEY) && !localStorage.getItem(VAULT_KEY);
}

export function hasEncryptedVault() {
  return !!localStorage.getItem(VAULT_KEY);
}

// PIN soracak handler'ı app set eder (bir Material UI dialog'u).
export function registerPinPrompt(handler) {
  pinPromptHandler = handler;
}

async function askPinFromUser(reason) {
  if (!pinPromptHandler) {
    throw new Error('PIN prompt handler yüklenmedi. Lütfen sayfayı yenileyin.');
  }
  const pin = await pinPromptHandler(reason);
  if (!pin) throw new Error('PIN iptal edildi');
  if (typeof pin !== 'string' || pin.length < 4) {
    throw new Error('PIN en az 4 karakter olmalı');
  }
  return pin;
}

// Yeni cüzdan oluşturup PIN ile şifreleyerek kasaya yaz.
async function createVaultWithPin(pin) {
  const wallet = ethers.Wallet.createRandom();
  const payload = await encryptWithPin(wallet.privateKey, pin);
  writeVault({ ...payload, address: wallet.address });
  return wallet;
}

// Kullanıcıdan PIN al ve cüzdanı çöz / yoksa oluştur.
export async function unlockBurnerWallet({ reason } = {}) {
  if (cachedWallet) return cachedWallet;

  // Eski plaintext anahtar varsa, kullanıcıdan PIN isteyip migrate et.
  if (hasLegacyPlaintextWallet()) {
    const legacyKey = localStorage.getItem(LEGACY_KEY);
    const pin = await askPinFromUser(reason || 'Burner cüzdanınızı korumak için yeni bir PIN belirleyin (en az 4 karakter).');
    const payload = await encryptWithPin(legacyKey, pin);
    const w = new ethers.Wallet(legacyKey);
    writeVault({ ...payload, address: w.address });
    localStorage.removeItem(LEGACY_KEY);
    cachedWallet = w;
    return w;
  }

  const vault = readVault();
  if (!vault) {
    // İlk kez giriş — yeni cüzdan + PIN talep et.
    const pin = await askPinFromUser('İlk kullanım için bir PIN belirleyin (en az 4 karakter). Bu PIN cüzdanınızı korur.');
    const w = await createVaultWithPin(pin);
    cachedWallet = w;
    return w;
  }

  const pin = await askPinFromUser(reason || 'Oy vermek için PIN’inizi girin.');
  let plain;
  try {
    plain = await decryptWithPin(vault, pin);
  } catch {
    throw new Error('PIN yanlış. Lütfen tekrar deneyin.');
  }
  const w = new ethers.Wallet(plain);
  cachedWallet = w;
  return w;
}

// Sadece adres döner — PIN sormaz.
export function getBurnerAddress() {
  if (cachedWallet) return cachedWallet.address;
  const vault = readVault();
  if (vault && vault.address) return vault.address;
  if (hasLegacyPlaintextWallet()) {
    try {
      const w = new ethers.Wallet(localStorage.getItem(LEGACY_KEY));
      return w.address;
    } catch {
      return '';
    }
  }
  return '';
}

// Bellekteki cüzdanı temizle (logout / oturum sonu).
export function lockBurnerWallet() {
  cachedWallet = null;
}

// PIN'i değiştir (eski PIN ile aç, yeni PIN ile şifrele).
export async function changeBurnerPin(oldPin, newPin) {
  const vault = readVault();
  if (!vault) throw new Error('Cüzdan bulunamadı');
  const plain = await decryptWithPin(vault, oldPin);
  const payload = await encryptWithPin(plain, newPin);
  writeVault({ ...payload, address: vault.address });
}

// Cüzdanı sıfırla (kayıp PIN durumunda — kullanıcı kabul ederse).
export function resetBurnerWallet() {
  localStorage.removeItem(VAULT_KEY);
  localStorage.removeItem(LEGACY_KEY);
  cachedWallet = null;
}

// ============== EIP-712 İmzalama ==============

export const signVoteClientSide = async (candidateID, electionID) => {
  const wallet = await unlockBurnerWallet({ reason: 'Oy vermek için PIN’inizi girin.' });
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

// Geri uyumluluk: eski API'yi import edenler bozulmasın diye mock döner.
// Yeni kod `getBurnerAddress` / `unlockBurnerWallet` kullanmalı.
export const getBurnerWallet = () => {
  const address = getBurnerAddress();
  if (!address) {
    throw new Error('Cüzdan kasası kilitli. Önce PIN ile kilidi açın.');
  }
  // Bu dönen nesneyi sadece adres okumak için kullanın; özel anahtar dönmez.
  return { address };
};
