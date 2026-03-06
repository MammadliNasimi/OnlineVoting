/**
 * @title Credential Issuer Service
 * @description Issues verifiable credentials for eligible voters using EIP-712 signatures
 * 
 * This service acts as the "Issuer" in the SSI model:
 * - Verifies student eligibility (database check)
 * - Creates hashed student ID (preserves privacy)
 * - Signs VoteProof using EIP-712 standard
 * - Returns verifiable credential to student (Holder)
 * 
 * Architecture:
 * Issuer (This Service) → Holder (Student) → Verifier (Smart Contract)
 */

const { ethers } = require('ethers');
const crypto = require('crypto');

// EIP-712 types for VoteProof — single source of truth (shared with relayerService)
const VOTE_PROOF_TYPES = {
    VoteProof: [
        { name: 'emailHash', type: 'bytes32' },
        { name: 'electionID', type: 'uint256' },
        { name: 'candidateID', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' }
    ]
};

class CredentialIssuer {
    constructor(issuerPrivateKey, contractAddress, chainId = 31337) {
        // Initialize issuer wallet
        this.issuerWallet = new ethers.Wallet(issuerPrivateKey);
        this.contractAddress = contractAddress;
        this.chainId = chainId;
        
        // EIP-712 Domain
        this.domain = {
            name: 'VotingSSI',
            version: '1.0',
            chainId: chainId,
            verifyingContract: contractAddress
        };
        
        // EIP-712 Types for VoteProof (ZK-Email model)
        this.types = VOTE_PROOF_TYPES;
        
        console.log('✅ Credential Issuer initialized');
        console.log('   Issuer Address:', this.issuerWallet.address);
        console.log('   Contract Address:', contractAddress);
        console.log('   Chain ID:', chainId);
    }
    
    /**
     * Hash email address for ZK-Email privacy model.
     * The email is never stored on-chain — only its keccak256 hash (nullifier seed).
     * @param {string} email - Email address (e.g. ogrenci@akdeniz.edu.tr)
     * @returns {string} bytes32 hex hash used as nullifier seed
     */
    hashEmail(email) {
        // Add domain salt to prevent rainbow table attacks
        const salt = 'ZKEMAIL_VOTING_SSI_2026';
        const normalized = email.trim().toLowerCase();
        return ethers.keccak256(ethers.toUtf8Bytes(normalized + salt));
    }
    
    /**
     * Issue a verifiable credential for voting
     * @param {string} studentID - Student's ID (will be hashed)
     * @param {number} electionID - Election identifier
     * @param {number} candidateID - Chosen candidate
     * @returns {Promise<Object>} Signed credential
     */
    /**
     * Issue a ZK-Email verifiable credential for voting.
     * The email is hashed before being included — never stored on-chain.
     * @param {string} email - Voter's verified email (domain must be whitelisted)
     * @param {number} electionID - Election identifier
     * @param {number} candidateID - Chosen candidate
     * @returns {Promise<Object>} Signed EIP-712 credential
     */
    async issueVoteCredential(email, electionID, candidateID) {
        try {
            // 1. Hash email (ZK-Email: only hash goes into credential, never raw email)
            const emailHash = this.hashEmail(email);
            
            // 2. Create timestamp (credential validity)
            const timestamp = Math.floor(Date.now() / 1000);
            
            // 3. Create VoteProof data
            const voteProof = {
                emailHash: emailHash,
                electionID: BigInt(electionID),
                candidateID: BigInt(candidateID),
                timestamp: BigInt(timestamp)
            };
            
            console.log('\n📝 Issuing ZK-Email Credential:');
            console.log('   Email Hash:', emailHash, '(email redacted)');
            console.log('   Election ID:', electionID);
            console.log('   Candidate ID:', candidateID);
            console.log('   Timestamp:', timestamp);
            
            // 4. Sign using EIP-712
            const signature = await this.issuerWallet.signTypedData(
                this.domain,
                this.types,
                voteProof
            );
            
            console.log('   ✅ Signature created:', signature);
            
            // 5. Return verifiable credential
            return {
                credential: {
                    emailHash: emailHash,
                    electionID: electionID,
                    candidateID: candidateID,
                    timestamp: timestamp,
                    signature: signature
                },
                issuer: this.issuerWallet.address,
                issuedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error issuing credential:', error);
            throw error;
        }
    }
    
    /**
     * Issue authorization credential (without candidate choice)
     * Used when student requests permission to vote
     * @param {string} studentID - Student's ID
     * @param {number} electionID - Election identifier
     * @returns {Object} Authorization token
     */
    async issueAuthorizationToken(email, electionID) {
        try {
            const emailHash = this.hashEmail(email);
            const timestamp = Math.floor(Date.now() / 1000);
            
            console.log('\n🎫 Issuing ZK-Email Authorization Token:');
            console.log('   Email Hash:', emailHash);
            console.log('   Election ID:', electionID);
            
            return {
                emailHash: emailHash,
                electionID: electionID,
                timestamp: timestamp,
                issuer: this.issuerWallet.address,
                validUntil: timestamp + 3600 // Valid for 1 hour
            };
            
        } catch (error) {
            console.error('❌ Error issuing authorization:', error);
            throw error;
        }
    }
    
    /**
     * Verify a credential signature (for testing)
     * @param {Object} credential - The credential to verify
     * @returns {Promise<boolean>} True if signature is valid
     */
    async verifyCredential(credential) {
        try {
            const voteProof = {
                emailHash: credential.emailHash,
                electionID: BigInt(credential.electionID),
                candidateID: BigInt(credential.candidateID),
                timestamp: BigInt(credential.timestamp)
            };
            
            const recoveredAddress = ethers.verifyTypedData(
                this.domain,
                this.types,
                voteProof,
                credential.signature
            );
            
            const isValid = recoveredAddress.toLowerCase() === this.issuerWallet.address.toLowerCase();
            console.log('\n🔍 Credential Verification:');
            console.log('   Expected:', this.issuerWallet.address);
            console.log('   Recovered:', recoveredAddress);
            console.log('   Valid:', isValid);
            
            return isValid;
            
        } catch (error) {
            console.error('❌ Error verifying credential:', error);
            return false;
        }
    }
    
    /**
     * Get domain separator (for debugging)
     * @returns {Object} EIP-712 domain
     */
    getDomain() {
        return this.domain;
    }
    
    /**
     * Get issuer address
     * @returns {string} Issuer's Ethereum address
     */
    getIssuerAddress() {
        return this.issuerWallet.address;
    }
}

module.exports = CredentialIssuer;
