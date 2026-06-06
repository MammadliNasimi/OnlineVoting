# DAO Deployment Guide — OnlineVoting

## Quick Start

This guide walks you through deploying OnlineVoting for your DAO or Web3 community. No external wallet extension required; voters use their email (OTP) or wallet (SIWE).

---

## Prerequisites

- Node.js 22+
- Git
- Ethereum testnet (Sepolia) or mainnet RPC endpoint
- Email provider (Gmail SMTP, Resend, or Brevo)
- Multi-sig wallet (optional, recommended for security)

---

## Phase 1: Smart Contract Deployment

### Step 1.1: Prepare Issuer Address

**Option A: Single Admin (for testing)**
```bash
# Use your personal wallet
ISSUER_ADDRESS=0x1234567890123456789012345678901234567890
```

**Option B: Multi-Sig Wallet (recommended for DAO)**
```bash
# Create a Gnosis Safe multi-sig or Aragon DAO
# For Sepolia: https://app.safe.global (select Sepolia testnet)
# Create 3-of-5 multi-sig (example: 3 DAO members sign, 5 total owners)
ISSUER_ADDRESS=0xYourGnosis_Safe_Address
```

### Step 1.2: Clone and Setup

```bash
git clone https://github.com/MammadliNasimi/OnlineVoting.git
cd OnlineVoting/blockchain
npm install
```

### Step 1.3: Configure Hardhat

Edit `hardhat.config.js`:
```javascript
module.exports = {
  networks: {
    sepolia: {
      url: process.env.BLOCKCHAIN_RPC_URL,
      accounts: [process.env.BLOCKCHAIN_DEPLOYER_PRIVATE_KEY]
    }
  }
};
```

### Step 1.4: Deploy Contract

```bash
export BLOCKCHAIN_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
export BLOCKCHAIN_DEPLOYER_PRIVATE_KEY="0x..."  # Your wallet's private key (deployer)

npx hardhat run scripts/deploy-ssi.js --network sepolia
# Output:
# ✅ Contract deployed to: 0x62a8878de43d5d6fd9B199d92556843a57F39aae
```

**Save this address:**
```
VOTING_CONTRACT_ADDRESS=0x62a8878de43d5d6fd9B199d92556843a57F39aae
```

---

## Phase 2: Backend Setup (Render or Self-Hosted)

### Step 2.1: Backend Environment Variables

Create `.env` file in `backend/`:

```bash
# Server
NODE_ENV=production
PORT=5000

# Database
DATABASE_PATH=/data/voting.db

# Blockchain
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
VOTING_CONTRACT_ADDRESS=0x62a8878de43d5d6fd9B199d92556843a57F39aae

# Credential Issuer (matches issuer address in contract)
ISSUER_PRIVATE_KEY=0x...  # Private key of issuer (e.g., multi-sig signer or DAO treasury)
ISSUER_CHAIN_ID=11155111  # Sepolia chain ID

# Relayer (pays gas for votes)
RELAYER_PRIVATE_KEY=0x...  # Private key of relayer wallet (funded with ETH)
RELAYER_MIN_BALANCE=1000000000000000000  # 1 ETH minimum

# Email (OTP delivery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password  # Gmail: generate at https://myaccount.google.com/apppasswords
SMTP_FROM=Your_DAO <your_email@gmail.com>

# Or use Resend instead:
RESEND_API_KEY=re_1234567890...
RESEND_FROM=voting@yourdao.xyz

# JWT Security (generate with: openssl rand -hex 48)
JWT_SECRET=abcdef1234567890...
SESSION_SECRET=ghijkl9876543210...
WALLET_ENCRYPTION_KEY=mnopqr...

# Frontend Origin (for CORS)
FRONTEND_ORIGIN=https://yourdao-voting.vercel.app
SOCKET_ORIGIN=https://yourdao-voting.vercel.app

# Email Whitelist (optional; restrict to your domain)
EMAIL_WHITELIST=yourdao.eth,yourdao.xyz,members.yourdao.com

# Optional: Enable debug logging
DEBUG_OTP=false  # Set to 'true' only in staging to see OTP in logs
```

### Step 2.2: Private Key Security

**⚠️ Never commit private keys to Git!**

For **Render** (recommended):
1. Go to Render dashboard
2. Select your service → Environment
3. Add each key as a secret (not plain text)

For **self-hosted**:
```bash
# Use environment files, not .env in repo
cp .env.example .env
# Edit .env locally, add to .gitignore
echo ".env" >> .gitignore
```

### Step 2.3: Deploy Backend

