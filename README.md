# 🗳️ SSI Voting — Blockchain Tabanlı Anonim Oylama Sistemi

> **TÜBİTAK 2209-A Araştırma Projesi** — Self-Sovereign Identity (SSI) ve Zero-Knowledge e-posta doğrulama ile blockchain tabanlı anonim oylama sistemi prototipi.

---

## 📋 Proje Hakkında

Bu sistem, Ethereum akıllı sözleşmeleri, EIP-712 tipli veri imzalama ve ZK-Email mekanizması kullanarak **kimlik gizliliğini korurken** şeffaf ve manipüle edilemez bir oylama altyapısı sunar. MetaMask gibi harici bir cüzdan uygulaması **gerektirmez** — tüm blockchain işlemleri backend tarafından yönetilen geçici cüzdanlar aracılığıyla gerçekleştirilir.

---

## ✨ Özellikler

### 👤 Kullanıcı Özellikleri
- ✅ **Kayıt ve Giriş**: Güvenli bcrypt tabanlı kimlik doğrulama
- ✅ **Geçici Cüzdan Yönetimi**: Her giriş'te otomatik cüzdan oluşturma, çıkış'ta silme
- ✅ **SSI Tabanlı Oy**: EIP-712 imzalı credential ile oy kullanma
- ✅ **ZK-Email Doğrulama**: E-posta hash'i nullifier olarak — e-posta asla saklanmaz
- ✅ **Gas-Less Oylama**: Relayer servisi ile kullanıcı gas ödemez
- ✅ **Anonim Oy**: Nullifier mekanizması — kim oy kullandığı blockchain'de görünmez
- ✅ **Çift Oy Engeli**: Blockchain nullifier ile tekrar oy kullanımı imkânsız
- ✅ **Oy Geçmişi**: Kullanıcının blockchain transaction hash'lerini görmesi
- ✅ **Gerçek Zamanlı Sonuçlar**: Canlı oy sayımı ve bar grafikleri

### 🛡️ Admin Panel Özellikleri
- ✅ **Otomatik Giriş**: `localhost:5000/admin/dashboard` — login formu yok, otomatik oturum
- ✅ **Genel Bakış**: Anlık istatistikler (kullanıcı, oy, session, seçim, aday sayısı)
- ✅ **Seçim Yönetimi**: Seçim oluşturma, aktif/pasif etme, silme
- ✅ **Aday Yönetimi**: Seçimlere aday ekleme/silme/güncelleme
- ✅ **Kullanıcı Yönetimi**: Kullanıcı oluşturma, rol değiştirme, şifre güncelleme, silme
- ✅ **Session Yönetimi**: Aktif sessionları görüntüleme, zorla çıkış
- ✅ **Veritabanı Görüntüleyici**: Tüm tabloları (oylar, kullanıcılar, durumlar) canlı izleme
- ✅ **SSI Durum Paneli**: Contract domain bilgisi, relayer durumu ve ETH bakiyesi
- ✅ **Blockchain Paneli**: Hardhat node durumu, son blok, contract adresleri
- ✅ **ZK-Email Domain Yönetimi**: İzinli e-posta domainleri ekleme/silme
- ✅ **Otomatik Yenileme**: 3 saniyede bir tüm verileri canlı güncelleme

### ⚙️ Teknik Özellikler
- ✅ **EIP-712 Typed Data**: İmzalı credential sistemi
- ✅ **Nullifier Mekanizması**: `keccak256(idHash + electionId)` — çift oy engeli
- ✅ **Backend-Managed Wallets**: MetaMask gerekmez
- ✅ **AES-256-CBC**: Private key şifreleme
- ✅ **Gas-Less Relayer**: Kullanıcı adına relayer imzalar ve gönderir
- ✅ **Domain Kısıtlaması**: Her seçim belirli e-posta domainlerine kısıtlanabilir
- ✅ **SQLite Embedded DB**: Sıfır konfigürasyon ile çalışan yerel veritabanı
- ✅ **8 Saatlik Session**: Oturum zaman aşımı 8 saat

---

## 🛠️ Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | React 18, Axios, Chart.js |
| **Admin Panel** | Vanilla HTML/CSS/JS (standalone, `public/admin.html`) |
| **Backend** | Node.js, Express.js |
| **Blockchain** | Ethers.js v6, Hardhat, Solidity 0.8 |
| **Veritabanı** | SQLite (better-sqlite3) |
| **Güvenlik** | bcryptjs, AES-256-CBC, EIP-712, keccak256 |
| **Test Ağı** | Hardhat Local Network (Chain ID: 31337) |

---

## 🏗️ Mimari

### SSI Oylama Akışı

