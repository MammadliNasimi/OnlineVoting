const { ethers } = require('ethers');
require('dotenv').config();

// Configuration for Blockchain Provider (e.g., Hardhat local node or Sepolia)
// For skeleton, we use a mock or connect to local hardhat node if running
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Admin/Relayer wallet key
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// ABI should be imported from artifacts after compilation
// For skeleton, we use a minimal ABI matching Voting.sol
const ABI = [
  "function vote(uint _electionId, uint _candidateId) public",
  "function getResults(uint _electionId) public view returns (string[] memory, uint[] memory)",
  "event Voted(uint electionId, address voter, uint candidateId)"
];

let provider;
let wallet;
let contract;

try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    if (PRIVATE_KEY) {
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        if (CONTRACT_ADDRESS) {
            contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
        }
    }
} catch (e) {
    console.warn("Blockchain provider init failed (expected if no node running):", e.message);
}

exports.submitVote = async (electionId, candidateId) => {
    if (!contract) {
        console.log(`[MOCK] Voting for election ${electionId}, candidate ${candidateId} on Blockchain`);
        return "0xMOCK_TRANSACTION_HASH_" + Date.now();
    }

    const tx = await contract.vote(electionId, candidateId);
    await tx.wait();
    return tx.hash;
};

exports.getResults = async (electionId) => {
    if (!contract) {
        return {
            candidates: ['Alice', 'Bob'],
            votes: [10, 5] // Mock results
        };
    }
    const [candidates, voteCounts] = await contract.getResults(electionId);
    // Convert BigInts to numbers
    const votes = voteCounts.map(v => Number(v));
    return { candidates, votes };
};