#### Option A: Render (Easiest)

1. Create `render.yaml` (already provided in repo):
```yaml
services:
  - type: web
    name: onlinevoting-backend
    runtime: node
    buildCommand: cd backend && npm install
    startCommand: cd backend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: SESSION_SECRET
        generateValue: true
      - key: WALLET_ENCRYPTION_KEY
        generateValue: true
```

2. Push to GitHub:
```bash
git add .
git commit -m "DAO: backend environment setup"
git push origin main
```

3. Connect to Render:
   - Visit https://dashboard.render.com
   - New → Blueprint
   - Select your GitHub repo
   - Render auto-deploys

#### Option B: Self-Hosted (Docker)

```bash
cd backend
docker build -t onlinevoting-backend .
docker run -d \
  -e BLOCKCHAIN_RPC_URL=... \
  -e VOTING_CONTRACT_ADDRESS=... \
  -p 5000:5000 \
  onlinevoting-backend
```

### Step 2.4: Verify Backend Health

```bash
curl https://ssi-voting-backend.onrender.com/api/health
# {
#   "status": "ok",
#   "timestamp": "2026-06-06T10:00:00Z",
#   "issuer": "0x...",
#   "contract": "0x..."
# }
```

---

## Phase 3: Frontend Setup (Vercel)

### Step 3.1: Frontend Environment Variables

Create `.env.local` in `frontend/`:

```bash
REACT_APP_API_BASE_URL=https://ssi-voting-backend.onrender.com
REACT_APP_SOCKET_URL=https://ssi-voting-backend.onrender.com
REACT_APP_CHAIN_ID=11155111  # Sepolia
REACT_APP_BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
```

### Step 3.2: Deploy Frontend

```bash
cd frontend
npm run build  # Pre-build locally to catch errors
git add .
git commit -m "DAO: frontend environment setup"
git push origin main
```

Vercel auto-deploys on push to `main`. Verify:
```
https://yourdao-voting.vercel.app
```

---

## Phase 4: Election Setup & Testing

### Step 4.1: Create First Election

1. **Admin logs in** (via backend):
   ```bash
   curl -X POST https://backend.onrender.com/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@yourdao.com"}'
   # Receive OTP email
   
   curl -X POST https://backend.onrender.com/auth/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@yourdao.com", "otp": "123456"}'
   # Receive JWT token
   ```

2. **Create election** (admin endpoint):
   ```bash
   curl -X POST https://backend.onrender.com/admin/create-election \
     -H "Authorization: Bearer JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Treasury Allocation: Proposal A vs B",
       "startTime": 1717686000,
       "endTime": 1717686300,
       "candidates": ["Proposal A", "Proposal B"]
     }'
   ```

3. **Smart contract initializes** (backend auto-calls `setElection`)

### Step 4.2: Test Voting Flow

1. Open frontend: `https://yourdao-voting.vercel.app`
2. Enter your email, receive OTP
3. Select a candidate
4. Watch real-time updates (Socket.io)
5. Receive confirmation email with txHash

**Verify on-chain:**
```bash
# Check Etherscan (Sepolia)
https://sepolia.etherscan.io/tx/0x...
# Should show:
# - To: VOTING_CONTRACT_ADDRESS
# - Function: vote(VoteProof proof)
# - Status: Success
```

### Step 4.3: Verify Receipt

```bash
# Query vote by txHash
curl https://backend.onrender.com/api/verify-receipt/0x...
# {
#   "txHash": "0x...",
#   "electionID": 1,
#   "candidateID": 0,
#   "nullifier": "0x...",
#   "timestamp": 1717686001,
#   "status": "confirmed"
# }
```

---

## Phase 5: DAO Governance Integration (Optional)

### Step 5.1: Link Election to DAO Vote

Before creating an election, hold a **DAO governance vote**:
- Snapshot vote: "Should we hold a vote on Treasury Allocation?"
- Result: threshold met (e.g., 60% quorum)
- Admin then calls `/admin/create-election` with election details

### Step 5.2: Multi-Sig Issuer (Recommended)

Update backend to require multi-sig approval for new elections:

```javascript
// backend/src/controllers/admin.controller.js
// Option 1: Check multi-sig wallet approval on-chain
const isApproved = await contract.isElectionApproved(electionID);
if (!isApproved) throw new Error('Election not approved by multi-sig');

// Option 2: Require multiple backend admins to sign off
const approvals = [
  { admin: "alice@dao", signed: true },
  { admin: "bob@dao", signed: true },
  { admin: "charlie@dao", signed: false } // Waiting
];
if (approvals.filter(a => a.signed).length < 2) {
  throw new Error('Need 2 of 3 admin signatures');
}
```

