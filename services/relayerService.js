/**
 * @title Relayer Service
 * @description Gas-less transaction relayer for anonymous voting
 * 
 * This service:
 * - Accepts signed credentials from users
 * - Verifies credential validity
 * - Submits transactions on behalf of users using a relayer wallet
 * - Pays gas fees to preserve user anonymity
 * 
 * Benefits:
 * - Users don't need ETH for gas
 * - Transaction origin wallet != user identity wallet
 * - Enhanced anonymity protection
 * 
 * Security Considerations:
 * - Rate limiting per IP/user to prevent spam
 * - Gas price monitoring to prevent DoS attacks
 * - Credential signature verification before submission
 */

const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

class RelayerService {
    constructor(relayerPrivateKey, contractAddress, rpcUrl = 'http://127.0.0.1:8545') {
        // Initialize relayer wallet
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.relayerWallet = new ethers.Wallet(relayerPrivateKey, this.provider);
        this.contractAddress = contractAddress;
        
        // Load contract ABI
        const abiPath = path.join(__dirname, '../smart-contracts/artifacts/contracts/VotingSSI.sol/VotingSSI.json');
        const contractJson = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        this.contractABI = contractJson.abi;
        
        // Initialize contract instance
        this.contract = new ethers.Contract(
            contractAddress,
            this.contractABI,
            this.relayerWallet
        );
        
        // Rate limiting (simple in-memory implementation)
        this.submissionHistory = new Map(); // IP/userID -> array of timestamps
        this.MAX_SUBMISSIONS_PER_HOUR = 5;
        
        console.log('✅ Relayer Service initialized');
        console.log('   Relayer Address:', this.relayerWallet.address);
        console.log('   Contract Address:', contractAddress);
        console.log('   RPC URL:', rpcUrl);
    }
    
    /**
     * Check if user/IP has exceeded rate limit
     * @param {string} identifier - User ID or IP address
     * @returns {boolean} True if rate limit exceeded
     */
    checkRateLimit(identifier) {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        
        if (!this.submissionHistory.has(identifier)) {
            this.submissionHistory.set(identifier, []);
        }
        
        const userSubmissions = this.submissionHistory.get(identifier);
        
        // Clean old submissions
        const recentSubmissions = userSubmissions.filter(timestamp => timestamp > oneHourAgo);
        this.submissionHistory.set(identifier, recentSubmissions);
        
        if (recentSubmissions.length >= this.MAX_SUBMISSIONS_PER_HOUR) {
            console.log(`⚠️  Rate limit exceeded for ${identifier}`);
            return true;
        }
        
        return false;
    }
    
    /**
     * Record a submission for rate limiting
     * @param {string} identifier - User ID or IP address
     */
    recordSubmission(identifier) {
        const submissions = this.submissionHistory.get(identifier) || [];
        submissions.push(Date.now());
        this.submissionHistory.set(identifier, submissions);
    }
    
    /**
     * Verify credential signature before relaying
     * @param {Object} credential - The credential to verify
     * @param {string} issuerAddress - Expected issuer address
     * @returns {Promise<boolean>} True if valid
     */
    async verifyCredentialSignature(credential, issuerAddress) {
        try {
            // Reconstruct EIP-712 domain (should match contract)
            const domain = {
                name: 'VotingSSI',
                version: '1.0',
                chainId: (await this.provider.getNetwork()).chainId,
                verifyingContract: this.contractAddress
            };
            
            // EIP-712 types
            const types = {
                VoteProof: [
                    { name: 'emailHash', type: 'bytes32' },
                    { name: 'electionID', type: 'uint256' },
                    { name: 'candidateID', type: 'uint256' },
                    { name: 'timestamp', type: 'uint256' }
                ]
            };
            
            // Prepare data for verification
            const voteProof = {
                emailHash: credential.emailHash,
                electionID: BigInt(credential.electionID),
                candidateID: BigInt(credential.candidateID),
                timestamp: BigInt(credential.timestamp)
            };
            
            // Verify signature
            const recoveredAddress = ethers.verifyTypedData(
                domain,
                types,
                voteProof,
                credential.signature
            );
            
            const isValid = recoveredAddress.toLowerCase() === issuerAddress.toLowerCase();
            
            if (!isValid) {
                console.log('❌ Invalid credential signature');
                console.log('   Expected:', issuerAddress);
                console.log('   Recovered:', recoveredAddress);
            }
            
            return isValid;
            
        } catch (error) {
            console.error('❌ Error verifying credential:', error);
            return false;
        }
    }
    
    /**
     * Check if nullifier has already been used
     * @param {string} studentIDHash - Hashed student ID
     * @param {number} electionID - Election ID
     * @returns {Promise<boolean>} True if already used
     */
    async checkNullifier(emailHash, electionID) {
        try {
            const nullifier = ethers.keccak256(
                ethers.solidityPacked(['bytes32', 'uint256'], [emailHash, electionID])
            );
            
            const isUsed = await this.contract.usedNullifiers(nullifier);
            
            if (isUsed) {
                console.log('⚠️  Nullifier already used - double voting attempt detected');
            }
            
            return isUsed;
            
        } catch (error) {
            console.error('❌ Error checking nullifier:', error);
            throw error;
        }
    }
    
