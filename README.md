<div align="center">
  <h1>🗳️ OnlineVoting</h1>
  <p><strong>DAO & Web3 topluluklarına yönelik, anonimlik-korumalı blockchain oylama sistemi</strong></p>
  <p><em>Yerel demo için Credential-Issuer + Nullifier-Based Anonymity + EIP-712</em></p>
  <p>TÜBİTAK 2209-A Araştırma Projesi kapsamında geliştirilmiştir.</p>

  [![Node](https://img.shields.io/badge/Node.js-22+-43853d?style=flat-square&logo=nodedotjs)](https://nodejs.org/)
  [![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://react.dev/)
  [![Solidity](https://img.shields.io/badge/Solidity-0.8.x-363636?style=flat-square&logo=solidity)](https://soliditylang.org/)
  [![Ethers](https://img.shields.io/badge/Ethers-v6-2535A0?style=flat-square)](https://docs.ethers.org/)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
</div>

---

## 📖 Genel Bakış

**OnlineVoting**, DAO'lar ve Web3 topluluklarının iç yönetişim ve gözetim seçimlerine yönelik bir blockchain oylama sistemidir. Bu depo şu anda **yerel çalışma ve akademik demo** odaklıdır; üretim yayınından çok tekrar üretilebilirlik ve teknik doğrulama hedeflenir.

### Anahtar Avantajlar:
- **Anonimlik (Nullifier-Based)**: Seçmen kimliği blockchain'e yazılmaz; `nullifier = hash(email + electionID)` ile çift oy engellenir.
- **Denetlenebilirlik**: Tüm oylar blockchain'de kalıcı olarak kaydedilir; dış gözlemciler `txHash` ile doğrulama yapabilir.
- **Gasless**: Seçmenler ETH ödemez; Relayer Service tüm işlem ücretlerini üstlenir.
- **Cüzdan Bağımsız**: Dış cüzdan eklentisine ihtiyaç yok; tarayıcıda otomatik burner wallet oluşturulur.
- **DAO-Optimized**: Merkezi olmayan yönetişim modelleri için başlatan yetkisi multi-sig/DAO'ya uyarlanabilir.

**Not**: Bu demo ZKP'yi gerçek derleme hattı yerine local mock proof ile yürütür. Amaç, oy akışını ve nullifier mantığını bağımsız olarak göstermek ve test etmektir.

---

## ✨ Öne Çıkan Özellikler

### 🔑 Burner Wallet & Local Identity
Seçmen sisteme dahil olduğunda tarayıcıda (LocalStorage) tek kullanımlık bir **Burner Wallet** otomatik üretilir. İmza işlemleri tamamen istemci tarafında gerçekleşir; sunucu hiçbir zaman kullanıcının özel anahtarına erişemez.

### 🔏 EIP-712 Çift İmza (Dual Signature)
Akıllı sözleşme her oy için iki imza talep eder:
1. **Issuer Signature** — Üniversite/Kurum, seçmenin oy hakkı olduğunu onaylar.
2. **Burner Signature** — Geçici cüzdan, seçim tercihini onaylar.

Bu sayede tek bir merkezi yöneticinin sahte oy üretmesi kriptografik olarak imkânsızdır.

### 🎭 Nullifier ile Anonimlik
Blockchain'e e-posta veya kişisel veri gönderilmez; bunun yerine kriptografik bir **nullifier hash** kullanılır. Çift oy engellenirken seçmen kimliği gizli kalır.

### ⚡ Asenkron Vote Queue + WebSocket
Oy yazımı `p-queue` ile sıralanır ve arka planda işlenir. Kullanıcı her aşamada (Hazırlanıyor → İmzalanıyor → Blockchain'e Yazıldı) **Socket.io** üzerinden gerçek zamanlı bildirim alır.

### 🛡️ Gasless İşlem Akışı
Seçmen ETH ödemez. **Relayer Service** tüm işlem ücretlerini üstlenir; oy verme deneyimi tamamen kripto-bağımsızdır.

### 🛠️ Yönetici Paneli
- Seçim oluşturma & başlatma/durdurma (pause/resume)
- Aday yönetimi
- E-posta domain whitelist (örn. yalnızca `ogr.akdeniz.edu.tr`)
- Canlı oy durumu, kuyruk takibi ve sistem logları

### 🔁 Seçim Yaşam Döngüsü
- **Durdur** işlemi seçim verisini silmez, yalnızca uygulama tarafında (`is_active=0`) pasife alır.
- **Yeniden Başlat** işlemi, aktif olmayan seçimi tekrar açar.
- Demo akışı local Hardhat üzerinde çalışacak şekilde korunmuştur.

---

## 🏗️ Mimari

```
┌─────────────────────┐     HTTP / WSS      ┌─────────────────────┐     RPC      ┌────────────────────┐
│   React (local)     │ ──────────────────► │   Node.js backend   │ ───────────► │  Hardhat local     │
│                     │                     │                     │              │                    │
│ • Burner Wallet     │                     │ • Auth + JWT        │              │ • VotingSSI.sol    │
│ • EIP-712 İmza      │                     │ • Issuer Service    │              │ • Nullifier check  │
│ • Real-time UI      │                     │ • Relayer Service   │              │                    │
│                     │                     │ • SQLite + WebSocket│              │                    │
└─────────────────────┘                     └─────────────────────┘              └────────────────────┘
```

| Bileşen | Teknoloji | Görev |
|---------|-----------|-------|
| **Frontend** | React 18, Material UI, Axios, Socket.io-client | Arayüz, Burner Wallet yönetimi, EIP-712 imzalama |
| **Backend** | Node.js, Express, Socket.io, JWT | Auth, Credential Issuer, Relayer, Vote Queue |
| **Database** | SQLite (better-sqlite3) | Kullanıcı/seçim/oy meta verileri |
| **Blockchain** | Solidity 0.8, Hardhat, Ethers v6 | EIP-712 destekli oylama sözleşmesi |
| **Hosting** | Local demo | Yerel geliştirme ve akademik sunum |

---

## 🚀 Yerel Geliştirme

### Gereksinimler
- Node.js 22+
- Git
- (Opsiyonel) Hardhat lokal node

### Kurulum

```bash
git clone https://github.com/MammadliNasimi/OnlineVoting.git
cd OnlineVoting

# Backend bağımlılıkları
cd backend && npm install && cd ..

# Frontend bağımlılıkları
cd frontend && npm install && cd ..

# Blockchain (sözleşme derleme)
cd blockchain && npm install && cd ..
```

### Ortam Değişkenleri

Proje kökünde `.env` dosyası oluştur (`backend/.env.example` referans alınabilir):

```env
# Blockchain
ADMIN_PRIVATE_KEY=0x...
RELAYER_PRIVATE_KEY=0x...
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
VOTING_CONTRACT_ADDRESS=

# Backend
PORT=5000
NODE_ENV=development
JWT_SECRET=$(openssl rand -hex 48)
SESSION_SECRET=$(openssl rand -hex 48)
WALLET_ENCRYPTION_KEY=$(openssl rand -hex 16)

# CORS
CORS_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# SMTP (Gmail App Password önerilir)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_char_app_password
SMTP_FROM=SSI Voting <your_email@gmail.com>
```

Frontend için `frontend/.env.local`:

```env
REACT_APP_API_URL=http://localhost:5000
```

### Çalıştırma

3 ayrı terminal aç:

```bash
# Terminal 1 — Hardhat node
cd blockchain && npx hardhat node

# Terminal 2 — Sözleşmeyi deploy et + Backend başlat
cd blockchain && npx hardhat run scripts/deploy-ssi.js --network localhost
# (Çıktıdaki VOTING_CONTRACT_ADDRESS değerini .env'e koy)
cd ../backend && npm run dev

# Terminal 3 — Frontend
cd frontend && npm start
```

Tarayıcıda `http://localhost:3000` aç. Varsayılan admin: **`admin` / `admin123`**.

---

## 🌍 Demo Kapsamı

Bu depo için hedef kurulum local demo'dur. Üretim deploy, testnet faucet ve public hosting adımları bu sürümde kapsam dışıdır.

---

## 🔐 Güvenlik Notları

- `.env` dosyası **asla** git'e commit edilmez (`.gitignore` ile korunur).
- Production'da `JWT_SECRET`, `SESSION_SECRET`, `WALLET_ENCRYPTION_KEY` mutlaka yeniden üretilir (`openssl rand -hex 48`).
- SMTP için **App Password** kullanılır; normal e-posta şifresi modern auth politikalarıyla çalışmaz.
- Cookie ayarları cross-origin için `sameSite=none; secure=true` olarak yapılandırılmıştır.
- Backend tüm env değerlerini `trim` ederek paste-induced `\n` karakterlerinden korunur.

---

## 📂 Proje Yapısı

```
OnlineVoting/
├── backend/                    # Node.js + Express API
│   ├── server.js               # Bootstrap + middleware + route mount
│   └── src/
│       ├── config/             # DB, schema, app state
│       ├── controllers/        # HTTP request handlers
│       ├── services/           # auth, vote, credential issuer, relayer, queue, email
│       ├── routes/             # Express routers
│       ├── middlewares/        # JWT auth, error handler
│       └── utils/              # helpers, logger, vote helpers, wallet utils
├── frontend/                   # React 18 + Material UI
│   └── src/
│       ├── pages/              # Login
│       ├── components/         # SimpleVoting, AdminDashboard, modals, hooks
│       ├── config.js           # API/Socket URL config
│       └── LocalIdentity.js    # Burner wallet + EIP-712 signer
├── blockchain/                 # Hardhat + Solidity
│   ├── contracts/VotingSSI.sol
│   └── scripts/deploy-ssi.js
└── backend/zkp/                # Local mock proof helpers
```

---

## 🧪 API Özeti

| Method | Endpoint | Erişim | Açıklama |
|--------|----------|--------|----------|
| POST | `/api/login` | Public | Kullanıcı adı + şifre |
| POST | `/api/register/send-otp` | Public | OTP e-posta |
| POST | `/api/register` | Public | Yeni hesap |
| POST | `/api/forgot-password` | Public | Şifre sıfırlama OTP'si |
| POST | `/api/reset-password` | Public | OTP ile yeni şifre |
| POST | `/api/face/login`, `/api/face/register` | Public/Auth | Yüz tanıma |
| GET | `/api/me` | Auth | Aktif kullanıcı + session |
| POST | `/api/logout` | Auth | Oturum sonlandır |
| GET | `/api/elections` | Auth | Aktif seçimler (domain filtresi) |
| GET | `/api/candidates/:electionId` | Auth | Seçimin adayları |
| POST | `/api/vote/simple` | Auth | EIP-712 imzalı oy gönder |
| GET | `/api/voting-history` | Auth | Kullanıcının oy geçmişi |
| `*` | `/api/admin/*` | Admin | İstatistik, kullanıcı, seçim, queue, log |
| `*` | `/api/elections/:id/*` | Admin | Aktivasyon, aday, domain |
| GET | `/api/health` | Public | Servis sağlık kontrolü |

---

## 📜 Lisans & Atıf

Bu proje **TÜBİTAK 2209-A Üniversite Öğrencileri Araştırma Projeleri Destekleme Programı** kapsamında, blockchain'in seçim gizliliği ve bütünlüğü problemlerine uygulanabilirliğini doğrulamak amacıyla geliştirilmiştir.

Akademik ve eğitim amaçlı kullanım için MIT lisansı ile açık kaynak olarak yayımlanmıştır.

---

<div align="center">
  <sub>Made with 🗳️ for transparent democracy.</sub>
</div>
