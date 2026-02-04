# Blockchain Tabanlı Online Oylama Sistemi - AI Geliştirme Rehberi

## Proje Mimarisi

**3-Tier Architecture**: React Frontend → Node.js/Express Backend → PostgreSQL + Blockchain (Ethereum)

- **Frontend**: [client/](client/) - React 18.x, Chart.js, Axios, çok dilli destek (TR/EN)
- **Backend**: [server.js](server.js) - Express, bcrypt auth, in-memory demo mode
- **Database**: [database/schema.sql](database/schema.sql) - PostgreSQL (users, elections, votes, vote_status)
- **Blockchain**: [smart-contracts/Voting.sol](smart-contracts/Voting.sol) - Solidity akıllı sözleşme (NOT YET DEPLOYED)

## Kritik Proje Bağlamı

### TÜBİTAK 2209-A Araştırma Gereksinimleri

Bu proje bir TÜBİTAK araştırma projesidir. Temel vurgu alanları:

1. **Şeffaflık + Anonimlik İkilemi**: Oylar blockchain'de doğrulanabilir ANCAK seçmen kimliği ile ilişkilendirilemez
2. **Ekran Gizlilik Koruması**: İstemci tarafında screenshot/screen recording prevention
3. **Kriptografik Anonimlik**: ZKP veya Linkable Ring Signatures ile kimlik-oy ayrımı
4. **Doğrulama Kodu (Receipt)**: Her seçmen oyunu bağımsız olarak doğrulayabilmeli
5. **Açık Kaynak + Denetlenebilirlik**: Tüm kod ve akıllı sözleşmeler açık kaynak

### Mevcut Durum vs. Hedef

**YAPILMIŞ ✅**
- Temel kullanıcı kayıt/giriş sistemi
- Rol bazlı yetkilendirme (admin/user)
- Aday ekleme ve oy kullanma arayüzü
- Çift oy engelleme (in-memory)
- Oylama dönemi kontrolü
- Sonuç görselleştirme (bar/pie chart)
- Akıllı sözleşme iskelet yapısı (Voting.sol)

**YAPILMASI GEREKEN ❌**
- Blockchain entegrasyonu (akıllı sözleşme deployment ve Web3 bağlantısı)
- PostgreSQL entegrasyonu (şu an in-memory)
- Anonim oy mekanizması (ZKP/Ring Signatures)
- Oy doğrulama kodu (receipt) sistemi
- Ekran görüntüsü engelleme (frontend)
- Gas optimizasyonu ve Sepolia testnet deployment
- Güvenlik testleri (MythX, Slither)

## Geliştirme İş Akışları

### Yerel Geliştirme

```bash
# Backend başlat (port 5000)
node server.js

# Frontend başlat (port 3000)
cd client && npm start
```

**ÖNEMLİ**: Şu an database/blockchain entegrasyonu YOK - [server.js](server.js) in-memory arrays kullanıyor

### Blockchain Deployment (TODO)

```bash
cd smart-contracts
npx hardhat compile
npx hardhat test
npx hardhat run deploy.js --network sepolia
```

**Gas Optimizasyonu**: [Voting.sol](smart-contracts/Voting.sol#L115) `castVote()` fonksiyonunda storage writes minimize edilmeli

### Veri Akışı

1. **Giriş**: Frontend → POST `/api/login` → bcrypt verify → session ID
2. **Oy Kullanma**: Frontend → POST `/api/vote` → Duplicate check → **[BLOCKCHAIN KAYDI GEREKLİ]** → Database
3. **Sonuç Görüntüleme**: Frontend → GET `/api/votes` → In-memory votes array

## Proje Özgü Kalıplar

### Kimlik Doğrulama
- Session-based (NOT JWT - `sessions` object in [server.js](server.js#L14))
- Header: `x-session-id: <randomId>`
- Roller: `admin` (aday ekler) vs `user` (oy kullanır)

### Çift Oy Engelleme
```javascript
// server.js içinde
if (votes.find(v => v.voter === currentUser.name)) {
  return res.status(403).json({ message: 'Already voted' });
}
```

**Zayıflık**: In-memory - server restart ile sıfırlanıyor. PostgreSQL + blockchain ile sağlamlaştırılmalı.

### Frontend State Yönetimi
- Plain React `useState` (Redux/Context YOK)
- [App.js](client/src/App.js) monolitik yapı (466 satır) - component parçalamayı düşün

## Entegrasyon Noktaları

### Blockchain Servisi (Stub)
[services/blockchainService.js](services/blockchainService.js) şu an simülasyon döndürüyor:
```javascript
// TODO: Web3/Ethers.js entegrasyonu
return { transactionHash: '0x...', simulated: true };
```

**Aksiyonlar**:
1. [config/blockchain.js](config/blockchain.js) içinde Ethers.js provider/contract init
2. `recordVote()` → smart contract `castVote()` çağrısı
3. `verifyVote()` → transaction receipt kontrolü

### Database Servisi (Kullanılmıyor)
[config/database.js](config/database.js) var ANCAK [server.js](server.js) içinde kullanılmıyor.

**Aksiyonlar**:
1. [database/schema.sql](database/schema.sql) çalıştır
2. `server.js` içindeki `users`, `votes`, `candidates` arrays'i DB queries ile değiştir
3. [models/](models/) içindeki Election/User/VoteStatus model'leri kullan

## Güvenlik Notları

### Bilinen Zayıflıklar
- ⚠️ Passwords plaintext olarak değil bcrypt ile hash'leniyor ✅ (güzel!)
- ⚠️ Session management in-memory - production için Redis gerekli
- ⚠️ CORS tüm originlere açık - production'da kısıtla
- ⚠️ Oy gizliliği YOK - voter name oylarla birlikte saklanıyor

### Araştırma Hedefleri için Gerekenler
1. **Ekran Koruması**: React içinde `useEffect` ile screencapture API'lerini disable et
2. **ZKP Entegrasyonu**: zk-SNARKs (snarkjs) veya Ring Signatures kütüphanesi ekle
3. **Receipt Sistemi**: Her oy için kriptografik hash return et, doğrulama endpoint'i ekle

## Test Stratejisi

- **Smart Contract**: Hardhat tests [smart-contracts/](smart-contracts/) içinde
- **Backend**: Jest/Mocha ile API endpoint testleri (YOK - ekle!)
- **Frontend**: React Testing Library (YOK - ekle!)
- **Güvenlik**: MythX/Slither ile akıllı sözleşme audit

## Referanslar

- 📄 Proje proposal: `TÜBİTAK_2209A_OnlineVoting_Proposal.pdf` (projedeki ana hedefler)
- 📚 Smart contract patterns: [Voting.sol](smart-contracts/Voting.sol) içindeki TODOs
- 🔗 Database schema: [database/schema.sql](database/schema.sql)
