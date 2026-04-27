# 🚀 Production Deploy Rehberi (Render + Vercel)

Bu rehber projeyi **Render** (backend) + **Vercel** (frontend) + **Sepolia Testnet** (blockchain) üzerinde public'e almak için adım adım talimat içerir.

---

## 📋 Mimari

```
+----------------+         +-----------------+         +--------------------+
|   Vercel       |  HTTPS  |   Render        |  RPC    |  Sepolia Testnet   |
|   (Frontend)   | ──────► |   (Backend +    | ──────► |  (VotingSSI.sol)   |
|   React build  |  WSS    |   Persistent DB)|         |                    |
+----------------+         +-----------------+         +--------------------+
        ▲                          │
        │                          ▼
        │                  +-----------------+
        └──────────────────│  Office365 SMTP │
              OTP e-posta  +-----------------+
```

---

## ✅ Ön Hazırlık Checklist

- [ ] **GitHub'a push'la** — Render ve Vercel git repo'dan deploy ediyor.
- [ ] **`.env` git'te değil**, sadece lokalde olduğunu doğrula (`git check-ignore .env` çalıştır).
- [ ] **Sepolia kontratı deploy edildi** (`VOTING_CONTRACT_ADDRESS` `.env`'de var).
- [ ] **Sepolia cüzdanında ETH var** — relayer gas ödemek için (Sepolia faucet'lardan al, örn. https://www.alchemy.com/faucets/ethereum-sepolia).
- [ ] **Office365 App Password oluştur** — https://account.microsoft.com/security
- [ ] **Yeni production secret üret**:
  ```bash
  # JWT_SECRET / SESSION_SECRET için (her biri ayrı ayrı çalıştır)
  openssl rand -hex 48
  # WALLET_ENCRYPTION_KEY için
  openssl rand -hex 16
  ```

> **⚠️ Güvenlik notu**: `.env` dosyandaki private key public testnet için (Sepolia). Burada **gerçek para** yok ama yine de production için **yeni bir cüzdan** oluştur ve sadece o cüzdana faucet ETH'i koy.

---

## 1️⃣ Backend Deploy — Render

### A) Otomatik (render.yaml ile — önerilen)

1. Repo'yu GitHub'a push'la (`render.yaml` dahil).
2. https://render.com → **New +** → **Blueprint**
3. GitHub repo'nu seç → Render `render.yaml`'ı algılar.
4. **Apply** dedikten sonra Render servisi + 1GB persistent disk oluşturur.
5. Servis "Live" olduktan sonra **Environment** sekmesine git ve aşağıdaki secret'ları manuel ekle:

   | Variable | Değer |
   |---|---|
   | `ADMIN_PRIVATE_KEY` | Sepolia için ürettiğin private key |
   | `RELAYER_PRIVATE_KEY` | Aynı veya ayrı bir key |
   | `SMTP_HOST` | `smtp.office365.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_SECURE` | `false` |
   | `SMTP_USER` | `20190808081@ogr.akdeniz.edu.tr` |
   | `SMTP_PASS` | **App Password** (normal şifre değil!) |
   | `SMTP_FROM` | `"SSI Voting <20190808081@ogr.akdeniz.edu.tr>"` |
   | `CORS_ORIGINS` | (Vercel deploy bittikten sonra dolduracaksın) |
   | `FRONTEND_URL` | (Vercel deploy bittikten sonra dolduracaksın) |

6. **Manual Deploy** → **Clear build cache & deploy**.
7. Backend URL'ini not al (örn. `https://ssi-voting-backend.onrender.com`).
8. Sağlık kontrolü: tarayıcıdan `https://ssi-voting-backend.onrender.com/api/health` aç → `{"status":"ok"}` görmelisin.

### B) Manuel kurulum

1. https://render.com → **New +** → **Web Service**
2. GitHub repo'nu bağla.
3. Ayarlar:
   - **Name**: `ssi-voting-backend`
   - **Region**: Frankfurt
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Starter ($7/ay — Free plan'da persistent disk yok, SQLite kaybolur)
4. **Advanced** → **Add Disk**
   - **Name**: `ssi-voting-data`
   - **Mount Path**: `/var/data`
   - **Size**: 1 GB
5. **Environment Variables** bölümünde yukarıdaki tabloyu ekle (yanı sıra `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=10000`, `DB_PATH=/var/data/database.db`, `BLOCKCHAIN_RPC_URL`, `CHAIN_ID`, `VOTING_CONTRACT_ADDRESS`).
6. **Create Web Service**.

> 💡 **Free plan kullanmak istersen**: Disk olmaz, restart'ta DB sıfırlanır. Bu kabul edilebilirse `plan: free` ve `disk:` kısmını sil. Akademik demo için OK olabilir.

---

## 2️⃣ Frontend Deploy — Vercel

1. https://vercel.com → **Add New** → **Project**
2. GitHub repo'nu seç → **Import**
3. **Configure Project**:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend` (önemli!)
   - **Build Command**: `npm run build` (varsayılan)
   - **Output Directory**: `build` (varsayılan)
4. **Environment Variables**:
   | Variable | Değer |
   |---|---|
   | `REACT_APP_API_URL` | `https://ssi-voting-backend.onrender.com` |

   *(Tek bu değişken yeterli — `REACT_APP_API_BASE_URL` ve `REACT_APP_SOCKET_URL` otomatik türetilir.)*
5. **Deploy** → 1-2 dk bekle.
6. Frontend URL'ini not al (örn. `https://ssi-voting.vercel.app`).

---

## 3️⃣ Backend'i Frontend URL'ine Bağla (CORS)

Vercel deploy bittikten sonra Render'a geri dön:

1. Render → **Environment** sekmesi
2. Şu değişkenleri güncelle:
   ```
   CORS_ORIGINS=https://ssi-voting.vercel.app
   FRONTEND_URL=https://ssi-voting.vercel.app
   ```
   (Birden fazla domain virgülle ayrılır: `https://a.vercel.app,https://b.com`)
3. **Save Changes** → Render otomatik restart eder.

---

## 4️⃣ Test

1. Vercel URL'ini aç: `https://ssi-voting.vercel.app`
2. Tarayıcı DevTools → **Network** sekmesini aç.
3. Login sayfasında bir kullanıcı kaydı dene.
4. **Network** sekmesinde `/api/...` çağrılarının `https://ssi-voting-backend.onrender.com/api/...`'ya gittiğini doğrula.
5. Console'da CORS hatası olmamalı.
6. WebSocket bağlantısını kontrol et: `wss://ssi-voting-backend.onrender.com/socket.io/...`
7. Bir oy kullan ve admin panelinde göründüğünü doğrula.

---

## 🔍 Sık Karşılaşılan Sorunlar

| Sorun | Çözüm |
|---|---|
| `CORS error` | Render'da `CORS_ORIGINS` Vercel URL'ini içeriyor mu? |
| Login sonrası hemen logout | `withCredentials` çalışmıyor — Render'da `trust proxy` set edilmeli (zaten kodda var) |
| `503 Database not connected` | Render log'una bak, persistent disk mount edildi mi? |
| WebSocket bağlanmıyor | Render free plan WS'i destekler ama Vercel'da `REACT_APP_SOCKET_URL` doğru mu? |
| OTP e-postası gelmiyor | Office365 App Password kullandığından emin ol; `SMTP_PASS` normal şifre olmaz |
| `Insufficient funds` (relayer) | Sepolia cüzdanında ETH yok — faucet'tan al |
| Render free plan'da uyku | Free plan 15 dk inaktiviteden sonra uyur. Cron job ile pingle veya Starter'a geç |

---

## 💰 Maliyet Özeti

| Servis | Plan | Aylık |
|---|---|---|
| Render Backend | Starter (persistent disk için) | $7 |
| Render Disk (1GB) | Dahil | $0 |
| Vercel Frontend | Hobby | $0 |
| Sepolia ETH | Faucet | $0 |
| Office365 SMTP | Üniversite hesabı | $0 |
| **Toplam** | | **$7/ay** |

> **Tamamen ücretsiz tutmak için**: Render free plan + SQLite kaybını kabul et, veya backend'i Fly.io'ya taşı (volume free, ama daha karmaşık setup).

---

## 🔄 Sonraki Adımlar

- [ ] Custom domain bağla (Vercel ücretsiz HTTPS dahil)
- [ ] Render Cron Job ile periyodik DB backup
- [ ] Sentry / LogRocket ile hata izleme
- [ ] Cloudflare ile DDoS koruması
- [ ] Postgres'e geçiş (uzun vadede SQLite'tan daha sağlam)