```
Kullanıcı                   Backend                    Blockchain
    │                           │                           │
    ├── 1. E-posta gir ─────────►                           │
    │                           ├── OTP gönder (SMTP)       │
    ├── 2. OTP doğrula ─────────►                           │
    │                           ├── idHash = keccak256(email+salt)
    │                           ├── Credential imzala (EIP-712)
    │◄───────── Credential ──────┤                           │
    │                           │                           │
    ├── 3. Oy ver ──────────────►                           │
    │                           ├── nullifier hesapla       │
    │                           ├── Relayer imzala          │
    │                           ├── vote() tx gönder ───────►
    │                           │                           ├── Nullifier kontrol
    │◄───────── TX Hash ─────────┤◄────── Onay ─────────────┤
```

### Geçici Wallet Sistemi

```
Login ──► Temp Wallet Oluştur ──► 1 ETH Fonla ──► Session'a Kaydet (şifreli)
  │
Vote ──► Session Wallet Al ──► İmzala ──► Blockchain'e Gönder
  │
Logout ──► Session Sil (wallet otomatik temizlenir)
```

---

## 🚀 Kurulum

### Gereksinimler

- **Node.js** v16+
- **npm** v8+

### 1. Bağımlılıkları Yükle

```bash
npm install
cd client && npm install && cd ..
cd smart-contracts && npm install && cd ..
```

### 2. Environment Variables

