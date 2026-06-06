# v1 Production Deployment Guide
## Sepolia + Render + Vercel + SQLite + Brevo

**Timeline:** 2-3 saat  
**Cost:** Free (Render + Vercel free tier)  
**Status:** Production-ready

---

## ⚡ Quick Start (Copy-Paste Ready)

### Phase 1: Smart Contract Deploy (15 min)

```bash
# 1.1 Setup blockchain directory
cd blockchain
npm install
cat > .env << 'EOF'
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
ISSUER_PRIVATE_KEY=0x...
EOF

# 1.2 Deploy to Sepolia
npx hardhat run scripts/deploy-ssi.js --network sepolia

# ✅ OUTPUT: VotingSSI deployed to: 0x123abc...
# SAVE THIS ADDRESS!
```

**After deployment:**
```
Voting Contract Address: 0x...
Save to: VOTING_CONTRACT_ADDRESS
```

---

### Phase 2: Backend Setup (45 min)

#### Step 2.1: Local Environment File
```bash
cd backend

# Create .env file
cat > .env << 'EOF'
# Database (SQLite)
SQLITE_PATH=./votes.db

# Blockchain
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
BLOCKCHAIN_NETWORK=Sepolia
VOTING_CONTRACT_ADDRESS=0xYOUR_CONTRACT_ADDRESS
ISSUER_PRIVATE_KEY=0xYOUR_ISSUER_PRIVATE_KEY
RELAYER_PRIVATE_KEY=0xYOUR_RELAYER_PRIVATE_KEY

# JWT Auth
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRY=24h

# Email (Brevo SMTP)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=YOUR_BREVO_EMAIL@example.com
SMTP_PASS=YOUR_BREVO_SMTP_KEY
SMTP_FROM=noreply@yourdomain.com
RESEND_API_KEY=re_

# Frontend CORS
FRONTEND_URL=https://yourdomain.vercel.app
CORS_ORIGIN=https://yourdomain.vercel.app

# Security
RATE_LIMIT_VOTES=10
RATE_LIMIT_AUTH=5

# Port
PORT=3001
NODE_ENV=production
EOF
```

#### Step 2.2: Test Backend Locally
```bash
# Install dependencies
npm install

# Start server
npm start

# Test endpoint
curl http://localhost:3001/api/health
# Expected: {"status":"ok"}
```

#### Step 2.3: Setup Render Deployment
```bash
1. Go to https://render.com
2. Sign up with GitHub
3. Create new "Web Service"
4. Connect to OnlineVoting repo
5. Configure:
   - Name: onlinevoting-backend
   - Root Directory: backend
   - Build Command: npm install
   - Start Command: node server.js
   - Environment: Node
   - Plan: Free
6. Add environment variables from .env
7. Click "Create Web Service"
8. Wait 3-5 minutes for deployment
```

**After deployment:**
```
Backend URL: https://onlinevoting-backend.onrender.com
Save for next phase
```

**Keep Render from sleeping (Optional):**
```bash
# Add this to keep server alive
npm install node-cron
# Or use https://uptimerobot.com (free)
```

---

### Phase 3: Frontend Setup (30 min)

#### Step 3.1: Environment Variables
```bash
cd frontend

cat > .env.local << 'EOF'
REACT_APP_API_BASE=https://onlinevoting-backend.onrender.com
REACT_APP_SOCKET_URL=https://onlinevoting-backend.onrender.com
REACT_APP_NETWORK=Sepolia
REACT_APP_BLOCKCHAIN_ID=11155111
EOF
```

#### Step 3.2: Test Frontend Locally
```bash
npm install
npm start
# Browser: http://localhost:3000
```

#### Step 3.3: Deploy to Vercel
```bash
1. Go to https://vercel.com
2. Sign up with GitHub
3. Import OnlineVoting project
4. Configure:
   - Framework: Create React App
   - Root Directory: frontend
   - Build Command: npm run build
   - Output Directory: build
5. Add environment variables from .env.local
6. Click "Deploy"
7. Wait 2-3 minutes
```

**After deployment:**
```
Frontend URL: https://onlinevoting-staging.vercel.app
(or your custom domain)
```

---

### Phase 4: First Election Setup (30 min)

#### Step 4.1: Access Admin Panel
```bash
1. Go to https://onlinevoting-staging.vercel.app
2. Click "Admin Panel"
3. Register admin account
4. Login with admin credentials
```

#### Step 4.2: Create First Election
```bash
# Via API or UI:
POST /admin/elections
{
  "title": "Rektor Seçimi 2026",
  "start_date": "2026-06-10T10:00:00Z",
  "end_date": "2026-06-10T12:00:00Z",
  "description": "Test election"
}
```

#### Step 4.3: Add Candidates
```bash
POST /admin/elections/:id/candidates
{
  "name": "Ahmet Şen",
  "description": "Computer Science"
}
```