    /**
     * Submit vote transaction on behalf of user
     * @param {Object} credential - Signed credential
     * @param {string} userIdentifier - User ID or IP for rate limiting
     * @param {string} issuerAddress - Expected issuer address
     * @returns {Promise<Object>} Transaction result
     */
    async submitVote(credential, userIdentifier, issuerAddress) {
        try {
            console.log('\n🚀 Relayer: Submitting vote transaction');
            console.log('   User Identifier:', userIdentifier);
            console.log('   Election ID:', credential.electionID);
            console.log('   Candidate ID:', credential.candidateID);
            
            // 1. Check rate limit
            if (this.checkRateLimit(userIdentifier)) {
                throw new Error('Rate limit exceeded - please try again later');
            }
            
            // 2. Verify credential signature
            const isValidSignature = await this.verifyCredentialSignature(credential, issuerAddress);
            if (!isValidSignature) {
                throw new Error('Invalid credential signature');
            }
            
            // 3. Check if nullifier already used
            const nullifierUsed = await this.checkNullifier(credential.emailHash, credential.electionID);
            if (nullifierUsed) {
                throw new Error('Vote already cast - nullifier already used');
            }
            
            // 4. Check timestamp (credential should be recent)
            const now = Math.floor(Date.now() / 1000);
            const timeDiff = now - credential.timestamp;
            if (timeDiff > 3600) { // 1 hour
                throw new Error('Credential expired - timestamp too old');
            }
            
            // 5. Prepare VoteProof struct for contract call
            const voteProof = {
                emailHash: credential.emailHash,
                electionID: credential.electionID,
                candidateID: credential.candidateID,
                timestamp: credential.timestamp,
                signature: credential.signature
            };
            
            // 6. Estimate gas
            const estimatedGas = await this.contract.vote.estimateGas(voteProof);
            console.log('   Estimated Gas:', estimatedGas.toString());
            
            // 7. Check relayer balance
            const balance = await this.provider.getBalance(this.relayerWallet.address);
            console.log('   Relayer Balance:', ethers.formatEther(balance), 'ETH');
            
            if (balance < estimatedGas * BigInt(2)) {
                throw new Error('Relayer balance too low - cannot pay gas fees');
            }
            
            // 8. Submit transaction
            console.log('   📤 Submitting transaction...');
            const tx = await this.contract.vote(voteProof, {
                gasLimit: estimatedGas * BigInt(120) / BigInt(100) // 20% buffer
            });
            
            console.log('   ⏳ Transaction hash:', tx.hash);
            console.log('   ⏳ Waiting for confirmation...');
            
            // 9. Wait for confirmation
            const receipt = await tx.wait();
            
            console.log('   ✅ Transaction confirmed!');
            console.log('   Block:', receipt.blockNumber);
            console.log('   Gas Used:', receipt.gasUsed.toString());
            
            // 10. Record submission for rate limiting
            this.recordSubmission(userIdentifier);
            
            return {
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                relayerAddress: this.relayerWallet.address
            };
            
        } catch (error) {
            console.error('❌ Relayer error:', error);
            
            // Parse contract revert reasons
            if (error.message.includes('Nullifier already used')) {
                throw new Error('Double voting detected - you have already voted in this election');
            } else if (error.message.includes('Invalid issuer signature')) {
                throw new Error('Invalid credential - signature verification failed');
            } else if (error.message.includes('Election is not active')) {
                throw new Error('Election is not currently active');
            } else if (error.message.includes('Proof expired')) {
                throw new Error('Credential expired - please request a new one');
            }
            
            throw error;
        }
    }
    
    /**
     * Get relayer status information
     * @returns {Promise<Object>} Relayer status
     */
    async getStatus() {
        try {
            const balance = await this.provider.getBalance(this.relayerWallet.address);
            const network = await this.provider.getNetwork();
            
            return {
                relayerAddress: this.relayerWallet.address,
                balance: ethers.formatEther(balance),
                network: network.name,
                chainId: network.chainId.toString(),
                contractAddress: this.contractAddress,
                maxSubmissionsPerHour: this.MAX_SUBMISSIONS_PER_HOUR
            };
        } catch (error) {
            console.error('❌ Error getting relayer status:', error);
            throw error;
        }
    }
    
    /**
     * Clean old submission history (called periodically)
     */
    cleanOldHistory() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        for (const [identifier, timestamps] of this.submissionHistory.entries()) {
            const recent = timestamps.filter(ts => ts > oneHourAgo);
            if (recent.length === 0) {
                this.submissionHistory.delete(identifier);
            } else {
                this.submissionHistory.set(identifier, recent);
            }
        }
        
        console.log(`🧹 Cleaned submission history (${this.submissionHistory.size} active users)`);
    }
}

module.exports = RelayerService;
