# v1 Production Deployment Checklist

## 📋 Pre-Deployment

- [ ] Read `DAO_DEPLOYMENT_GUIDE.md` fully
- [ ] Have ETH for gas (Sepolia testnet or Mainnet)
- [ ] Have email provider credentials (Resend OR SMTP)
- [ ] Choose blockchain network (Sepolia testnet OR Ethereum mainnet)
- [ ] Choose hosting providers:
  - Backend: Render (free) OR Railway OR self-hosted
  - Frontend: Vercel (free) OR Netlify
  - Database: Render PostgreSQL OR self-managed

---

## 🔐 Environment Variables Needed

### **Backend (.env)**
```env
# Database
DATABASE_URL=postgres://...
SQLITE_PATH=./votes.db

# Blockchain
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
BLOCKCHAIN_NETWORK=Sepolia
VOTING_CONTRACT_ADDRESS=0x...
ISSUER_PRIVATE_KEY=0x...
RELAYER_PRIVATE_KEY=0x...

# Auth
JWT_SECRET=your-very-long-random-secret-min-32-chars
JWT_EXPIRY=24h

# Email
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_your_key
SMTP_FROM=noreply@yourdomain.com

# Frontend
FRONTEND_URL=https://yourdomain.vercel.app
CORS_ORIGIN=https://yourdomain.vercel.app

# Security
RATE_LIMIT_VOTES=10
RATE_LIMIT_AUTH=5
```

### **Frontend (.env.local)**
```env
REACT_APP_API_BASE=https://backend.yourdomain.com
REACT_APP_SOCKET_URL=https://backend.yourdomain.com
REACT_APP_NETWORK=Sepolia
```

---

## 🔗 Phase 1: Smart Contract Deployment

### Step 1.1: Clone & Setup
```bash
cd blockchain
npm install
```

### Step 1.2: Create Hardhat Config
```javascript
// hardhat.config.js
require('@nomicfoundation/hardhat-toolbox');

module.exports = {
  solidity: '0.8.20',
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.ISSUER_PRIVATE_KEY]
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL,
      accounts: [process.env.ISSUER_PRIVATE_KEY]
    }
  }
};
```

### Step 1.3: Deploy Contract
```bash
# Testnet (Sepolia)
npx hardhat run scripts/deploy-ssi.js --network sepolia

# Output will show:
# VotingSSI deployed to: 0x...
```

### Step 1.4: Verify on Etherscan
```bash
npx hardhat verify --network sepolia 0x... "Constructor args if any"
```

### Step 1.5: Save Contract Address
```
Save VOTING_CONTRACT_ADDRESS to backend .env
```

---

## 💾 Phase 2: Database Setup

### Option A: Render PostgreSQL (Recommended)
```bash
1. Go to Render.com
2. Create new PostgreSQL database
3. Copy DATABASE_URL
4. Paste to backend .env
5. Run migrations:
   npx knex migrate:latest
```

### Option B: Self-Hosted SQLite
```bash
1. Backend uses SQLite by default
2. Database stored in backend/votes.db
3. Set SQLITE_PATH=./votes.db in .env
```

**Note:** For production with multiple users, use PostgreSQL.

---

## ⚙️ Phase 3: Backend Deployment

### Option A: Render.com (Free Tier)
```bash
1. Create account at render.com
2. Create new Web Service
3. Connect GitHub (OnlineVoting repo)
4. Select branch: main
5. Build command: npm install
6. Start command: node server.js
7. Set environment variables from .env
8. Deploy
```

**Result:** `https://backend-xyz.onrender.com`

### Option B: Railway.app
```bash
1. Create account at railway.app
2. Deploy from GitHub
3. Set environment variables
4. Railway will auto-detect Node.js
```

### Option C: Self-Hosted (VPS)
```bash
1. SSH to server
2. git clone repo
3. npm install
4. node server.js (or use PM2)
```

---