#### Step 4.4: Domain Restrictions (Optional)
```bash
POST /admin/elections/:id/domains
{
  "domain": "@akdeniz.edu.tr"
}
```

#### Step 4.5: Activate Election
```bash
PUT /admin/elections/:id/toggle
# Response: is_active: true
# ✅ Election is now LIVE
```

---

### Phase 5: Testing (20 min)

#### Test 5.1: User Registration
```bash
1. Go to frontend
2. Click "Register"
3. Enter test@example.com
4. Check email for OTP
5. Enter OTP → Login
```

#### Test 5.2: Vote
```bash
1. Select election
2. Select candidate
3. Click "Oy Ver" (Vote)
4. Confirm wallet
5. Watch confetti! 🎉
```

#### Test 5.3: Receipt Verification
```bash
1. Copy TX hash from vote receipt
2. Click "Dogrula" (Verify)
3. Paste TX hash
4. Verify on Sepolia Etherscan
```

#### Test 5.4: Check Results
```bash
1. Admin panel → Analytics
2. View vote counts per candidate
3. Export PDF report
```

---

### Phase 6: Security Checklist

Before going to mainnet:

```bash
- [ ] JWT_SECRET is 32+ random chars (no repo commit)
- [ ] Private keys only in Render secrets (not git)
- [ ] CORS only allows your Vercel domain
- [ ] Email OTP working (check spam)
- [ ] Rate limiting enabled
- [ ] HTTPS everywhere (Vercel/Render auto-enable)
- [ ] Database backup plan (SQLite → automated backup)
- [ ] Admin password is strong
- [ ] Monitor error logs daily
- [ ] Have rollback plan (revert deployment)
```

---

## 📊 Monitoring & Operations

### Check Backend Health
```bash
curl https://onlinevoting-backend.onrender.com/api/health
```

### View Render Logs
```bash
1. Go to Render dashboard
2. Select Web Service
3. View real-time logs
```

### View Vercel Logs
```bash
1. Go to Vercel dashboard
2. Select project
3. View deployment logs
```

### Database Backup (SQLite)
```bash
# Manual backup
cp backend/votes.db backend/votes.db.backup.$(date +%Y%m%d)

# Or use Render's backup feature for production
```

---

## 🚨 Troubleshooting

### Issue: Backend keeps sleeping on Render
**Solution:**
```bash
# Use free uptime monitor
https://uptimerobot.com
- Set to ping backend every 5 min
- Keeps it warm
```

### Issue: Emails not sending
**Solution:**
```bash
1. Check Brevo SMTP credentials
2. Test SMTP connection:
   npm install node-mailer
   node -e "require('./test-smtp.js')"
3. Check spam folder
4. Verify sender domain
```

### Issue: Votes not recording
**Solution:**
```bash
1. Check backend logs
2. Verify contract address is correct
3. Confirm issuer/relayer have gas
4. Check database permissions
```

### Issue: Frontend shows wrong API URL
**Solution:**
```bash
1. Verify .env.local has correct API_BASE
2. Rebuild: npm run build
3. Redeploy to Vercel
4. Clear browser cache (Ctrl+Shift+Del)
```

---

## 🔄 Next Steps

### After First Election:
1. ✅ Collect user feedback
2. ✅ Check error logs
3. ✅ Monitor performance
4. ✅ Plan next features

### Before Mainnet:
1. External security audit ($5-10K)
2. Load testing
3. Database optimization
4. Mainnet contract deployment
5. Gradual rollout

### Long-term (Q3-Q4 2026):
1. Begin v2 (ZKP+SSI) development
2. Upgrade to true decentralization
3. Mainnet migration

---

## 📞 Emergency Contacts

**Backend down?**
- Check Render status
- View logs for errors
- Restart service

**Frontend down?**
- Check Vercel status
- Clear CDN cache
- Redeploy

**Blockchain issue?**
- Check Sepolia RPC status
- Verify contract address
- Check private keys

---

## ✅ Success Indicators

You're ready for mainnet when:
- [ ] 100+ test users registered
- [ ] 50+ votes cast successfully
- [ ] 0 failed vote submissions
- [ ] All receipts verify correctly
- [ ] Email delivery working
- [ ] No security issues
- [ ] Performance is smooth (<2s response)
- [ ] Admin features working
- [ ] Analytics accurate
- [ ] Team trained on operations

**Estimated timeline to mainnet:** 2-4 weeks after testnet success.

---

## 📖 Reference Docs

- **DAO_DEPLOYMENT_GUIDE.md**: Detailed DAO setup
- **ARCHITECTURE.md**: Technical reference
- **DEPLOYMENT_CHECKLIST.md**: Full checklist
- **ZKP_SSI_UPGRADE_ROADMAP.md**: Future v2 upgrade

---

**Ready to go live? Let's deploy!** 🚀
