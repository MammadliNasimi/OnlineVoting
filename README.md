# 🗳️ Blockchain-Based Online Voting System (Demo)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.x-blue.svg)](https://soliditylang.org/)

A secure, transparent, and anonymous online voting system prototype built with blockchain technology. This is a **research project** for TÜBİTAK 2209-A demonstrating blockchain-based anonymous voting.

## 🎯 Project Overview

This demo showcases:

✅ **User Authentication** - Secure registration/login with SQLite  
✅ **Database Integration** - Full user and election management  
✅ **Blockchain Foundation** - Smart contract deployed on Hardhat  
✅ **Vote Authorization** - ECDSA signature-based authorization  
⏳ **Anonymous Voting** - Commitment-based voting (in progress)  
⏳ **Vote Verification** - Receipt-based verification (planned)  

## ✨ Features

### Implemented ✅

- User registration and login with password hashing
- Role-based access control (admin/user)
- SQLite database with auto-initialization
- Smart contract (VotingAnonymous.sol) deployment
- Vote authorization service with ECDSA signatures
- RESTful API backend
- React frontend with voting UI

### In Progress ⏳

- MetaMask integration
- Vote submission to blockchain
- Vote receipt/verification system
- ZKP or Ring Signatures

## 🛠️ Technology Stack

**Frontend:** React 18, Axios, Chart.js  
**Backend:** Node.js, Express, bcrypt, better-sqlite3  
**Blockchain:** Solidity 0.8.x, Hardhat, Ethers.js v6

## 🚀 Quick Start

### Prerequisites
- Node.js 18.x
- npm

### Installation

```bash
# 1. Install dependencies
npm install
cd client && npm install && cd ..
cd smart-contracts && npm install && cd ..

# 2. Start Hardhat blockchain
cd smart-contracts
npx hardhat node
# Keep this terminal open

# 3. Deploy smart contract (in new terminal)
cd smart-contracts
npx hardhat run scripts/deploy.js --network localhost
# Copy contract address and update .env VOTING_CONTRACT_ADDRESS

# 4. Start backend (in new terminal)
node server.js

# 5. Start frontend (in new terminal)
cd client
npm start
```

### Default Login

- **Username:** `admin`
- **Password:** `admin123`

## 📖 Usage

### View Database

```bash
node view-db.js
```

### Register New User

1. Click "Kayıt Ol"
2. Enter username/password
3. Login with new credentials

## 📁 Project Structure

```
OnlineVoting/
├── client/                # React frontend
├── smart-contracts/       # Solidity contracts
├── config/
│   └── database-sqlite.js # Database service
├── services/
│   └── authService.js     # Vote authorization
├── server.js             # Express API
├── view-db.js           # Database viewer
└── database.db          # SQLite (auto-created)
```

## 🔧 API Endpoints

- `POST /api/register` - Register user
- `POST /api/login` - Login
- `GET /api/candidates` - Get candidates
- `POST /api/vote/authorize` - Get vote signature
- `GET /api/blockchain/info` - Blockchain config

## 🔐 Security Notes

⚠️ **DEMO/PROTOTYPE ONLY**:
- SQLite in project folder
- Private key in .env file
- Open CORS
- Basic security

**For production**: Use PostgreSQL, proper key management, HTTPS, rate limiting, security audit.

## 🎓 Research Goals (TÜBİTAK 2209-A)

1. Transparency + Anonymity balance
2. Cryptographic anonymity (commitment-based)
3. Vote verification capability
4. Open source & auditable

## 📝 TODO

- [ ] MetaMask integration
- [ ] Blockchain vote submission
- [ ] Vote receipt system
- [ ] ZKP/Ring Signatures
- [ ] Screenshot prevention
- [ ] Sepolia deployment
- [ ] Security audit
- [ ] PostgreSQL migration

## 📄 License

MIT License

---

**⚠️ DISCLAIMER**: Prototype for research/education. Not production-ready.
