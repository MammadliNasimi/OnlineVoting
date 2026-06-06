# OnlineVoting Architecture

## Overview

OnlineVoting is a **DAO-optimized blockchain voting system** designed for Web3 communities, not traditional government elections. It uses a **Credential-Issuer + Nullifier-Based Anonymity** model (NOT Zero-Knowledge Proof) to enable transparent, auditable voting while preserving voter privacy.

## Core Model: Credential + Nullifier Pattern

### Three-Party Model

```
┌──────────────────┐
│  Issuer (DAO)    │  Issues credentials (signatures)
│  Admin/Multi-Sig │  Sets voter eligibility rules
└────────┬─────────┘
         │
         ├─── Signs(emailHash, burnerAddress, electionID)
         │
         ▼
┌──────────────────┐
│  Participant     │  Submits vote using credential
│  (Voter/Peer)    │  Signs with burner wallet locally
└────────┬─────────┘
         │
         ├─── VoteProof = {credential, burnerSignature}
         │
         ▼
┌──────────────────────────────────────┐
│  Smart Contract (Blockchain)         │
│  Verifies both signatures             │
│  Checks nullifier for double voting   │
│  Records vote immutably               │
└──────────────────────────────────────┘
```

### Why NOT Zero-Knowledge Proof (ZKP)?

- **ZKP requires**: Circom circuits, trusted setup, witness generation, Groth16 proofs — high complexity
- **Our approach is simpler & sufficient**:
  - Nullifier = `hash(emailHash + electionID)` — deterministic, unique per voter per election
  - Email is hashed (salted), never stored on-chain
  - If voter tries to vote twice with same email in same election, nullifier is already marked as used
  - Prevents double voting ✓ while keeping email private ✓
- **Trade-off**: 
  - ❌ Issuer and backend know voters' emails (not fully decentralized)
  - ✅ Smart contract and blockchain observers only see hashes
  - ✅ DAO can rotate issuers or move to multi-sig governance for transparency

---

## System Components

### 1. Frontend (React, Vercel)

- **Burner Wallet**: One-time wallet generated per session in localStorage
- **EIP-712 Signing**: Client-side signing of VoteProof (no server sees private key)
- **Socket.io**: Real-time vote status updates (Submitted → Signed → Mined → Confirmed)
- **UI**: Simple voting interface + receipt download + result verification

**Key Files**:
- `src/LocalIdentity.js`: Burner wallet generation + EIP-712 signing
- `src/components/SimpleVoting.js`: Vote flow, socket listening
- `src/utils/analytics.js`: Privacy-friendly event tracking
- `src/i18n.js`: Multi-language support (Turkish focus)

### 2. Backend (Node.js, Express, Render)

**Responsibilities**:
1. **Authentication**: OTP via email or SIWE (Sign-In With Ethereum)
2. **Credential Issuance**: Signs credentials (emailHash, burnerAddress, electionID)
3. **Vote Queue**: Batches and processes votes asynchronously
4. **Relayer**: Pays gas fees, submits transactions to blockchain
5. **Receipt Generation**: Sends confirmation emails with txHash

**Key Services**:
- `auth.service.js`: OTP/SIWE login, session management
- `credentialIssuer.js`: Signing credentials (issuer role)
- `relayerService.js`: Ethereum transaction submission (gasless)
- `voteQueue.service.js`: Async vote processing, relayer submission
- `emailTemplates.js`: OTP, announcements, vote receipts

**Key Endpoints**:
- `POST /auth/register` → OTP → `POST /auth/verify-otp` → JWT session
- `GET /election/:id` → Election metadata, status
- `POST /election/:id/vote` → Accept VoteProof, queue vote
- `GET /election/:id/governance` *(new)* → Issuer address, multi-sig info
- `GET /api/verify-receipt/:txHash` *(new)* → Verify vote on-chain

**Database**: SQLite (off-chain metadata only)
- `users`: email, session, face descriptor (optional)
- `elections`: title, start/end time, blockchain contract address
- `votes`: email hash, election id, txHash (for receipt lookup)

### 3. Blockchain (Solidity, Sepolia Testnet)

**Contract**: `VotingSSI.sol` (note: name is legacy; functionality is Credential+Nullifier)

**Key Features**:
- **EIP-712 Dual Signature Verification**:
  1. Issuer signature: `sign(Credential(emailHash, burnerAddress, electionID))`
  2. Burner signature: `sign(Vote(candidateID, electionID, timestamp))`
