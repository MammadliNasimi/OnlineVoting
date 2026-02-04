# 🗳️ Blockchain Online Voting System

TÜBİTAK 2209-A araştırma projesi - Blockchain tabanlı anonim oylama sistemi prototipi.

## 🛠️ Teknolojiler

- **Frontend:** React 18
- **Backend:** Node.js, Express
- **Database:** SQLite
- **Blockchain:** Solidity, Hardhat, Ethers.js

## 🚀 Kurulum

```bash
# Bağımlılıkları yükle
npm install
cd client && npm install && cd ..
cd smart-contracts && npm install && cd ..

# Blockchain başlat (Terminal 1)
cd smart-contracts
npx hardhat node

# Smart contract deploy (Terminal 2)
cd smart-contracts
npx hardhat run scripts/deploy.js --network localhost

# Backend başlat (Terminal 3)
node server.js

# Frontend başlat (Terminal 4)
cd client
npm start
```

## 🔑 Giriş

**Kullanıcı adı:** `admin`  
**Şifre:** `admin123`

## 📖 Kullanım

Veritabanını görüntüle:
```bash
node view-db.js
```

## ⚠️ Not

Bu bir demo/prototiptir. Production kullanımı için ek güvenlik önlemleri gereklidir.

---

**⚠️ DISCLAIMER**: Prototype for research/education. Not production-ready.
