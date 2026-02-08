# 🗳️ Blockchain-Based Anonymous Voting System

TÜBİTAK 2209-A araştırma projesi - Blockchain tabanlı anonim ve güvenli oylama sistemi prototipi.

## 📋 Proje Hakkında

Bu sistem, blockchain teknolojisi kullanarak anonim, şeffaf ve güvenli online oylama sağlar. Commitment-based şifreleme ve backend-managed wallet sistemi ile kullanıcı dostu bir deneyim sunar.

### ✨ Şu An Mevcut Özellikler

#### Kullanıcı Özellikleri
- ✅ **Kayıt ve Giriş Sistemi**: Güvenli kullanıcı kimlik doğrulama
- ✅ **Geçici Cüzdan Yönetimi**: Her giriş'te otomatik cüzdan oluşturma, çıkış'ta silme
- ✅ **Anonim Oy Kullanma**: Commitment-based şifreleme ile kimlik gizliliği
- ✅ **Oy Geçmişi Görüntüleme**: Kullanıcının tüm oylarını detaylı görebilme
- ✅ **Gerçek Zamanlı Sonuçlar**: Canlı oy sayımı ve grafik gösterimi
- ✅ **Transaction İzleme**: Her oy için blockchain transaction hash

#### Teknik Özellikler
- ✅ **Blockchain Tabanlı**: Ethereum smart contract ile değiştirilemez kayıt
- ✅ **Backend-Managed Wallets**: MetaMask gerekmez, sistem otomatik yönetir
- ✅ **Çift Kayıt Sistemi**: Hem blockchain hem SQLite database
- ✅ **Admin İmza Doğrulama**: Vote authorization için ECDSA dijital imza
- ✅ **Şifreli Cüzdan Saklama**: AES-256-CBC ile private key şifreleme
- ✅ **Otomatik Cüzdan Fonlama**: Login'de 1 ETH otomatik transfer

## 🛠️ Teknoloji Stack

### Frontend
- **React 18**: Basit ve sade UI
- **Axios**: API iletişimi
- **Chart.js**: Sonuç grafikleri

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

#### 🚀 Hızlı Başlatma (Önerilen)

**Windows PowerShell:**
```powershell
# 1. Hardhat Blockchain (Terminal 1)
cd smart-contracts
npx hardhat node
# Çıktı: "Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/"
# Bu terminal açık kalsın!

# 2. Smart Contract Deploy (Terminal 2 - tek seferlik)
cd smart-contracts
npx hardhat run scripts/deploy.js --network localhost
# Çıktı: "VotingAnonymous deployed to: 0x5FbDB..."
# Contract adresi .env dosyasına otomatik yazılır

# 3. Backend Server (Terminal 3)
node server.js
# Çıktı: "🚀 Server running on http://localhost:5000"
# "📡 Connected to blockchain at http://127.0.0.1:8545"
# Bu terminal açık kalsın!

# 4. Frontend React (Terminal 4)
cd client
npm start
# Çıktı: "webpack compiled successfully"
# Tarayıcı otomatik açılır: http://localhost:3000
```

**Alternatif - Tek Terminal (Background Processes):**
```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd smart-contracts; npx hardhat node"
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd client; npm start"
```

#### ✅ Servislerin Çalıştığını Kontrol Et
```powershell
netstat -an | findstr "3000 5000 8545" | findstr "LISTENING"
```
**Beklenen Çıktı:**
```
TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING  # Frontend
TCP    0.0.0.0:5000           0.0.0.0:0              LISTENING  # Backend
TCP    0.0.0.0:8545           0.0.0.0:0              LISTENING  # Blockchain
```

### Adım 4: Tarayıcıda Aç ve Test Et

