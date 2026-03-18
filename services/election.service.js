const db = require('../config/database-sqlite');
const { ethers } = require('ethers');

class ElectionService {
    async getAllElections() {
        return db.getAllElections();
    }

    async createElectionOnChainAndDb(title, description, startDate, endDate, candidates, allowedDomains) {
        // Validation is already done in controller
        
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
        const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
        const contractAddress = process.env.VOTING_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS;
        
        // Load contract ABI
        const VotingSSI = require('../client/src/contracts/VotingAnonymous.json');
        const contract = new ethers.Contract(contractAddress, VotingSSI.abi, adminWallet);
        
        // Convert dates to Unix timestamps
        const startTime = Math.floor(new Date(startDate).getTime() / 1000);
        const endTime = Math.floor(new Date(endDate).getTime() / 1000);
        
        // Prepare candidate names
        const candidateNames = Array.isArray(candidates) ? candidates.filter(c => c && c.trim()) : [];
        if (candidateNames.length === 0) {
            throw new Error('At least one candidate required');
        }
        
        console.log('📝 Creating election on blockchain:', { title, startTime, endTime, candidateNames });
        
        // Call blockchain createElection
        const tx = await contract.createElection(title, startTime, endTime, candidateNames);
        await tx.wait();
        
        // Get the new election ID from blockchain
        const blockchainElectionId = await contract.currentElectionId();
        console.log('✅ Blockchain election created with ID:', blockchainElectionId.toString());
        
        // Wait slightly to let the indexer sync the event
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Find the election synced by the indexer
        const allElections = db.getAllElections();
        const syncedElection = allElections.find(e => e.blockchain_election_id === Number(blockchainElectionId));
        
        if (syncedElection) {
            // Update description that wasn't on-chain
            db.updateElection(syncedElection.id, syncedElection.title, description, syncedElection.start_date, syncedElection.end_date);
            
            // Add domain restrictions (off-chain metadata)
            if (Array.isArray(allowedDomains)) {
                for (const d of allowedDomains) {
                    if (d && d.trim()) db.addElectionDomainRestriction(syncedElection.id, d.trim());
                }
            }
            return db.getAllElections().find(e => e.id === syncedElection.id);
        } else {
            throw new Error('Election created on chain but indexer failed to sync');
        }
    }

    async updateElection(id, title, description, startDate, endDate) {
        return db.updateElection(id, title, description, startDate, endDate);
    }

    async deleteElection(id) {
        return db.deleteElection(id);
    }

    async toggleElectionActive(id) {
        return db.toggleElectionActive(id);
    }

    async addCandidateToElection(id, name, description) {
        return db.addCandidateToElection(id, name, description);
    }

    async removeCandidateFromElection(cid) {
        return db.removeCandidateFromElection(cid);
    }

    async updateCandidate(cid, name, description) {
        return db.updateCandidate(cid, name, description);
    }

    async getElectionDomainRestrictions(id) {
        return db.getElectionDomainRestrictions(id);
    }

    async addElectionDomainRestriction(id, domain) {
        return db.addElectionDomainRestriction(id, domain);
    }

    async removeElectionDomainRestriction(did) {
        return db.removeElectionDomainRestriction(did);
    }
}

module.exports = new ElectionService();