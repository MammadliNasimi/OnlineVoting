const { ethers } = require('ethers');
const db = require('../config/database-sqlite');
const fs = require('fs');

class BlockchainIndexer {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
        this.contractAddress = process.env.VOTING_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS;
        
        try {
            const VotingSSI = require('../client/src/contracts/VotingAnonymous.json');
            this.contract = new ethers.Contract(this.contractAddress, VotingSSI.abi, this.provider);
            console.log("🛠️ Blockchain Indexer initialized for contract:", this.contractAddress);
        } catch (error) {
            console.error("❌ Failed to initialize indexer:", error);
        }
    }

    start() {
        if (!this.contract) return;

        console.log("🎧 Listening for ElectionCreated events...");
        this.contract.on("ElectionCreated", async (electionId, title, startTime, endTime, event) => {
            console.log(`📡 Event received: ElectionCreated (ID: ${electionId})`);

            try {
                // Determine if it exists already, or insert it.
                // In a true event-driven setup, indexer syncs the data.
                const eId = Number(electionId);
                const sDate = new Date(Number(startTime) * 1000).toISOString();
                const eDate = new Date(Number(endTime) * 1000).toISOString();
                
                // Fetch candidates directly from contract to populate our database properly
                let candidateCount = await this.contract.getCandidateCount(eId);
                let candidates = [];
                for(let i = 0; i < candidateCount; i++) {
                    const c = await this.contract.candidates(eId, i);
                    candidates.push({ name: c.name, blockchainId: i });
                }

                // Check if election exists, else create
                const all = db.getAllElections();
                const existing = all.find(e => e.blockchain_election_id === eId);
                if (!existing) {
                    const election = db.createElection(title, "Blockchain Synced", sDate, eDate, eId);
                    console.log(`✅ Synced Election ${eId} into local DB (ID: ${election.id})`);
                    
                    // Add candidates
                    for (const cand of candidates) {
                        db.addCandidateToElection(election.id, cand.name, '', cand.blockchainId);
                    }
                } else {
                    console.log(`⚠️ Election ${eId} already exists in local DB.`);
                }
            } catch (err) {
                console.error("❌ Error processing ElectionCreated event:", err);
            }
        });

        console.log("🎧 Listening for VoteCast events...");
        this.contract.on("VoteCast", async (electionId, candidateId, commitment, event) => {
            console.log(`📡 Event received: VoteCast (Election: ${electionId}, Candidate: ${candidateId})`);
            try {
                const bElectionId = Number(electionId);
                const bCandId = Number(candidateId);
                const txHash = event.log ? event.log.transactionHash : null;

                // Sync vote into votes table
                const candidate = db.db.prepare(
                    `SELECT id FROM candidates WHERE election_id = ? AND blockchain_candidate_id = ?`
                ).get(bElectionId, bCandId);
            
                if (candidate) {
                    // Check if already recorded to avoid duplicates (txHash constraint or similar)
                    const existingVote = db.db.prepare(
                        `SELECT id FROM votes WHERE transaction_hash = ?`
                    ).get(txHash);

                    if (!existingVote) {
                        db.db.prepare(
                            `INSERT INTO votes (election_id, candidate_id, commitment, transaction_hash)
                             VALUES (?, ?, ?, ?)`
                        ).run(bElectionId, candidate.id, commitment, txHash);
                        
                        db.db.prepare(
                            `UPDATE candidates SET vote_count = vote_count + 1 WHERE id = ?`
                        ).run(candidate.id);

                        console.log(`✅ Synced VoteCast into local DB for election ${bElectionId}`);
                    }
                }
            } catch (err) {
                console.error("❌ Error processing VoteCast event:", err);
            }
        });
    }
}

module.exports = BlockchainIndexer;
