# OnlineVoting v2: ZKP + SSI + Fully Decentralized Roadmap

## Executive Summary

Upgrade from **Credential-Issuer + Nullifier** (current) to **True ZKP + W3C SSI + DAO Governance**.

| Aspect | Current (v1) | Target (v2) |
|--------|--------------|------------|
| **Proof Model** | Nullifier hash + EIP-712 sig | ZKP (Groth16 via Circom) |
| **Identity** | Backend-issued credentials | Holder-controlled W3C DIDs + VCs |
| **Issuer** | Single wallet or multi-sig | Smart contract DAO governance |
| **Anonymity** | Email hash (issuer knows) | Full ZK proof (issuer doesn't verify) |
| **Relayer** | Single or few relayers | Decentralized network (OpenGSN or similar) |
| **Complexity** | Low-Medium | High |
| **Security** | Good for DAO | Excellent for public election |
| **Cost** | Low gas | Higher gas (ZK proofs are expensive) |

---

## Architecture Comparison

### v1 (Current): Credential + Nullifier
```
┌─ Voter ───────────────────────────────┐
│ Email + Burner Wallet (local)         │
│ Signs with burner                     │
└────────────────┬──────────────────────┘
                 │
                 ▼
┌─ Backend ─────────────────────────────┐
│ Issues credential: sign(emailHash)    │
│ Backend KNOWS voter email             │
└────────────────┬──────────────────────┘
                 │
                 ▼
┌─ Blockchain ──────────────────────────┐
│ Verifies EIP-712 + checks nullifier   │
│ Nullifier = hash(emailHash + eid)     │
│ Private info hashed, not ZK           │
└───────────────────────────────────────┘
```

### v2 (Target): ZKP + SSI + DAO
```
┌─ Voter ───────────────────────────────────────────────┐
│ DID (self-generated, e.g., did:key:z6M...)           │
│ Claims membership: has DAO token, verified email, etc │
│ Generates ZK proof locally (NO backend involvement)   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─ Issuer (Optional, Semi-trusted) ─────────────────────┐
│ W3C Verifiable Credential Issuer (e.g., DAO treasury) │
│ Signs VC (not email data, just claims/capabilities)   │
│ Signature stored on VC, not used for voting           │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─ Client Circuit Execution ────────────────────────────┐
│ Circom witness generation (email verification)        │
│ SnarkJS proof computation (Groth16)                   │
│ Merkle tree proof (token balance, membership)         │
│ Result: Zero-Knowledge Proof (voter identity hidden)  │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─ Blockchain ──────────────────────────────────────────┐
│ Groth16Verifier checks proof (no issuer signature)    │
│ Merkle tree root check (DAO membership)               │
│ Nullifier = hash(private inputs) — still unique/safe  │
│ NOBODY knows who voted                                │
└───────────────────────────────────────────────────────┘
```

---

## Phase 1: Infrastructure & Setup (Weeks 1–2)

### 1.1 Install ZKP Tooling

```bash
# Install Circom compiler
git clone https://github.com/iden3/circom.git
cd circom && cargo install --path circom

# Install SnarkJS (client-side proof generation)
npm install snarkjs

# Install zk-email (email verification circuits)
npm install @zk-email/core

# Install ethers-zk (ZK utilities)
npm install ethers-zk

# Optional: noir (alternative ZK language)
npm install noir
```

### 1.2 Project Structure (New Directories)

```
OnlineVoting/
├── circuits/                        # NEW
│   ├── email-verification.circom    # Email ownership proof
│   ├── membership-proof.circom      # DAO token balance check
│   ├── vote-nullifier.circom        # Nullifier generation (ZK)
│   └── BUILD_GUIDE.md
├── proofs/                          # NEW
│   ├── email-witness-generator.js   # Generate witness for email
│   └── membership-proof-gen.js      # Token balance proof
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── vc.controller.js     # NEW - VC issuance
│   │   │   └── governance.controller.js # NEW - DAO rules
│   │   └── services/
│   │       ├── vcIssuer.js          # NEW - W3C VC signing
│   │       └── daGovernance.js      # NEW - DAO logic
│   └── docker/
│       └── zk-worker.dockerfile     # NEW - Proof generation service
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── zkProof.js           # NEW - Client-side proof gen
│   │   │   └── did.js               # NEW - DID management
│   │   └── components/
│   │       └── ZKVotingFlow.js       # NEW - ZK-aware UI
└── blockchain/
    ├── contracts/
    │   ├── Groth16Verifier.sol       # NEW - Proof verification
    │   ├── DAOVoting.sol             # NEW - DAO-governed voting
    │   └── MerkleTree.sol            # NEW - Membership proof
```

### 1.3 Install Backend Dependencies

```bash
# Backend additions
cd backend && npm install \
  "@zk-email/core" \
  "snarkjs" \
  "circomlibjs" \
  "ethers-zk" \
  "did-resolver" \
  "did-key-resolver" \
  "@did-core/did-doc" \
  "@vc/core"  # W3C Verifiable Credentials library
```

---

## Phase 2: Circom Circuits (Weeks 2–4)

### 2.1 Email Verification Circuit

**File**: `circuits/email-verification.circom`

```circom
pragma circom 2.0;

include "../node_modules/circomlibjs/circuits/poseidon.circom";
include "../node_modules/@zk-email/core/circuits/rsa.circom";
include "../node_modules/@zk-email/core/circuits/email-verifier.circom";

template EmailVerification() {
    // Public inputs (known to verifier)
    signal input emailDomain;           // e.g., hash("@dao.eth")
    
    // Private inputs (hidden in proof)
    signal input emailAddress;
    signal input emailHeaderHash;
    signal input rsaSignature[256];     // RSA sig from email provider
    signal input rsaPublicKey[17];
    
    // Output
    signal output nullifier;
    signal output revealDomain;
    
    // Verify RSA signature on email header
    component emailVerifier = EmailVerifier();
    emailVerifier.emailHeaderHash <== emailHeaderHash;
    emailVerifier.rsaSignature <== rsaSignature;
    emailVerifier.rsaPublicKey <== rsaPublicKey;
    
    // Extract and verify domain from email
    component domainCheck = EmailDomainExtractor();
    domainCheck.emailAddress <== emailAddress;
    domainCheck.expectedDomainHash <== emailDomain;
    
    // Generate nullifier (deterministic per email + election)
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== emailAddress;
    nullifierHash.inputs[1] <== emailDomain;
    nullifier <== nullifierHash.out;
    
    // Reveal domain hash (for external verification)
    revealDomain <== emailDomain;
}

component main { public [emailDomain] } = EmailVerification();
```

**Compile**:
```bash
circom circuits/email-verification.circom --r1cs --wasm
```

### 2.2 Membership Proof Circuit (Token Balance)

**File**: `circuits/membership-proof.circom`

```circom
pragma circom 2.0;

include "../node_modules/circomlibjs/circuits/merkletree.circom";
include "../node_modules/circomlibjs/circuits/poseidon.circom";

template MembershipProof(treeDepth) {
    // Public inputs
    signal input merkleRoot;                // Published by DAO
    signal input nullifier;
    
    // Private inputs
    signal input leaf;                      // [address, balance, nonce]
    signal input leafIndex;
    signal input sibling[treeDepth];
    
    // Outputs
    signal output nullifierHash;
    
    // Verify Merkle proof
    component merkleTree = MerkleTreeChecker(treeDepth);
    merkleTree.leaf <== leaf;
    merkleTree.leaf_index <== leafIndex;
    merkleTree.siblings <== sibling;
    merkleTree.root <== merkleRoot;
    
    // Ensure leaf has required data
    signal leafParts[3];
    leafParts <== SplitLeaf(leaf);  // address, balance, nonce
    
    leafParts[1] > 0;  // Constraint: balance > 0 (has membership)
    
    // Generate nullifier hash (prevents double voting in same election)
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== leafParts[0];  // address
    nullifierHasher.inputs[1] <== leafParts[2];  // nonce (unique per election)
    nullifierHash <== nullifierHasher.out;
}

component main { public [merkleRoot, nullifier] } = MembershipProof(20);  // 20-level tree
```

### 2.3 Build & Generate Setup

```bash
cd circuits

# Compile circuits
circom email-verification.circom --r1cs --wasm --sym
circom membership-proof.circom --r1cs --wasm --sym

# Generate keys (using Powers of Tau ceremony)
snarkjs powersoftau new bn128 12 pot12_0000.ptau
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="Contribution 1"
snarkjs powersoftau prepare-phase2 pot12_0001.ptau pot12_final.ptau

# Setup for email-verification
snarkjs groth16 setup email-verification.r1cs pot12_final.ptau email_0000.zkey
snarkjs zkey contribute email_0000.zkey email_0001.zkey --name="email-verif"
snarkjs zkey verify email-verification.r1cs pot12_final.ptau email_0001.zkey

# Export verification key
snarkjs zkey export verificationkey email_0001.zkey email_vk.json

# Generate Solidity verifier
snarkjs zkey export solidityverifier email_0001.zkey Groth16Verifier.sol
```

---

## Phase 3: Solidity Smart Contracts (Weeks 3–4)

### 3.1 Groth16 Verifier (Auto-Generated)

**File**: `blockchain/contracts/Groth16Verifier.sol`

SnarkJS generates this automatically. It contains:
- `verify(bytes proof, uint[] inputs)` function
- BN128 elliptic curve operations
- Proof validation logic

### 3.2 DAO Voting Contract (New)

**File**: `blockchain/contracts/DAOVoting.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGroth16Verifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[4] memory inputs
    ) external view returns (bool);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint);
}

contract DAOVoting {
    // ========== TYPES ==========
    
    struct Election {
        uint256 id;
        string title;
        uint256 startTime;
        uint256 endTime;
        bytes32 merkleRoot;  // Membership tree root (updated by DAO)
        address[] candidates;
        uint256[] voteCount;
        bool finalized;
    }
    
    struct Proof {
        uint[2] a;
        uint[2][2] b;
        uint[2] c;
        uint[4] inputs;  // [merkleRoot, nullifier, electionID, ...]
    }
    
    // ========== STATE ==========
    
    IGroth16Verifier public verifier;
    IERC20 public daoToken;  // DAO token for membership
    
    mapping(uint256 => Election) public elections;
    mapping(uint256 => mapping(bytes32 => bool)) public usedNullifiers;  // electionID => nullifier => used
    
    bytes32[] public merkleRoots;  // Historical roots (updated by DAO)
    
    // ========== EVENTS ==========
    
    event VoteCast(uint256 indexed electionID, uint256 candidateID, bytes32 nullifier);
    event ElectionCreated(uint256 indexed electionID, string title, uint256 startTime, uint256 endTime);
    
    // ========== FUNCTIONS ==========
    
    constructor(address _verifier, address _daoToken) {
        verifier = IGroth16Verifier(_verifier);
        daoToken = IERC20(_daoToken);
    }
    
    /**
     * @notice Cast vote with ZK proof of DAO membership
     * @dev Proof proves: voter has DAO token balance + has not voted + merkle membership
     * @param proof ZK proof structure
     * @param electionID Which election
     * @param candidateID Which candidate
     */
    function vote(
        Proof calldata proof,
        uint256 electionID,
        uint256 candidateID
    ) external {
        Election storage election = elections[electionID];
        
        // Verify time window
        require(block.timestamp >= election.startTime, "Election not started");
        require(block.timestamp <= election.endTime, "Election ended");
        
        // Extract nullifier from proof (inputs[1])
        bytes32 nullifier = bytes32(proof.inputs[1]);
        
        // Check double voting
        require(!usedNullifiers[electionID][nullifier], "Already voted");
        
        // Verify ZK proof
        require(
            verifier.verifyProof(proof.a, proof.b, proof.c, proof.inputs),
            "Invalid proof"
        );
        
        // Mark nullifier as used
        usedNullifiers[electionID][nullifier] = true;
        
        // Record vote
        election.voteCount[candidateID]++;
        
        emit VoteCast(electionID, candidateID, nullifier);
    }
    
    /**
     * @notice Only DAO can create elections and manage merkle roots
     * @dev Called via DAO governance (e.g., multi-sig)
     */
    function createElection(
        uint256 _electionID,
        string memory _title,
        uint256 _startTime,
        uint256 _endTime,
        address[] memory _candidates,
        bytes32 _merkleRoot
    ) external onlyDAO {
        Election storage election = elections[_electionID];
        election.id = _electionID;
        election.title = _title;
        election.startTime = _startTime;
        election.endTime = _endTime;
        election.merkleRoot = _merkleRoot;
        election.candidates = _candidates;
        election.voteCount = new uint256[](_candidates.length);
        
        merkleRoots.push(_merkleRoot);
        
        emit ElectionCreated(_electionID, _title, _startTime, _endTime);
    }
    
    /**
     * @notice Finalize election results (only DAO)
     */
    function finalizeElection(uint256 _electionID) external onlyDAO {
        elections[_electionID].finalized = true;
    }
    
    // ========== GOVERNANCE ==========
    
    modifier onlyDAO() {
        // TODO: Implement DAO check (multi-sig, governor contract, etc)
        _;
    }
}
```

---

## Phase 4: Frontend & Client-Side Proof Generation (Weeks 4–6)

### 4.1 ZK Proof Service

**File**: `frontend/src/services/zkProof.js`

```javascript
import snarkjs from 'snarkjs';

const CIRCUIT_WASM = '/circuits/email-verification_js/email-verification.wasm';
const CIRCUIT_ZKEY = '/circuits/email-verification_0001.zkey';

/**
 * Generate ZK proof for email ownership
 * Runs entirely on client; no server involvement
 */
export async function generateEmailProof(emailAddress, emailHeader, daoToken) {
  try {
    console.log('🔐 Generating email ownership proof...');
    
    // Step 1: Create witness (private circuit inputs)
    const witness = {
      emailAddress: emailAddressToField(emailAddress),
      emailHeaderHash: emailHeader.hash,
      rsaSignature: emailHeader.rsaSignature,
      rsaPublicKey: emailHeader.publicKey,
      emailDomain: extractDomainHash(emailAddress),
    };
    
    // Step 2: Compute witness using WASM
    const { code, witness: computedWitness } = await snarkjs.wtns.calculate(
      witness,
      CIRCUIT_WASM
    );
    
    if (code !== 0) throw new Error('Witness calculation failed');
    
    // Step 3: Generate Groth16 proof
    const { proof, publicSignals } = await snarkjs.groth16.prove(
      CIRCUIT_ZKEY,
      computedWitness
    );
    
    console.log('✅ Proof generated:', proof);
    
    return {
      proof: formatProofForSolidity(proof),
      publicSignals,
      nullifier: publicSignals[0],  // First output
    };
  } catch (error) {
    console.error('❌ Proof generation failed:', error);
    throw error;
  }
}

/**
 * Generate membership proof (token balance + merkle tree)
 */
export async function generateMembershipProof(
  userAddress,
  userBalance,
  merkleTree,
  electionNonce
) {
  try {
    console.log('🌳 Generating membership proof...');
    
    // Step 1: Find position in merkle tree
    const leaf = hashLeaf([userAddress, userBalance, electionNonce]);
    const leafIndex = merkleTree.leaves.indexOf(leaf);
    const siblings = merkleTree.getProof(leafIndex);
    
    // Step 2: Create witness
    const witness = {
      leaf,
      leafIndex,
      siblings,
      merkleRoot: merkleTree.root,
      nullifier: snarkjs.bigInt(0),  // Placeholder
    };
    
    // Step 3: Prove
    const { proof, publicSignals } = await snarkjs.groth16.prove(
      MEMBERSHIP_ZKEY,
      witness
    );
    
    return {
      proof: formatProofForSolidity(proof),
      publicSignals,
    };
  } catch (error) {
    console.error('❌ Membership proof failed:', error);
    throw error;
  }
}

/**
 * Format proof for Solidity contract
 * Converts from snarkjs format to Solidity calldata format
 */
function formatProofForSolidity(proof) {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
  };
}

function emailAddressToField(email) {
  // Convert email to finite field element
  return snarkjs.bigInt(email.toLowerCase().charCodeAt(0) * 1000);
}

function extractDomainHash(email) {
  const domain = email.split('@')[1];
  return snarkjs.utils.stringifyBigInts(
    snarkjs.bigInt(snarkjs.utils.stringifyBigInts(domain))
  );
}

function hashLeaf(inputs) {
  return snarkjs.poseidon(inputs);
}
```

### 4.2 DID Management

**File**: `frontend/src/services/did.js`

```javascript
import * as didJwk from '@did-core/did-key';

/**
 * Generate self-sovereign DID (no central issuer)
 * User fully controls their identity
 */
export async function generateDID() {
  try {
    // Generate EdDSA key pair
    const keyPair = await didJwk.generateKeyPair('Ed25519');
    
    // Create DID
    const did = `did:key:${keyPair.publicKeyMultibase}`;
    
    // Store private key locally (browser localStorage, encrypted)
    localStorage.setItem('user_did_private_key', JSON.stringify(keyPair.privateKey));
    localStorage.setItem('user_did', did);
    
    console.log('✅ DID generated:', did);
    
    return {
      did,
      publicKey: keyPair.publicKey,
    };
  } catch (error) {
    console.error('❌ DID generation failed:', error);
    throw error;
  }
}

/**
 * Request and receive Verifiable Credential from issuer (DAO)
 * Issuer signs claims about the holder, holder controls it
 */
export async function requestVerifiableCredential(claims) {
  try {
    const did = localStorage.getItem('user_did');
    
    // Send DID + claim request to issuer
    const response = await fetch('/api/vc/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        did,
        claims,  // e.g., { membershipLevel: 'gold', joinDate: '2026-01-01' }
      }),
    });
    
    const vc = await response.json();
    
    // Store VC locally (holder controls it)
    localStorage.setItem('user_vc_' + vc.id, JSON.stringify(vc));
    
    console.log('✅ VC received:', vc);
    
    return vc;
  } catch (error) {
    console.error('❌ VC request failed:', error);
    throw error;
  }
}

/**
 * Sign and submit voting proof
 * Combines email proof + membership proof + DID signature
 */
export async function submitVoteWithZKProof(
  emailProof,
  membershipProof,
  electionID,
  candidateID
) {
  try {
    const did = localStorage.getItem('user_did');
    const privateKey = JSON.parse(localStorage.getItem('user_did_private_key'));
    
    // Prepare vote payload
    const votePayload = {
      electionID,
      candidateID,
      did,
      emailProof,
      membershipProof,
    };
    
    // Sign with DID
    const signature = await didJwk.sign(votePayload, privateKey);
    
    // Submit to blockchain (via relayer or direct)
    const response = await fetch('/api/vote/submit-zk-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        votePayload,
        signature,
        did,
      }),
    });
    
    const result = await response.json();
    console.log('✅ Vote submitted:', result.txHash);
    
    return result;
  } catch (error) {
    console.error('❌ Vote submission failed:', error);
    throw error;
  }
}
```

### 4.3 Updated React Component

**File**: `frontend/src/components/ZKVotingFlow.js`

```javascript
import React, { useState } from 'react';
import { generateEmailProof, generateMembershipProof } from '../services/zkProof';
import { generateDID, requestVerifiableCredential, submitVoteWithZKProof } from '../services/did';

export function ZKVotingFlow({ electionID, candidates }) {
  const [step, setStep] = useState('intro');
  const [did, setDID] = useState(null);
  const [proofLoading, setProofLoading] = useState(false);
  
  const handleGenerateDID = async () => {
    const newDID = await generateDID();
    setDID(newDID);
    setStep('request-vc');
  };
  
  const handleRequestVC = async () => {
    await requestVerifiableCredential({
      membershipProof: true,
      tokenBalance: '>0',
    });
    setStep('verify-email');
  };
  
  const handleVerifyEmail = async (email) => {
    setProofLoading(true);
    try {
      // Get email header (via service)
      const emailHeader = await getEmailHeader(email);
      
      // Generate ZK proof (client-side)
      const emailProof = await generateEmailProof(email, emailHeader);
      
      // Get DAO merkle tree
      const merkleTree = await getMerkleTree();
      const membershipProof = await generateMembershipProof(
        did.publicKey,
        100,  // user balance (example)
        merkleTree,
        electionID
      );
      
      // Submit vote
      await submitVoteWithZKProof(
        emailProof,
        membershipProof,
        electionID,
        0  // candidateID
      );
      
      setStep('confirmed');
    } finally {
      setProofLoading(false);
    }
  };
  
  return (
    <div className="zk-voting-flow">
      {step === 'intro' && (
        <>
          <h2>Zero-Knowledge Voting</h2>
          <p>Your identity is fully private. We'll prove your eligibility without revealing who you are.</p>
          <button onClick={handleGenerateDID}>Start (Generate DID)</button>
        </>
      )}
      
      {step === 'request-vc' && (
        <>
          <h2>Step 1: Request Verification</h2>
          <p>Your DID: {did?.did}</p>
          <button onClick={handleRequestVC}>Request VC from DAO</button>
        </>
      )}
      
      {step === 'verify-email' && (
        <>
          <h2>Step 2: Prove Email Ownership</h2>
          <input type="email" placeholder="your-email@dao.eth" />
          <button onClick={() => handleVerifyEmail('...')} disabled={proofLoading}>
            {proofLoading ? 'Generating ZK Proof...' : 'Verify & Vote'}
          </button>
        </>
      )}
      
      {step === 'confirmed' && (
        <>
          <h2>✅ Vote Confirmed</h2>
          <p>Your vote is recorded. Your identity remains private.</p>
        </>
      )}
    </div>
  );
}
```

---

## Phase 5: Backend VC Issuer (Week 4)

### 5.1 W3C VC Issuer Service

**File**: `backend/src/services/vcIssuer.js`

```javascript
import { v4 as uuid } from 'uuid';
import jwt from 'jsonwebtoken';

const VC_ISSUER_DID = process.env.VC_ISSUER_DID; // e.g., did:key:z6M...
const ISSUER_PRIVATE_KEY = process.env.ISSUER_PRIVATE_KEY;

/**
 * Issue W3C Verifiable Credential
 * Issuer signs claims, but does NOT control the vote
 * Holder (voter) uses VC + ZK proof for voting
 */
export async function issueVerifiableCredential(holderDID, claims) {
  const credentialId = `urn:uuid:${uuid()}`;
  
  // Create VC structure (W3C standard)
  const credential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://www.w3.org/2018/credentials/examples/v1',
    ],
    type: ['VerifiableCredential', 'MembershipCredential'],
    id: credentialId,
    issuer: VC_ISSUER_DID,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: holderDID,
      ...claims,  // e.g., { membershipLevel: 'active', joinDate: '...' }
    },
  };
  
  // Sign VC (issuer signature)
  const proof = jwt.sign(credential, ISSUER_PRIVATE_KEY, {
    algorithm: 'EdDSA',
    issuer: VC_ISSUER_DID,
  });
  
  return {
    ...credential,
    proof,  // JWT proof
  };
}

/**
 * Verify VC signature
 * Used by voter's client to confirm VC authenticity before voting
 */
export function verifyCredential(vc) {
  try {
    jwt.verify(vc.proof, ISSUER_PUBLIC_KEY, {
      algorithms: ['EdDSA'],
    });
    return true;
  } catch (error) {
    console.error('VC verification failed:', error);
    return false;
  }
}
```

---

## Phase 6: DAO Governance (Week 5)

### 6.1 Multi-Sig / Governor Contract

**File**: `blockchain/contracts/DAOGovernor.sol` (Skeleton)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/Governor.sol";

contract DAOGovernor is Governor {
    constructor(
        IVotes _token,
        TimelockController _timelock
    ) Governor("DAOVoting") GovernorSettings(
        1,      // voting delay: 1 block
        50400,  // voting period: 7 days
        100e18  // quorum: 100 tokens
    ) GovernorTimelockControl(_timelock) {}
    
    // Override required functions...
    
    /**
     * Propose new election
     * Anyone can propose if they have sufficient tokens
     */
    function proposeElection(
        uint256 electionID,
        string memory title,
        uint256 startTime,
        uint256 endTime,
        address[] memory candidates
    ) public {
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature(
            "createElection(uint256,string,uint256,uint256,address[],bytes32)",
            electionID, title, startTime, endTime, candidates, merkleRoot
        );
        propose(targets, values, calldatas, description);
    }
}
```

---

## Migration Path: v1 → v2

### Step-by-Step Migration

```
Week 1-2:  Install ZKP tooling + design circuits
           ├─ Test Circom compilation
           ├─ Generate test keys (powers of tau)
           └─ Validate circuit logic

Week 3-4:  Solidity contracts v2
           ├─ Deploy Groth16 verifier
           ├─ Deploy DAOVoting contract
           ├─ Test with mock proofs
           └─ Audit Solidity code

Week 4-5:  Frontend ZK integration
           ├─ Implement DID generation (did:key)
           ├─ Implement VC request/storage
           ├─ Client-side proof generation
           ├─ Test full E2E flow
           └─ UI/UX for ZK voting

Week 5:    Backend VC issuer
           ├─ Implement /api/vc/request endpoint
           ├─ VC signing + verification
           ├─ Holder-controlled storage
           └─ Test VC flow

Week 6:    DAO governance
           ├─ Deploy governor contract
           ├─ Test proposal → execution flow
           ├─ Integrate with election creation
           └─ Launch pilot

Parallel: Testing & Audit
         ├─ Unit tests (Solidity, JS)
         ├─ Integration tests (end-to-end)
         ├─ Security audit (Solidity + circuits)
         ├─ ZK circuit audit (external firm)
         └─ Mainnet readiness checklist
```

### Backwards Compatibility

- **v1 elections**: Keep running as-is (nullifier model)
- **v2 elections**: New elections use ZKP + SSI
- **Dual-stack**: Support both for migration period
- **Eventually**: Deprecate v1, mandatory v2

---

## Resource Requirements

### Compute

| Task | Hardware | Time |
|------|----------|------|
| Circom compilation | Standard laptop | 5 min |
| Witness generation | 4GB RAM, 2x cores | 10 sec per proof |
| Proof generation (Groth16) | 8GB RAM, 4x cores | 20 sec per proof |
| Powers of Tau ceremony | 16GB RAM, 8x cores | 30 min (parallel) |

### Storage

- Circuit WASM files: ~10 MB (per circuit)
- Zero key files (zkey): ~100 MB (per circuit)
- WASM on frontend: OK (brotli compressed to ~2 MB)
- Zkey: Server-side only (not sent to client)

### Dependencies

```json
{
  "circom": "^2.1.0",
  "snarkjs": "^0.7.x",
  "@zk-email/core": "^0.5.x",
  "ethers-zk": "^1.0.x",
  "did-resolver": "^4.x",
  "@did-core/did-doc": "^0.4.x",
  "@vc/core": "^0.1.x",
  "poseidon": "npm:@iden3/poseidon",
  "circomlibjs": "^0.1.x"
}
```

---

## Cost Analysis (Ethereum Mainnet)

| Operation | Gas | Cost (gwei=30) |
|-----------|-----|----------------|
| Groth16 proof verification | 280K | $0.008 |
| Merkle proof verification | 40K | $0.001 |
| Nullifier check + vote record | 50K | $0.001 |
| **Total per vote** | **370K** | **$0.010** |

**Comparison**: v1 = 15K gas ($0.0005), v2 = 370K gas ($0.010)
- **Trade-off**: Higher gas, but full privacy + decentralization

---

## Security Considerations

### ZKP-Specific Risks

| Risk | Mitigation |
|------|-----------|
| **Trusted Setup** | Use Phase 2-contributed Powers of Tau; multiple participants |
| **Circuit bugs** | Formal verification (Coq), peer review, external audit |
| **Proof forgery** | Groth16 is cryptographically secure if setup is honest |
| **Witness leakage** | Generate witness on client, never send to server |
| **Merkle tree collision** | Use Poseidon hash (ZK-friendly), verify tree on-chain |

### SSI-Specific Risks

| Risk | Mitigation |
|------|-----------|
| **Lost DID private key** | User backup/recovery (paper seed, encrypted backup) |
| **Fake VCs** | Verify issuer signature before using; maintain issuer whitelist |
| **VC replay** | Include nonce + election ID in VC |
| **DID impersonation** | Use public key infrastructure (DID registry) |

---

## Testing Checklist

- [ ] Circom circuits compile without errors
- [ ] Witness generation produces valid output
- [ ] Groth16 proofs verify on local test
- [ ] Solidity contracts pass unit tests
- [ ] End-to-end: DID generation → VC request → ZK proof → vote → blockchain
- [ ] Nullifier prevents double voting
- [ ] DAO governance proposal → election creation works
- [ ] Merkle tree verification works
- [ ] Edge cases: invalid proof, expired VC, missing DID

---

## Next Steps

1. **Immediate**: Set up Circom environment, compile test circuits
2. **This week**: Solidity v2 contracts + Groth16 verifier
3. **Next week**: Frontend ZK integration + DID generation
4. **Following week**: Backend VC issuer + end-to-end testing
5. **Final week**: DAO governance + pilot election

---

## References

- [Circom documentation](https://docs.circom.io/)
- [SnarkJS guide](https://github.com/iden3/snarkjs)
- [W3C Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model/)
- [did:key specification](https://w3c-ccg.github.io/did-method-key/)
- [Groth16 proof system](https://eprint.iacr.org/2016/260.pdf)
- [zkEmail circuits](https://github.com/zk-email-verify/zk-email-verify)
