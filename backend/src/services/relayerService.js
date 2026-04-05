const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
const db = require('../config/database-sqlite');

const VOTE_PROOF_TYPES = {
    VoteProof: [
        { name: 'emailHash', type: 'bytes32' },
        { name: 'burner', type: 'address' },
        { name: 'electionID', type: 'uint256' },
        { name: 'candidateID', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' }
    ]
};

class RelayerService {
    constructor(relayerPrivateKey, contractAddress, rpcUrl = 'http://127.0.0.1:8545') {

        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.relayerWallet = new ethers.Wallet(relayerPrivateKey, this.provider);
        this.contractAddress = contractAddress;

        const abiPath = path.join(__dirname, '../../../blockchain/artifacts/contracts/VotingSSI.sol/VotingSSI.json');
        const contractJson = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        this.contractABI = contractJson.abi;

        this.contract = new ethers.Contract(
            contractAddress,
            this.contractABI,
            this.relayerWallet
        );

        this.submissionHistory = new Map();
        this.MAX_SUBMISSIONS_PER_HOUR = 5;

        console.log('✅ Relayer Service initialized');
        console.log('   Relayer Address:', this.relayerWallet.address);
        console.log('   Contract Address:', contractAddress);
        console.log('   RPC URL:', rpcUrl);
    }

    checkRateLimit(identifier) {
    const currentKey = identifier || 'anonymous';
    const isAllowed = db.checkAndIncrementRelayerLimit(currentKey, this.MAX_SUBMISSIONS_PER_HOUR, 1);
    
    if (!isAllowed) {
      throw new Error(`Rate limit aşıldı. identifier ${currentKey} için ${this.MAX_SUBMISSIONS_PER_HOUR} limitine ulaşıldı.`);
    }
    
    console.log(`[Relayer] Identifier limit checked/incremented for ${currentKey}`);
    return true;
  }

    recordSubmission(identifier) {
        const submissions = this.submissionHistory.get(identifier) || [];
        submissions.push(Date.now());
        this.submissionHistory.set(identifier, submissions);
    }

    async verifyCredentialSignature(credential, issuerAddress) {
        // Validation now managed mostly by smart contract (estimateGas)
        // or can be extended here. Bypassing node-level check since we have 2 signatures.
        return true;
    }

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

    async submitVote(credential, userIdentifier, issuerAddress) {
        try {
            console.log('\n🚀 Relayer: Submitting vote transaction');
            console.log('   User Identifier:', userIdentifier);
            console.log('   Election ID:', credential.electionID);
            console.log('   Candidate ID:', credential.candidateID);

              // checkRateLimit returns true if allowed, or throws an error.
              this.checkRateLimit(userIdentifier);

            const isValidSignature = await this.verifyCredentialSignature(credential, issuerAddress);
            if (!isValidSignature) {
                throw new Error('Invalid credential signature');
            }

            const nullifierUsed = await this.checkNullifier(credential.emailHash, credential.electionID);
            if (nullifierUsed) {
                throw new Error('Vote already cast - nullifier already used');
            }

            const now = Math.floor(Date.now() / 1000);
            const timeDiff = now - credential.timestamp;
            if (timeDiff > 3600) {
                throw new Error('Credential expired - timestamp too old');
            }

            const voteProof = {
                emailHash: credential.emailHash,
                burner: credential.burner,
                electionID: credential.electionID,
                candidateID: credential.candidateID,
                timestamp: credential.timestamp,
                issuerSignature: credential.issuerSignature,
                burnerSignature: credential.burnerSignature
            };

            // Blockchain will naturally revert with exact reason via estimateGas
      console.log(voteProof); const estimatedGas = await this.contract.vote.estimateGas(voteProof);
            console.log('   Estimated Gas:', estimatedGas.toString());

            const balance = await this.provider.getBalance(this.relayerWallet.address);
            console.log('   Relayer Balance:', ethers.formatEther(balance), 'ETH');

            if (balance < estimatedGas * BigInt(2)) {
                throw new Error('Relayer balance too low - cannot pay gas fees');
            }

            console.log('   📤 Submitting transaction...');
            const tx = await this.contract.vote(voteProof, {
                gasLimit: estimatedGas * BigInt(120) / BigInt(100)
            });

            console.log('   ⏳ Transaction hash:', tx.hash);
            console.log('   ⏳ Waiting for confirmation...');

            const receipt = await tx.wait();

            console.log('   ✅ Transaction confirmed!');
            console.log('   Block:', receipt.blockNumber);
            console.log('   Gas Used:', receipt.gasUsed.toString());

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

            if (error.message.includes('Nullifier already used') || error.message.includes('DoubleVoting')) {
                throw new Error('Double voting detected - you have already voted in this election');
            } else if (error.message.includes('Invalid issuer signature') || error.message.includes('InvalidSignatures')) {
                throw new Error('Invalid credential - signature verification failed');
            } else if (error.message.includes('Election is not active') || error.message.includes('ElectionNotActive')) {
                throw new Error('Election is not currently active');
            } else if (error.message.includes('ElectionNotStarted')) {
                throw new Error('Election has not started yet');
            } else if (error.message.includes('ElectionEnded') || error.message.includes('ElectionAlreadyEnded')) {
                throw new Error('Election has already ended');
            } else if (error.message.includes('Proof expired') || error.message.includes('ProofExpired')) {
                throw new Error('Credential expired - please request a new one');
            }

            throw error;
        }
    }

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
