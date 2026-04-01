<div align="center">
  <h1>🗳️ SSI Voting - Blockchain Tabanlı Anonim Oylama Sistemi</h1>
  <p><strong>TÜBİTAK 2209-A Araştırma Projesi Kapsamında Geliştirilmiş, Self-Sovereign Identity (SSI) Destekli Yeni Nesil Oylama Altyapısı</strong></p>

  [![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
  [![React](https://img.shields.io/badge/React-18.x-blue.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
  [![Solidity](https://img.shields.io/badge/Solidity-0.8.x-black.svg?style=for-the-badge&logo=solidity)](https://soliditylang.org/)
  [![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-blueviolet.svg?style=for-the-badge)](https://docs.ethers.io/)
  [![SQLite](https://img.shields.io/badge/SQLite-3-003B57.svg?style=for-the-badge&logo=sqlite)](https://sqlite.org/)
  [![Socket.io](https://img.shields.io/badge/Socket.io-4.x-black.svg?style=for-the-badge&logo=socket.io)](https://socket.io/)

</div>

---

## 📖 Proje Hakkında

Geleneksel ve mevcut elektronik oylama sistemlerinin şeffaflık ve manipülasyon sorunlarına karşın tasarlanan bu proje, **Ethereum Akıllı Sözleşmeleri** ve **Self-Sovereign Identity (SSI)** altyapısını kullanarak geliştirilmiştir.

Sistem, seçmenlerin kimliğini tamamen gizli tutarken (anonimlik), kullanılan her oyun sadece bir kez kullanıldığı (çift oy engeli) ve değiştirilemeyeceği (değişmezlik) prensipleriyle çalışır. Harici bir **MetaMask veya Kripto Cüzdanına ihtiyaç duymadan**, Web2 rahatlığında Web3 güvenliği sağlar.

---

## 🌟 Öne Çıkan Özellikler & Güncel Mimari (Features Deep-Dive)

### 1. 🔑 Gerçek SSI & Burner Wallet Mimarisi (Local Identity)
- **Nasıl Çalışır?** Kullanıcılar (seçmenler) sisteme dahil olduklarında eklenti kurmalarına gerek yoktur. Kullanıcının tarayıcısında (Local Storage) tek kullanımlık, güvenli ve kriptografik bir **Burner Wallet** (Geçici Kimlik Cüzdanı) otomatik üretilir.
- **Faydası:** Merkezi arka plan (Backend) asla kullanıcının kimlik veya cüzdan anahtarlarına erişemez. İmza işlemleri (Oylama) %100 oranında istemci tarafında (Client-side) gerçekleşir, bu da sistemi "Trustless" (Güvene İhtiyaç Duymayan) hale getirir.

### 2. 🔏 EIP-712 Çift İmza (Dual Signature) Standardı
- **Nasıl Çalışır?** Blockchain üzerindeki Akıllı Sözleşme (`VotingSSI.sol`) her bir oyu işleme alırken iki farklı imza talep eder:
  1. **Issuer Signature (Kimlik Sağlayıcı/Üniversite):** Öğrencinin (Burner cüzdan) gerçekten okula kayıtlı olduğunu ve oy kullanmaya hakkı olduğunu onaylayan yetkili imzası.
  2. **Burner Signature (Seçmen):** Yetki verilmiş geçici cüzdanın oy tercihi doğrultusunda kendi attığı gerçek ve manipüle edilemez seçmen imzası.
- **Faydası:** Yalnıza tek bir yöneticinin (Backend) manipülasyonla sahte oylar üretmesinin (Centralized Proxy) önüne geçilerek tam anlamıyla merkeziyetsizlik (Decentralization) başarılmıştır.

### 3. 🎭 Gizlilik ve Nullifier Mekanizması
- Kullanıcı oy kullandığında e-posta veya kişisel kimlik verisi blockchain'e yollanmaz. Özel olarak oluşturulan `Nullifier` (Kimlik özeti) ile çift oyun engeli sağlanırken anonimlik korunur. İşlemler `Relayer` (Aktarıcı) üzerinden ağ ücreti ödenmeden (Gasless) gerçekleştirilir.

### 4. ⚡ Asenkron Queue (Kuyruk) ve WebSockets
- **Nasıl Çalışır?** Oyların blockchain'e yazılma süreci `p-queue` aracılığıyla sıraya alınır (Job Queue) ve arka planda ağ tıkanmalarını engelleyerek Node.js sunucusunu kitlemez. İşlemin her adımı (Hazırlanıyor -> Onaya Gönderiliyor -> Blockchain'e Yazıldı) kullanıcının arayüzüne **Socket.io** üzerinden gerçek zamanlı (Real-time) olarak iletilir.

### 5. 🛠 Yönetim ve Admin Dashboard Paneli
- Gelişmiş panel sayesinde veritabanı (SQLite) ile Akıllı sözleşme senkronize çalışır. Modal arayüzleri ile canlı ve anlık olarak:
  * **Seçim Oluşturma:** Yeni seçim (Election) ekleyebilme.
  * **Aday Yönetimi:** Seçimlere özel yeni dinamik aday (Candidate) atama imkanı.
  * **Monitör:** Sistemdeki toplam oy ve kullanıcı verilerini canlı izleme.

---

## 💻 Teknoloji Yığıtı (Tech Stack)

| Bileşen | Kullanılan Teknoloji | Görevi / Rolü |
|---------|----------------------|---------------|
| **Frontend** | React 18, Material UI, Axios | Arayüz, Burner Wallet yönetimi, EIP-712 Şifreleme |
| **Backend** | Node.js, Express.js | API, SSI Issuer, Relayer Servisi ve JWT oturum |
| **Veritabanı** | SQLite (better-sqlite3) | Hızlı ve güvenli ilişkisel/gerçek zamanlı veri depolama |
| **Blockchain** | Solidity, Hardhat, Ethers.js v6 | EIP-712 destekli oyların tutulduğu akıllı sözleşme |
| **Senkronizasyon** | Socket.io, p-queue | Arka plan kuyruk yönetimi (Background Jobs) |

---

## 🚀 Yerel Ortamda Kurulum ve Çalıştırma

Projeyi bilgisayarınızda çalıştırmak oldukça basittir. Node.js (v18+) ve `git` yüklü olduğundan emin olun.

### 1. Repoyu Klonlayın ve Bağımlılıkları Yükleyin

```bash
git clone https://github.com/MammadliNasimi/OnlineVoting.git
cd OnlineVoting

# Ana dizin bağımlılıkları (Backend)
npm install

# İstemci (Frontend) bağımlılıkları
cd client
npm install
cd ..

# Blockchain (Smart Contract) bağımlılıkları
cd smart-contracts
npm install
cd ..
```

### 2. Ortam Değişkenleri (Environment Config)

Ana dizinde `.env` isimli bir dosya oluşturun veya güncelleyin:

```env
# Admin/Deployer Private Key (Hardhat Test Account #0)
ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
PORT=5000

# Akıllı sözleşmeler derlenip dağıtıldıktan sonra buraya o adresi ekleyin
VOTING_CONTRACT_ADDRESS="0x..."
```

### 3. Sistemi Başlatma Süreci

Uygulamanın farklı katmanlarını başlatmak için 3 ayrı terminal penceresi açmalısınız:

**Terminal 1 (Blockchain Node Çalıştırma):**
```bash
cd smart-contracts
npx hardhat node
```

**Terminal 2 (Sözleşme Dağıtma ve Backend Başlatma):**
*(Gerekli adres Deploy script'inden alındıktan sonra mutlaka .env dosyasındaki VOTING_CONTRACT_ADDRESS güncellenmelidir).*

```bash
cd smart-contracts
npx hardhat run scripts/deploy-ssi.js --network localhost
cd ..
node server.js
```

**Terminal 3 (Frontend İstemcisi):**
```bash
cd client
npm start
```
*Frontend adresi:* `http://localhost:3000`

---

## 👨‍💻 Notlar ve Geliştirici Bilgileri
Bu proje aktif bir prototiptir ve akademik araştırma bağlamında, blockchain'in seçim gizliliği sistemlerine uygulanabilirliğini doğrulamak amacıyla kodlanmıştır. `Nullifier`, `Burner Wallet` ve `EIP-712 Dual Signature` entegrasyonlarıyla ZK-SSI hedeflerine başarılı bir şekilde ulaşmıştır.

---
> *TÜBİTAK 2209-A projesi kapsamında üretilmiş ve açık kaynak geliştirilmiştir.*
</div>