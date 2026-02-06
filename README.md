# 🗳️ Blockchain-Based Anonymous Voting System

TÜBİTAK 2209-A araştırma projesi - Blockchain tabanlı anonim ve güvenli oylama sistemi prototipi.

## 📋 Proje Hakkında

Bu sistem, blockchain teknolojisi kullanarak anonim, şeffaf ve güvenli online oylama sağlar. Commitment-based şifreleme ve backend-managed wallet sistemi ile kullanıcı dostu bir deneyim sunar.

### ✨ Temel Özellikler

- ✅ **Anonim Oylama**: Commitment-based şifreleme ile oylar gizli
- ✅ **Blockchain Tabanlı**: Ethereum smart contract ile değiştirilemez kayıt
- ✅ **Session-based Geçici Cüzdanlar**: Her login'de otomatik cüzdan oluşturma
- ✅ **Backend Yönetimi**: MetaMask gerekmez, backend tüm blockchain işlemlerini halleder
- ✅ **Çift Kayıt**: Hem blockchain hem SQLite database
- ✅ **Admin Yetkisi**: Vote authorization için dijital imza
- ✅ **Gerçek Zamanlı**: Live vote tracking ve sonuç görüntüleme

## 🛠️ Teknoloji Stack

### Frontend
- **React 18**: Modern UI framework
- **Axios**: HTTP client
- **Chart.js**: Oy sonuçları görselleştirme

### Backend
- **Node.js + Express**: REST API server
- **bcryptjs**: Şifre hashleme
- **Ethers.js v6**: Blockchain interaction
- **better-sqlite3**: Embedded database
- **crypto**: AES-256-CBC wallet encryption

### Blockchain
- **Solidity**: Smart contract language
- **Hardhat**: Development environment
- **Local Network**: Test amaçlı yerel blockchain

## 🏗️ Mimari

### Geçici Wallet Sistemi
```
┌─────────────┐
│   Login     │
└──────┬──────┘
       │
       ├─► Geçici Cüzdan Oluştur
       ├─► 1 ETH Gönder (funding)
       ├─► Session'a Kaydet (şifreli)
       └─► Session ID Döndür
       
┌─────────────┐
│    Vote     │
└──────┬──────┘
       │
       ├─► Session Wallet Al
       ├─► Commitment Oluştur
       ├─► Admin İmzası Al
       ├─► Blockchain'e Gönder
       └─► DB'ye Kaydet
       
┌─────────────┐
│   Logout    │
└──────┬──────┘
       │
       └─► Session Sil (wallet otomatik temizlenir)
```

### Anonim Oylama Akışı
```
1. User: secret = random()
2. User: commitment = hash(secret + electionId)
3. Backend: signature = adminSign(commitment)
4. Blockchain: vote(electionId, candidateId, commitment, signature)
5. Reveal (opsiyonel): Reveal secret to prove vote
```

## 🚀 Kurulum

### Gereksinimler
- Node.js v16+
- npm v8+

### Adım 1: Bağımlılıkları Yükle
```bash
# Root dependencies
npm install

# Frontend dependencies
cd client
npm install
cd ..

# Smart contract dependencies
cd smart-contracts
npm install
cd ..
```

### Adım 2: Environment Variables
`.env` dosyası oluştur (root directory):
```env
# Admin private key (Hardhat test account #0)
ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Wallet encryption key (değiştir!)
WALLET_ENCRYPTION_KEY=your-32-char-secure-key-here!!!

# Blockchain RPC
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545

# Contract address (deploy sonrası otomatik oluşur)
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3

# Session timeout (ms)
SESSION_TIMEOUT=3600000
```

### Adım 3: Servisleri Başlat

**Terminal 1 - Blockchain:**
```bash
cd smart-contracts
npx hardhat node
```

**Terminal 2 - Contract Deploy:**
```bash
cd smart-contracts
npx hardhat run scripts/deploy.js --network localhost
```

**Terminal 3 - Backend:**
```bash
node server.js
```

**Terminal 4 - Frontend:**
```bash
cd client
npm start
```

### Adım 4: Tarayıcıda Aç
```
http://localhost:3000
```

## 🔑 Test Kullanıcıları

### Admin Hesabı
- **Kullanıcı adı:** `admin`
- **Şifre:** `admin123`
- **Yetki:** Aday ekleme, sonuç görüntüleme

### Normal Kullanıcı (Kayıt Gerekli)
- Kayıt sayfasından yeni hesap oluştur
- Otomatik olarak geçici cüzdan atanır

## 📡 API Endpoints

### Authentication
- `POST /api/register` - Yeni kullanıcı kaydı
- `POST /api/login` - Giriş yap (geçici cüzdan oluştur)
- `POST /api/logout` - Çıkış yap (cüzdanı temizle)

### Voting
- `POST /api/votes` - Oy kullan (blockchain + DB)
- `GET /api/votes` - Oy durumu
- `GET /api/history` - Kişisel oylama geçmişi

### Election Management
- `GET /api/candidates` - Aday listesi
- `POST /api/candidates` - Yeni aday ekle (admin)
- `GET /api/elections` - Seçim detayları
- `GET /api/results/:id` - Sonuçları görüntüle

## 🧪 Test Senaryoları

### 1. Kayıt ve Giriş
```
1. localhost:3000 > Kayıt sayfası
2. Kullanıcı adı: test, Şifre: test123
3. Giriş yap
4. Backend console'da: "🔑 Temporary wallet created for test: 0x..."
5. Backend console'da: "💰 Funded temp wallet with 1 ETH"
```

### 2. Oy Kullanma
```
1. Giriş yap
2. Aday seç (örn: Ali Yılmaz)
3. "Oy Ver" butonuna tıkla
4. Backend console: "📤 Sending vote to blockchain..."
5. Başarı mesajı ve transaction hash görüntüle
```