## 🎨 Phase 4: Frontend Deployment

### Option A: Vercel (Recommended)
```bash
1. Create account at vercel.com
2. Import project from GitHub
3. Select framework: Create React App
4. Set environment variables (.env.local)
5. Deploy
```

**Result:** `https://yourdomain.vercel.app`

### Option B: Netlify
```bash
1. Create account at netlify.com
2. Deploy from GitHub
3. Build command: npm run build
4. Publish directory: build/
```

### Option C: Static Host (S3 + CloudFront)
```bash
1. Build locally: npm run build
2. Upload to S3
3. Set up CloudFront
```

---

## 🧪 Phase 5: Testing

### Test 1: Backend Health Check
```bash
curl https://backend-xyz.onrender.com/api/health
# Expected: {"status": "ok"}
```

### Test 2: Authentication
```bash
curl -X POST https://backend-xyz.onrender.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123"}'
```

### Test 3: Create Election (Admin)
```bash
# Use admin credentials from DAO_DEPLOYMENT_GUIDE
POST /election
{
  "title": "Test Election",
  "start_date": "2026-06-10T10:00:00Z",
  "end_date": "2026-06-10T12:00:00Z"
}
```

### Test 4: Cast Vote
```bash
# Login as voter
# Select election
# Select candidate
# Submit vote via UI
# Check blockchain verification
```

### Test 5: Verify Vote on Blockchain
```bash
# Use receipt verification dialog
# Enter TX hash
# Confirm vote on Sepolia Etherscan
```

---

## 🔒 Phase 6: Security Hardening

- [ ] Set HTTPS everywhere (Render/Vercel auto-enable)
- [ ] Enable CORS only for frontend domain
- [ ] Rotate JWT_SECRET (generate new random 32+ char string)
- [ ] Enable rate limiting (already in code)
- [ ] Setup email provider (Resend preferred)
- [ ] Test email OTP flow
- [ ] Verify private keys not in git history
- [ ] Enable GitHub secrets (don't commit .env)

---

## 📊 Phase 7: Monitoring & Operations

### Logs
```bash
# Render: View in dashboard
# Railway: View in dashboard
# Self-hosted: tail -f logs/app.log
```

### Health Checks
```bash
# Setup Render/Railway health check endpoint
GET /api/health
```

### Database Backup
```bash
# Render PostgreSQL: Auto-backup enabled
# SQLite: Manually backup votes.db daily
```

---

## 🎯 Phase 8: First Live Election

### Step 1: Admin Setup
```bash
1. Login to admin panel
2. Create election with title, dates
3. Add 3-5 test candidates
4. Set domain restrictions (optional)
5. Activate election
```

### Step 2: Voter Participation
```bash
1. Share voting link with DAO members
2. Members register + verify email OTP
3. Cast votes
4. Receive vote confirmation email
5. View voting history
```

### Step 3: Results
```bash
1. Wait for election end time
2. Check smart contract state
3. View results in admin analytics
4. Export vote receipt PDF
```

---

## ⚠️ Rollback Plan

If something breaks:
```bash
# Render: Revert to previous deployment
# Vercel: Revert to previous build
# Smart contract: Deploy new version (new address)
```

---

## 📞 Support Resources

- **DAO_DEPLOYMENT_GUIDE.md**: Step-by-step operational guide
- **ARCHITECTURE.md**: Technical reference
- **ZKP_SSI_UPGRADE_ROADMAP.md**: Future upgrade path
- **GitHub Issues**: Report bugs
- **Discord**: Community support (add link)

---

## ✅ Deployment Success Criteria

- [ ] Backend health check passes
- [ ] Frontend loads without errors
- [ ] User registration works
- [ ] Email OTP delivery works
- [ ] Election creation works
- [ ] Vote submission works
- [ ] Receipt verification works
- [ ] Admin analytics visible
- [ ] All endpoints documented
- [ ] Security checklist passed
