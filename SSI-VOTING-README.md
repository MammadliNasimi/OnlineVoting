# 🔐 Self-Sovereign Identity (SSI) Voting System

## Overview

This is an enhanced version of the anonymous voting system that implements **Self-Sovereign Identity principles** using:
- **EIP-712** structured data signing
- **Nullifier mechanism** for privacy-preserving double-vote prevention
- **Verifiable credentials** (Issuer-Holder-Verifier model)
- **Gas-less transactions** via relayer service

## Architecture

### Issuer-Holder-Verifier Model

```
┌─────────────────┐
│  Issuer         │  University/Admin
│  (Backend)      │  - Verifies eligibility
└────────┬────────┘  - Issues signed credentials
         │
         │ EIP-712 Signed Credential
         ▼
┌─────────────────┐
│  Holder         │  Student/Voter
│  (Frontend)     │  - Receives credential
└────────┬────────┘  - Submits to blockchain
         │
         │ VoteProof + Signature
         ▼
┌─────────────────┐
│  Verifier       │  Smart Contract
│  (Blockchain)   │  - Verifies signature
└─────────────────┘  - Prevents double voting
```

## Key Components

### 1. Smart Contract (`VotingSSI.sol`)

**Location:** `smart-contracts/contracts/VotingSSI.sol`

**Features:**
- EIP-712 domain separator for structured data
- `VoteProof` struct: `(studentIDHash, electionID, candidateID, timestamp, signature)`
- Nullifier mechanism: `keccak256(studentIDHash, electionID)`
- ECDSA signature verification
- No identity stored on-chain (only nullifiers)

**Key Functions:**
```solidity
function vote(VoteProof calldata proof) external
function calculateNullifier(bytes32 studentIDHash, uint256 electionID) external pure
function isNullifierUsed(bytes32 nullifier) external view
```

### 2. Credential Issuer Service (`credentialIssuer.js`)

**Location:** `services/credentialIssuer.js`

**Responsibilities:**
- Hash student IDs (privacy preservation)
- Sign `VoteProof` using EIP-712
- Issue verifiable credentials
- Verify credential signatures

**Key Methods:**
```javascript
issueVoteCredential(studentID, electionID, candidateID)
issueAuthorizationToken(studentID, electionID)
verifyCredential(credential)
```

### 3. Relayer Service (`relayerService.js`)

**Location:** `services/relayerService.js`

**Purpose:** Submit transactions on behalf of users to preserve anonymity

**Features:**
- Gas-less transactions (relayer pays fees)
- Rate limiting (5 submissions/hour per user)
- Credential verification before submission
- Nullifier checking
- Automatic gas estimation

**Key Methods:**
```javascript
submitVote(credential, userIdentifier, issuerAddress)
getStatus()
checkRateLimit(identifier)
```

### 4. Frontend Flow (Current)

`client/src/SSIVoting.js` kaldirildi. Aktif oy akisi `client/src/SimpleVoting.js` uzerinden calisir.

**Guncel User Flow:**
1. Kullanici aktif secimi ve adayi secer (`/api/elections`, `/api/candidates/:electionId`)
2. Oy `/api/vote/simple` ile gonderilir
3. Sonuclar `/api/votes` ile okunur
4. Oy gecmisi `/api/voting-history` ile listelenir

## API Endpoints

### SSI Credential Endpoints

#### Legacy endpoints removed

Asagidaki endpointler urun karmasasini azaltmak icin kaldirildi:
- `POST /api/vote/authorize`
- `POST /api/ssi/request-authorization`
- `POST /api/ssi/issue-credential`
- `POST /api/ssi/verify-credential`

#### GET `/api/ssi/domain`
Get EIP-712 domain information

**Response:**
```json
{
  "success": true,
  "domain": {
    "name": "VotingSSI",
    "version": "1.0",
    "chainId": 31337,
    "verifyingContract": "0x..."
  },
  "issuer": "0x..."
}
```

### Relayer Endpoints

#### POST `/api/ssi/relayer/submit`
Submit vote via relayer (gas-less)
```json
{
  "credential": { /* credential object */ }
}
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x...",
  "blockNumber": 12345,
  "gasUsed": "123456",
  "relayerAddress": "0x..."
}
```

#### GET `/api/ssi/relayer/status`
Check relayer service status

**Response:**
```json
{
  "success": true,
  "status": {
    "relayerAddress": "0x...",
    "balance": "1.5",
    "network": "localhost",
    "chainId": "31337",
    "contractAddress": "0x...",
    "maxSubmissionsPerHour": 5
  }
}
```

## Deployment

### 1. Deploy Smart Contract

```bash
cd smart-contracts
npx hardhat node  # Terminal 1
npx hardhat run scripts/deploy-ssi.js --network localhost  # Terminal 2
```

**Output:**
```
✅ VotingSSI deployed successfully!
   Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
   Issuer Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

🔐 EIP-712 Configuration:
   Domain Separator: 0x...
   VoteProof TypeHash: 0x...
```

### 2. Configure Environment

Add to `.env`:
```env
ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
```

### 3. Start Backend

```bash
node server.js
```

**Expected Output:**
```
✅ Vote Authorization Service initialized
✅ Credential Issuer Service (SSI) initialized
   Issuer Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
   Chain ID: 31337
✅ Relayer Service initialized
   Relayer Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
   RPC URL: http://127.0.0.1:8545
```