- **Nullifier Storage**: `mapping(bytes32 => bool) usedNullifiers`
  - Prevents same voter from voting twice in same election
  - Does not reveal voter identity
- **Event Emission**: `VoteCast(electionID, candidateID, nullifier, timestamp)`
  - Indexed by nullifier for privacy (no email in event)
  - Allows external observers to count votes

**Access Model**:
- `Issuer` role (onlyIssuer): Can create elections, manage candidates
- No other roles needed (full nullifier-based anonymity model)

---

## Anonymity Model Explained

### On-Chain Storage (What's Visible)

```
Election {
  id: 1,
  title: "DAO Treasury Proposal Vote",
  startTime: 1234567890,
  endTime: 1234571490,
  candidates: [
    { id: 1, name: "Proposal A", voteCount: 42 },
    { id: 2, name: "Proposal B", voteCount: 38 }
  ]
}

VoteCast Events:
  nullifier: 0xabc123..., candidateID: 1, timestamp: 1234567900
  nullifier: 0xdef456..., candidateID: 2, timestamp: 1234567901
  (no email, no burner address, no personal info visible)
```

### Double-Voting Prevention

```
Voter 1 (alice@dao.xyz) tries to vote twice:
  Vote 1: nullifier = hash(hash(alice@dao.xyz) + electionID_1) → marked as used ✓
  Vote 2: nullifier = hash(hash(alice@dao.xyz) + electionID_1) → same hash, REJECTED ✗

Different election: nullifier = hash(hash(alice@dao.xyz) + electionID_2) → different hash, allowed ✓
```

### Privacy Guarantees

- ✅ **Email never on-chain**: Only salted hash is used
- ✅ **Burner address never on-chain**: Only nullifier appears
- ✅ **No vote-person linking**: Observers can't tell who voted for what
- ✅ **Receipt sent via email**: Only voter has proof of their own vote
- ⚠️ **Backend knows votes**: Issuer/Admin see email→nullifier mapping (offline database)
  - **Mitigation**: DAO can use separate infrastructure layers, key rotation, multi-sig issuer

---

## DAO Deployment Model

### Issuer Role Options

1. **Single Admin** (Simplest)
   - One address (DAO founder) signs credentials
   - Risk: Single point of failure
   - Use case: Small community pilot

2. **Multi-Sig Wallet** (Recommended for DAO)
   - `issuer` is a Gnosis Safe or multi-sig contract
   - 3-of-5 or N-of-M DAO members must approve each election
   - Credentials signed off-chain in batch

3. **On-Chain DAO Governance** (Advanced)
   - Election creation goes through DAO vote
   - Auto-issued credentials based on DAO membership proof
   - Requires integration with Snapshot/Governor/Aragon

### Voter Eligibility

**Option A**: Email-based
- Email domain whitelist (e.g., `*.dao.eth`, `*.op.eth`)
- Any email in that domain gets OTP

**Option B**: Wallet-based (SIWE)
- Sign-in with Ethereum: `wallet_requestSignatures()`
- Optional: Check wallet for NFT/token balance (membership proof)
- No email needed

**Option C**: Hybrid
- Email + wallet signature for extra verification
- Use case: High-stakes governance votes

---

## Transaction Flow (Step-by-Step)

### Happy Path: Successful Vote

```
1. Frontend: User enters email, requests OTP
   └─> Backend: sends OTP via email

2. Frontend: User enters OTP
   └─> Backend: validates OTP, creates JWT session

3. Frontend: User selects candidate, clicks "Vote"
   └─> Frontend: Creates burner wallet locally (in memory)
   └─> Frontend: Generates EIP-712 VoteProof with both signatures
       - Issuer sig: backend.credentialIssuer.sign(emailHash, burnerAddress, electionID)
       - Burner sig: burnerWallet.sign(candidateID, electionID, timestamp)

4. Frontend: Sends VoteProof to backend
   └─> Backend: Queues vote for relayer processing
   └─> Backend: emits Socket.io event: {status: "queued"}
   └─> Frontend: Shows "Vote queued..."

5. Backend (async): Relayer picks up vote from queue
   └─> Relayer: Submits VoteProof to smart contract via `vote(proof)`
   └─> Backend: Listens for tx receipt
   └─> Backend: emits Socket.io event: {status: "mined", txHash: "0x..."}

6. Smart Contract: Verifies both signatures + nullifier check
   └─> Contract: Records vote, marks nullifier as used
   └─> Contract: Emits VoteCast event

7. Frontend: Receives "mined" status
   └─> Shows "Vote confirmed!"
   └─> Displays receipt with txHash for manual verification

8. Backend: Sends confirmation email with receipt + txHash
   └─> Voter can verify vote on Etherscan using txHash
```