`.env` dosyası oluştur (`.env.example`'dan kopyala):

```bash
cp .env.example .env
```

`.env` içeriği:

```env
# Admin Private Key (Hardhat test account #0 — SADECE LOCAL TEST)
ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Blockchain
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337

# Backend
PORT=5000
SESSION_TIMEOUT=28800000

# Güvenlik
SESSION_SECRET=dev_secret_change_in_production_12345
CORS_ORIGINS=http://localhost:3000,http://localhost:5000
```

### 3. Servisleri Başlat

```powershell
# 1. Hardhat blockchain node (arka planda)
cd smart-contracts
Start-Job -ScriptBlock { Set-Location ".\smart-contracts"; npx hardhat node }
Start-Sleep -Seconds 5

# 2. Kontratları deploy et
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/deploy-ssi.js --network localhost
cd ..

# 3. Backend
Start-Job -ScriptBlock { node server.js }
Start-Sleep -Seconds 3

# 4. Frontend
cd client
Start-Job -ScriptBlock { $env:CI="false"; npx react-scripts start }
```

### 4. Çalışıp çalışmadığını kontrol et

```powershell
netstat -ano | findstr "LISTENING" | findstr ":3000 \|:5000 \|:8545 "
```

Beklenen çıktı:
```
TCP    0.0.0.0:3000    LISTENING   # React Frontend
TCP    0.0.0.0:5000    LISTENING   # Express Backend
TCP    127.0.0.1:8545  LISTENING   # Hardhat Node
```

### 5. Tarayıcıda Aç

| URL | Açıklama |
|-----|----------|
| http://localhost:3000 | Kullanıcı arayüzü |
| http://localhost:5000/admin/dashboard | Admin paneli (otomatik giriş) |

---

## 🔑 Varsayılan Hesaplar

| Hesap | Kullanıcı Adı | Şifre |
|-------|--------------|-------|
| Admin | `admin` | `admin123` |
| Kullanıcı | Kayıt sayfasından oluştur | — |

---

## 📡 API Endpoints

### Kimlik Doğrulama
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/register` | Yeni kullanıcı kaydı |
| `POST` | `/api/login` | Giriş yap (geçici cüzdan oluştur) |
| `POST` | `/api/logout` | Çıkış yap (cüzdanı temizle) |

### Oylama
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/votes` | Oy kullan (blockchain + DB) |
| `GET` | `/api/votes` | Oy durumu |
| `GET` | `/api/voting-history` | Kişisel oylama geçmişi |
| `GET` | `/api/results/:id` | Seçim sonuçları |

### Seçim & Adaylar
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET` | `/api/elections` | Tüm seçimler |
| `GET` | `/api/candidates` | Aday listesi |

### ZK-Email
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/zkemail/send-otp` | E-postaya OTP gönder |
| `POST` | `/api/zkemail/verify-otp` | OTP doğrula, credential al |

### SSI
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/ssi/vote` | SSI credential ile oy kullan |
| `GET` | `/api/ssi/domain` | EIP-712 domain bilgisi |
| `GET` | `/api/ssi/relayer/status` | Relayer durumu ve bakiye |

### Admin (x-session-id header gerekli)
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET` | `/api/admin/database` | Tüm DB verisi |
| `POST` | `/api/admin/elections` | Seçim oluştur |
| `PUT` | `/api/admin/elections/:id/toggle` | Aktif/pasif |
| `DELETE` | `/api/admin/elections/:id` | Seçim sil |
| `POST` | `/api/admin/elections/:id/candidates` | Aday ekle |
| `POST` | `/api/admin/users` | Kullanıcı oluştur |
| `PUT` | `/api/admin/users/:id` | Rol/şifre güncelle |
| `DELETE` | `/api/admin/users/:id` | Kullanıcı sil |
| `DELETE` | `/api/admin/sessions/:id` | Session sonlandır |
| `GET` | `/api/admin/email-domains` | İzinli domainler |
| `POST` | `/api/admin/email-domains` | Domain ekle |
| `DELETE` | `/api/admin/email-domains/:id` | Domain sil |

---

## 📂 Proje Yapısı

```
OnlineVoting/
├── client/                         # React frontend (port 3000)
│   ├── src/
│   │   ├── App.js                 # Ana component, login/oy arayüzü
│   │   ├── SSIVoting.js           # SSI + ZK-Email oy bileşeni
│   │   ├── Web3Context.js         # Blockchain context
│   │   └── utils/crypto.js        # Kriptografi yardımcıları
│   └── package.json
│
├── smart-contracts/                # Solidity akıllı sözleşmeleri
│   ├── contracts/
│   │   ├── VotingAnonymous.sol    # Commitment tabanlı anonim oylama
│   │   └── VotingSSI.sol          # EIP-712 + Nullifier tabanlı SSI oylama
│   ├── scripts/
│   │   ├── deploy.js              # VotingAnonymous deploy
│   │   └── deploy-ssi.js          # VotingSSI deploy
│   └── hardhat.config.js
│
├── public/
│   └── admin.html                 # Admin paneli (standalone HTML)
│
├── services/
│   ├── authService.js             # Vote authorization (ECDSA imza)
│   ├── credentialIssuer.js        # SSI credential oluşturma
│   └── relayerService.js          # Gas-less relayer
│
├── config/
│   └── database-sqlite.js         # SQLite bağlantısı ve şema
│
├── utils/
│   └── walletUtils.js             # Cüzdan oluşturma ve şifreleme
│
├── server.js                      # Express API server (port 5000)
├── .env                           # Ortam değişkenleri (commit etme!)
├── .env.example                   # Şablon env dosyası
├── .gitignore
└── README.md
```

---

## 📖 Veritabanı Şeması

```sql
-- Kullanıcılar
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,          -- bcrypt hash
  role TEXT DEFAULT 'user',        -- 'user' | 'admin'
  email TEXT,
  student_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessionlar (geçici cüzdanlar)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,             -- crypto.randomBytes(16) hex
  user_id INTEGER,
  temp_wallet_address TEXT,
  temp_wallet_private_key_encrypted TEXT,  -- AES-256-CBC
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,    -- 8 saat
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Seçimler
CREATE TABLE elections (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 0,
  start_date DATETIME,
  end_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Adaylar
CREATE TABLE candidates (
  id INTEGER PRIMARY KEY,
  election_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  vote_count INTEGER DEFAULT 0,
  FOREIGN KEY (election_id) REFERENCES elections(id)
);

-- Oylar
CREATE TABLE votes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  election_id INTEGER,
  candidate_id INTEGER,
  commitment TEXT,
  transaction_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Oy durumu
CREATE TABLE vote_status (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  election_id INTEGER,
  has_voted INTEGER DEFAULT 0,
  voted_at DATETIME,
  transaction_hash TEXT
);

-- ZK-Email izinli domainler
CREATE TABLE email_domains (
  id INTEGER PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  added_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔐 Güvenlik

| Özellik | Yöntem |
|---------|--------|
| Şifre Hashleme | bcrypt (salt rounds: 10) |
| Private Key Şifreleme | AES-256-CBC |
| Session ID | `crypto.randomBytes` |
| Oy İmzalama | ECDSA (EIP-712) |
| Çift Oy Engeli | Blockchain Nullifier |
| Session Süresi | 8 saat, logout'ta anında silinir |
| E-posta Gizliliği | Sadece `keccak256(email+salt)` saklanır |

> ⚠️ **Önemli:** `.env` dosyasını asla Git'e commit etme. Gerçek bir ortamda `ADMIN_PRIVATE_KEY` ve `SESSION_SECRET` değerlerini değiştir.

---

## 🧪 Test

```bash
# Smart contract testleri
cd smart-contracts
npx hardhat test

# Backend API testi (manuel)
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"name":"admin","password":"admin123"}'
```

---

## 🐛 Bilinen Sınırlamalar (Prototip)

- Hardhat local network yeniden başlatıldığında kontrat adresleri değişir, `.env` güncellenir
- SQLite production için önerilmez (PostgreSQL ile değiştirilebilir)
- SMTP e-posta gönderimi gerçek bir SMTP sunucu konfigürasyonu gerektirir
- Hardhat test ağı gerçek bir Ethereum ağı değildir

---

## 🚧 Gelecek Geliştirmeler

- [ ] ZK-Proof entegrasyonu (Circom/SnarkJS)
- [ ] PostgreSQL migrasyonu
- [ ] Docker Compose ile tek komut başlatma
- [ ] Swagger API dokümantasyonu
- [ ] Mainnet/Testnet deploy rehberi
- [ ] WebSocket ile anlık oy güncellemesi
- [ ] PDF rapor ve CSV export
- [ ] 2FA kimlik doğrulama

---

**TÜBİTAK 2209-A Araştırma Projesi** — Eğitim ve araştırma amaçlı prototip sistemi.