---

## Phase 6: Monitoring & Operations

### Real-Time Monitoring Dashboard

Set up monitoring for:

```bash
# Vote success rate
curl https://backend.onrender.com/admin/metrics
# {
#   "totalVotes": 100,
#   "successfulVotes": 99,
#   "failedVotes": 1,
#   "pendingVotes": 0,
#   "relayerGasSpent": "2.5 ETH"
# }

# Email delivery status
# Check Resend/SMTP dashboard for bounces and opens

# Blockchain gas prices
# Monitor Sepolia/mainnet gas tracker
```

### Automated Alerts

```bash
# Alert if relayer balance drops below threshold
if RELAYER_BALANCE < 0.5 ETH:
  send_slack_alert("Relayer running low on gas")
  # Manually refund relayer address
fi

# Alert if vote success rate drops
if SUCCESS_RATE < 95%:
  send_slack_alert("Vote success rate: " + SUCCESS_RATE)
fi
```

### Audit Export

After election ends:

```bash
# Export all votes, nullifiers, and results
curl https://backend.onrender.com/admin/export-audit \
  -H "Authorization: Bearer ADMIN_JWT" \
  -o audit-election-001.json

# Contents:
{
  "electionID": 1,
  "title": "Treasury Allocation",
  "results": [
    { "candidateID": 0, "name": "Proposal A", "voteCount": 52 },
    { "candidateID": 1, "name": "Proposal B", "voteCount": 48 }
  ],
  "votes": [
    { "nullifier": "0xabc...", "candidateID": 0, "txHash": "0x..." },
    { "nullifier": "0xdef...", "candidateID": 1, "txHash": "0x..." }
  ],
  "exportedAt": "2026-06-06T11:00:00Z"
}
```

---

## Phase 7: Going Live (Mainnet or Continued Testnet)

### Mainnet Migration

1. **Audit Smart Contract**
   - Third-party security audit recommended
   - Or at minimum: peer review of `VotingSSI.sol`

2. **Redeploy to Mainnet**
   ```bash
   export BLOCKCHAIN_RPC_URL=https://eth-mainnet.infura.io/v3/...
   npx hardhat run scripts/deploy-ssi.js --network mainnet
   ```

3. **Update Backend Environment**
   - Change `BLOCKCHAIN_RPC_URL` to mainnet
   - Change `CHAIN_ID` to 1
   - Fund relayer with adequate ETH (calculate based on expected votes)

4. **Security Hardening**
   - Rotate JWT_SECRET on mainnet
   - Enable rate limiting on all endpoints
   - Set up DDoS protection (Cloudflare)
   - Use dedicated relayer infrastructure (or OpenGSN)

### Testnet (Recommended for DAO Pilot)

- Deploy to Sepolia testnet first
- Run elections with small community (50–500 voters)
- Gather feedback and iterate
- Then graduate to mainnet

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **OTP not received** | Check SMTP/Resend credentials; verify EMAIL_WHITELIST allows the domain |
| **Vote fails on chain** | Check relayer balance; verify issuer signature is correct |
| **Frontend can't reach backend** | Verify CORS origin in backend; check SOCKET_ORIGIN |
| **Nullifier collision** | Ensure email hashing is consistent; check DB for duplicate emails |
| **Relayer out of gas** | Refund relayer address; increase relayer balance threshold |
| **Election won't start** | Check `startTime` is before `block.timestamp`; verify contract is approved |

---

## Security Checklist

- [ ] All private keys stored in Render Secrets (never in `.env` file)
- [ ] JWT_SECRET rotated (use `openssl rand -hex 48`)
- [ ] ISSUER_PRIVATE_KEY is multi-sig or DAO-controlled
- [ ] RELAYER_PRIVATE_KEY is separate from issuer key
- [ ] Database backups enabled (Render + separate backup service)
- [ ] Rate limiting enabled on all auth endpoints
- [ ] CORS origin restricted to your frontend domain
- [ ] Email sender address verified with provider (Gmail/Resend)
- [ ] Smart contract audited or peer-reviewed
- [ ] Monitoring alerts set up (gas, vote success, email delivery)

---

## Support & Community

- **Issues**: Open GitHub issue or discussion
- **Questions**: Ask in DAO Discord/Telegram
- **Security Report**: Email security@yourdao.com (use PGP key if available)

Good luck with your DAO election! 🗳️