### Error Cases

| Error | Handling |
|-------|----------|
| Invalid OTP | Return error, allow retry (max 5 attempts) |
| Double vote (nullifier used) | Smart contract rejects, relayer logs, socket error |
| Relayer out of funds | Queue pauses, alert admin |
| Email delivery failed | Retry with backoff (Resend/SMTP fallback) |
| Network congestion | Relayer retries with higher gas price |

---

## Governance & Operations

### Election Lifecycle

```
DAO Vote Approved
        ↓
Admin creates election (setElection → blockchain)
        ↓
Email whitelist configured (if using email auth)
        ↓
Election opens (startTime reached)
        ↓
Voters cast votes (Socket.io updates in real-time)
        ↓
Election closes (endTime reached)
        ↓
Smart contract locks (no more votes accepted)
        ↓
Results computed & published
        ↓
Audit bundle exported (all txHashes, nullifiers, candidates)
        ↓
Stored indefinitely (blockchain + archive)
```

### Key Metrics to Monitor

- **Voter participation**: Unique nullifiers recorded
- **Vote success rate**: Accepted votes / submitted votes
- **Relayer health**: Gas price, tx confirmation time
- **Email delivery**: OTP sent / OTP bounced ratio
- **Double-vote attempts**: Nullifier collision detection

---

## Security Considerations

### Threats & Mitigations

| Threat | Mitigation |
|--------|-----------|
| **Email spoofing** | OTP verification ensures only email owner can register |
| **Private key theft (frontend)** | Burner wallet is ephemeral, never persisted; localStorage is not HSM-level secure but acceptable for voting |
| **Issuer compromise** | Rotate issuer to multi-sig or DAO governance; old credentials stay valid but new ones come from new issuer |
| **Relayer censorship** | Deploy multiple relayers; fallback to OpenGSN or user-funded gasless proxy |
| **Smart contract bugs** | Formal audit recommended before mainnet; use timelock + upgradeability (proxy pattern) |
| **Nullifier privacy** | Nullifiers are deterministic but salted; issuer only knows mapping. Recommend issuer key rotation per election for defense-in-depth |

---

## Comparison: This System vs. Other Models

| Model | Mechanism | Privacy | Decentralization | Complexity |
|-------|-----------|---------|------------------|-----------|
| **Our System (Credential+Nullifier)** | Email hash + EIP-712 sig | Nullifier hides identity ✓ | Issuer is bottleneck ⚠️ | Low-Medium |
| **True ZKP (Circom/Groth16)** | Witness generation + proof | Full zero-knowledge ✓✓ | Can be fully decentralized ✓✓ | Very High |
| **Ethereum Native (DAO token holders)** | ERC-20 balance check | No privacy ✗ | High ✓ | Low |
| **Snapshot Voting** | Off-chain voting, on-chain finality | Low privacy ✗ | Depends on multisig ⚠️ | Low |

**Our choice**: Sweet spot for DAO governance — simple to deploy, sufficient anonymity, relayer-based scalability.

---

## Deployment Checklist (DAO)

- [ ] Set issuer address (multi-sig or DAO founder)
- [ ] Configure email whitelist or SIWE auth
- [ ] Deploy VotingSSI.sol to Sepolia (or mainnet)
- [ ] Fund relayer with ETH for gas
- [ ] Set up backend environment: JWT_SECRET, VOTING_CONTRACT_ADDRESS, RELAYER_PRIVATE_KEY, BLOCKCHAIN_RPC_URL
- [ ] Configure SMTP or Resend for email delivery
- [ ] Test full flow: OTP → vote → blockchain confirmation
- [ ] Enable monitoring: txHash tracking, email delivery logs, queue metrics
- [ ] Publish audit endpoint: `/api/verify-receipt` for external verification
- [ ] Create governance docs: election timeline, dispute process, nullifier explanation

---

## Future Enhancements (Optional)

- [ ] Full ZKP integration (Circom circuits for email verification)
- [ ] SIWE primary auth (sign-in with wallet, no email)
- [ ] Multiple relayers with automatic failover (OpenGSN integration)
- [ ] Quadratic voting (adjust vote weight by quadratic function)
- [ ] Time-locked voting (vote encrypts until reveal phase)
- [ ] Batch verification: Merkle tree of votes for efficient off-chain proof
