const { ethers } = require('ethers');
require('dotenv').config();

const contractAddress = process.env.VOTING_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS;
const contractABI = require('./smart-contracts/artifacts/contracts/VotingSSI.sol/VotingSSI.json').abi;

async function checkBlockchainElections() {
  console.log('Contract Address:', contractAddress);
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const contract = new ethers.Contract(contractAddress, contractABI, provider);
  
  console.log('=== BLOCKCHAIN ELECTIONS ===\n');
  
  try {
    // Check election 1
    const election1 = await contract.elections(1);
    console.log('Election ID 1:');
    console.log('  Title:', election1.title);
    console.log('  Start Time:', new Date(Number(election1.startTime) * 1000).toISOString());
    console.log('  End Time:', new Date(Number(election1.endTime) * 1000).toISOString());
    console.log('  Is Active:', election1.isActive);
    console.log('  Now:', new Date().toISOString());
    console.log('  Now (Unix):', Math.floor(Date.now() / 1000));
    console.log('');
    
    // Check election 2
    try {
      const election2 = await contract.elections(2);
      console.log('Election ID 2:');
      console.log('  Title:', election2.title);
      console.log('  Start Time:', new Date(Number(election2.startTime) * 1000).toISOString());
      console.log('  End Time:', new Date(Number(election2.endTime) * 1000).toISOString());
      console.log('  Is Active:', election2.isActive);
    } catch (e) {
      console.log('Election ID 2: Does not exist');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkBlockchainElections();