### 4. Start Frontend

```bash
cd client
npm start
```

## Voting Flow (Current)

### Step 1: User Authentication
```
User logs in → Backend creates session → Temp wallet created
```

### Step 2: Fetch Elections and Candidates
```
Frontend: GET /api/elections (x-session-id required)
Frontend: GET /api/candidates/:electionId
```

### Step 3: Cast Vote
```
Frontend: POST /api/vote/simple { electionId, candidateId }
Backend:  - Checks session + domain restrictions
          - Issues internal credential
          - Submits through relayer
          - Writes DB vote record
```

### Step 4: Live Results and History
```
Frontend: GET /api/votes?electionId=...
Frontend: GET /api/voting-history
```

## Privacy Analysis

### What's Private?
✅ **Student Identity** - Only hashed ID on backend, never on-chain  
✅ **Vote Choice** - Credential signed off-chain, only submitted once  
✅ **Wallet Address** - Relayer submission hides voter's wallet  

### What's Recorded?
- **Nullifier** (hash of studentIDHash + electionID) - prevents double voting
- **Vote count** per candidate - public results
- **Transaction hash** - blockchain transparency

### Attack Resistance
- **Double Voting** - Nullifier mechanism prevents (checked on-chain)
- **Replay Attacks** - Timestamp validation (1-hour window)
- **Unauthorized Voting** - EIP-712 signature verification
- **Rainbow Tables** - Salted student ID hashing

## Testing

### Test Simple Voting
```bash
curl -X POST http://localhost:5000/api/vote/simple \
  -H "Content-Type: application/json" \
  -H "x-session-id: YOUR_SESSION_ID" \
  -d '{"electionId": 1, "candidateId": 1}'
```

### Test Relayer Submission Endpoint (if used)
```bash
curl -X POST http://localhost:5000/api/ssi/relayer/submit \
  -H "Content-Type: application/json" \
  -H "x-session-id: YOUR_SESSION_ID" \
  -d '{"credential": {...}}'
```

### Check Relayer Status
```bash
curl http://localhost:5000/api/ssi/relayer/status
```

## Current Architecture Snapshot

| Area | Current Implementation |
|------|------------------------|
| **Frontend voting flow** | `client/src/SimpleVoting.js` |
| **Election access control** | Session + allowed email domain checks (`/api/elections`) |
| **Vote submission** | `POST /api/vote/simple` |
| **Credential/signature path** | Internal EIP-712 credential issuance + relayer submit on backend |
| **Double-vote prevention** | Nullifier control on contract + DB vote status checks |
| **Result visibility** | `GET /api/votes?electionId=...` (live polling) |
| **Auditability** | Transaction hash + voting history (`/api/voting-history`) |
| **Gas strategy** | Relayer-backed submission |

## Security Considerations

### Production Checklist

- [ ] Use cryptographically secure session IDs (`crypto.randomBytes()`)
- [ ] Require encryption key in `.env` (no defaults)
- [ ] Implement wallet funding error handling
- [ ] Add expired session cleanup cron job
- [ ] Use database transactions for session/wallet creation
- [ ] Rate limit credential issuance endpoints
- [ ] Monitor relayer balance (auto-refill)
- [ ] Implement proper error logging
- [ ] Add credential expiration policy
- [ ] Conduct security audit of smart contract
- [ ] Test nullifier collision resistance
- [ ] Validate EIP-712 domain binding

## Future Enhancements

### Planned Features
- [ ] **DID Integration** - Decentralized Identifiers for student IDs
- [ ] **Verifiable Credentials Standard** - W3C VC Data Model
- [ ] **Zero-Knowledge Proofs** - ZK-SNARKs for enhanced privacy
- [ ] **Multi-Election Support** - Vote in multiple elections simultaneously
- [ ] **Revocation Registry** - Invalidate compromised credentials
- [ ] **Credential Delegation** - Proxy voting support
- [ ] **Mobile App** - Native mobile voting application
- [ ] **Hardware Security Module** - HSM for key management

### Research Objectives
- [ ] Physical-to-digital identity mapping analysis
- [ ] SSI applicability assessment for voting
- [ ] Security requirements definition
- [ ] Compliance framework (GDPR, data protection)
- [ ] Threat modeling and mitigation strategies

## Troubleshooting

### Common Issues

**Issue:** Credential signature verification fails  
**Solution:** Ensure domain separator matches between backend and contract

**Issue:** Nullifier already used  
**Solution:** User has already voted; check `usedNullifiers` mapping

**Issue:** Relayer balance too low  
**Solution:** Fund relayer wallet with ETH

**Issue:** Transaction reverts with "Proof expired"  
**Solution:** Credential timestamp older than 1 hour; request new credential

**Issue:** Rate limit exceeded  
**Solution:** User/IP has submitted 5+ votes in last hour; wait or increase limit

## References

- [EIP-712: Typed Structured Data Hashing and Signing](https://eips.ethereum.org/EIPS/eip-712)
- [Self-Sovereign Identity Principles](https://github.com/WebOfTrustInfo/self-sovereign-identity)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [Ethereum Gas-less Transactions](https://docs.openzeppelin.com/contracts/4.x/api/metatx)

## License

MIT

## Contributors

- Backend & Smart Contract: AI Assistant
- Frontend: React Team
- Research: TÜBİTAK 2209-A Project Team