### 3. Çıkış ve Temizlik
```
1. "Çıkış Yap" butonuna tıkla
2. Backend console: "🚪 Session deleted: {sessionId}"
3. Session ve geçici cüzdan temizlendi
4. Tekrar giriş yap > Yeni cüzdan oluşturulur
```

## 🐛 Bilinen Sorunlar ve İyileştirmeler

### 🔴 Kritik Sorunlar (Production Öncesi Düzelt)

1. **Güvenlik: Zayıf Session ID**
   - Problem: `Math.random()` kriptografik güvenli değil
   - Çözüm: `crypto.randomBytes(32).toString('hex')` kullan

2. **Güvenlik: Default Encryption Key**
   - Problem: .env yoksa default key kullanılıyor
   - Çözüm: Default key varsa uygulama başlamasın

3. **Wallet Funding Hatası Gizli**
   - Problem: Funding başarısız olsa da login başarılı
   - Çözüm: Funding error'da login'i reddet

4. **Memory Leak: Expired Session Temizleme**
   - Problem: Eski session'lar database'de kalıyor
   - Çözüm: Cron job ile temizlik

5. **Race Condition: Session Oluşturma**
   - Problem: Session ve wallet iki ayrı query
   - Çözüm: Transaction kullan

### 🟡 Önemli İyileştirmeler

6. **Secret Kaybı**: Vote response'da secret yok (reveal için gerekli)
7. **Hardcoded Private Key**: Test key production'da değiştirilmeli
8. **Login Performance**: Blockchain transaction login'i yavaşlatıyor
9. **Blockchain Connection Test**: Startup'ta kontrol eksik
10. **Database Index**: user_id ve expires_at için index ekle

### 🟢 Küçük İyileştirmeler

11. **Rate Limiting**: Login/vote endpoint koruması
12. **Logging**: Winston/Morgan ile audit log
13. **Error Handling**: Kullanıcı dostu error mesajları
14. **Input Validation**: Tüm endpoint'lerde validation
15. **CORS Configuration**: Production için sıkılaştır

## 📖 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'user',
  student_id TEXT,
  wallet_address TEXT,              -- Deprecated (artık kullanılmıyor)
  wallet_private_key_encrypted TEXT, -- Deprecated
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Sessions Table (Geçici Cüzdanlar)
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  temp_wallet_address TEXT,              -- Login'de oluşturulur
  temp_wallet_private_key_encrypted TEXT, -- AES-256-CBC şifreli
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Votes Table
```sql
CREATE TABLE votes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  election_id INTEGER,
  candidate_id INTEGER,
  commitment TEXT,
  transaction_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔐 Güvenlik Özellikleri

1. **Şifre Hashleme**: bcrypt ile salt'lı hashing
2. **Private Key Encryption**: AES-256-CBC ile şifreleme
3. **Session Expiry**: 1 saat timeout (configurable)
4. **Commitment Scheme**: Oy gizliliği için kriptografik commitment
5. **Admin Signature**: Vote authorization için ECDSA imza
6. **Geçici Cüzdanlar**: Logout'ta otomatik temizleme

## 🛠️ Geliştirme Araçları

### Database Görüntüle
```bash
node view-db.js
```

### Hardhat Console
```bash
cd smart-contracts
npx hardhat console --network localhost
```

### Contract Test
```bash
cd smart-contracts
npx hardhat test
```

### Database Temizle
```bash
# Dikkat: Tüm verileri siler!
rm database.db
node server.js  # Yeni DB otomatik oluşur
```

## 📦 Proje Yapısı

```
OnlineVoting/
├── client/                    # React frontend
│   ├── src/
│   │   ├── App.js            # Ana component
│   │   ├── index.js          # Entry point
│   │   └── utils/
│   │       └── crypto.js     # Crypto utilities
│   └── package.json
├── smart-contracts/          # Solidity contracts
│   ├── contracts/
│   │   └── VotingAnonymous.sol
│   ├── scripts/
│   │   └── deploy.js
│   └── hardhat.config.js
├── config/
│   └── database-sqlite.js    # Database service
├── models/                   # Data models
│   ├── Election.js
│   ├── User.js
│   └── VoteStatus.js
├── services/
│   ├── authService.js        # Vote authorization
│   └── blockchainService.js  # Blockchain interaction
├── server.js                 # Express API server
├── view-db.js               # Database viewer
└── README.md                # Bu dosya
```

## 🚧 Gelecek Geliştirmeler

- [ ] Vote reveal mechanism
- [ ] Multi-election support
- [ ] Real-time WebSocket updates
- [ ] Mobile responsive design
- [ ] Admin dashboard
- [ ] Export results to PDF
- [ ] Email notifications
- [ ] 2FA authentication
- [ ] Audit log viewer
- [ ] Production deployment guide

## 🤝 Katkıda Bulunma

Bu proje TÜBİTAK 2209-A kapsamında geliştirilmiş bir araştırma prototipidir.

## 📄 Lisans

Bu proje eğitim ve araştırma amaçlıdır.

## ⚠️ Önemli Notlar

1. **Test Amaçlı**: Bu sistem sadece local development içindir
2. **Güvenlik**: Production kullanımı için ek önlemler gereklidir
3. **Hardhat Test Network**: Gerçek blockchain değil, simulate edilmiş network
4. **Private Keys**: .env dosyasını asla commit etmeyin
5. **Database**: SQLite production için uygun değil (PostgreSQL önerilir)

---

**⚠️ DISCLAIMER**: This is a prototype for research and educational purposes only. Not production-ready. Do not use with real, sensitive data or in production environments.