1. **Tarayıcınızda aç:** http://localhost:3000
2. **Yeni kullanıcı oluştur:** Kayıt sayfasından kullanıcı adı ve şifre gir
3. **Giriş yap:** Backend console'da geçici cüzdan oluşturulduğunu göreceksin
4. **Oy kullan:** Bir aday seç ve oy ver
5. **Geçmişi gör:** "Oylama Geçmişi" sekmesinden oylarını kontrol et
6. **Çıkış yap:** Geçici cüzdan otomatik silinir

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
- `GET /api/voting-history` - Kişisel oylama geçmişi (seçim, aday, tarih, tx hash)

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

## 🚧 Eklenecek Özellikler ve İyileştirmeler

### 🔴 Yüksek Öncelik
- [ ] **Vote Reveal Mechanism**: Secret ile oy doğrulama sistemi
- [ ] **Multi-Election Support**: Aynı anda birden fazla seçim
- [ ] **Rate Limiting**: Login ve vote endpoint'leri için DDoS koruması
- [ ] **Session Cleanup Job**: Expired session'ları otomatik temizle
- [ ] **Blockchain Connection Check**: Startup'ta RPC bağlantı testi
- [ ] **Wallet Funding Error Handling**: Funding başarısız olursa login reddet

### 🟡 Orta Öncelik
- [ ] **Admin Dashboard**: 
  - Tüm seçimleri yönetme
  - Kullanıcı listesi ve rolleri
  - Sistem istatistikleri (toplam oy, aktif kullanıcı, vb.)
  - Seçim başlatma/durdurma
- [ ] **Real-time WebSocket Updates**: 
  - Canlı oy sayım güncellemesi
  - Yeni oy bildirim sistemi
- [ ] **Email Notifications**: 
  - Seçim başlangıç/bitiş bildirimi
  - Oy kullanım onayı
- [ ] **Export Results**: 
  - PDF rapor oluşturma
  - CSV export
  - Blockchain verification link

### 🟢 Düşük Öncelik
- [ ] **Mobile Responsive Design**: Mobil cihazlar için optimize edilmiş UI
- [ ] **2FA Authentication**: İki faktörlü kimlik doğrulama
- [ ] **Audit Log Viewer**: Tüm sistem aktivitelerini izleme
- [ ] **Dark Mode**: Tema değiştirme özelliği
- [ ] **Multi-language Support**: Türkçe/İngilizce dışında dil desteği
- [ ] **Vote Comments**: Oy kullanırken yorum bırakma (opsiyonel)
- [ ] **Candidate Photos**: Aday fotoğrafı upload sistemi
- [ ] **Voting Analytics**: 
  - Oy kullanım zamanı grafikleri
  - Demografik analiz
  - Trend göstergeleri

### 🔧 Teknik İyileştirmeler
- [ ] **Production Deployment**: 
  - Docker containerization
  - CI/CD pipeline
  - Cloud deployment guide (AWS/Azure/GCP)
- [ ] **Database Migration**: SQLite → PostgreSQL
- [ ] **Logging System**: Winston/Morgan ile detaylı log
- [ ] **Input Validation**: Joi/Yup ile tüm endpoint validation
- [ ] **API Documentation**: Swagger/OpenAPI dokümantasyonu
- [ ] **Unit Tests**: Jest ile backend test coverage
- [ ] **E2E Tests**: Cypress ile frontend test
- [ ] **Performance Optimization**: 
  - Database indexing
  - Query optimization
  - Caching stratejisi (Redis)
- [ ] **Security Hardening**: 
  - Helmet.js integration
  - CORS configuration
  - SQL injection prevention
  - XSS protection

## ⚠️ Önemli Notlar

- **Test Amaçlı**: Local development için prototip sistem
- **Güvenlik**: Production öncesi güvenlik önlemleri alınmalı
- **Hardhat Network**: Simüle edilmiş test blockchain'i
- **Private Keys**: .env dosyasını asla commit etme
- **Database**: SQLite yerine PostgreSQL kullanılmalı

---

**TÜBİTAK 2209-A Araştırma Projesi** - Eğitim ve araştırma amaçlı prototip
