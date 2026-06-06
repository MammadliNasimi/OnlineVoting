#!/usr/bin/env node
/**
 * Performance Measurement Suite for E-Voting System
 * 
 * Metrics:
 * - Throughput: votes/second
 * - Latency: p50, p95, p99 (signature → blockchain confirmation)
 * - Gas cost: per vote (Sepolia testnet)
 * - Relayer overhead: time between submission and confirmation
 * 
 * Output: CSV report + JSON results
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
// Check test mode early BEFORE loading env
const isTestMode = process.argv.includes('--test');

// Load .env: test mode uses backend/.env (Hardhat accounts), production uses root/.env (Sepolia)
const envPath = isTestMode 
  ? path.join(__dirname, '../../.env')  // backend/.env for test
  : path.join(__dirname, '../../../.env'); // root/.env for production
require('dotenv').config({ path: envPath });

// ============ CONFIG ============
console.log('📋 Process argv:', process.argv);
console.log('🧪 Test mode detected:', isTestMode);
console.log('📂 Loading .env from:', envPath);

// In test mode, always use local Hardhat node
const RPC_URL = isTestMode ? 'http://127.0.0.1:8545' : (process.env.VOTING_RPC_URL || process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545');
console.log('🔗 RPC URL:', RPC_URL);
const CONTRACT_ADDRESS = process.env.VOTING_CONTRACT_ADDRESS;
const ISSUER_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY; // Fallback to issuer key for local testing

if (!CONTRACT_ADDRESS || !ISSUER_PRIVATE_KEY) {
  console.error('❌ Missing required env vars: VOTING_CONTRACT_ADDRESS, ADMIN_PRIVATE_KEY');
  process.exit(1);
}

// TEST SCENARIOS
// Use --test flag for quick validation: npm run benchmark -- --test
const TEST_SCENARIOS = isTestMode ? [
  { voters: 10, name: '10-voters' },
  { voters: 50, name: '50-voters' }
] : [
  { voters: 100, name: '100-voters' },
  { voters: 500, name: '500-voters' },
  { voters: 1000, name: '1k-voters' }
];

const REPORT_DIR = path.join(__dirname, 'reports');
const TIMESTAMP = new Date().toISOString().replace(/:/g, '-').split('.')[0];

// ============ TYPES ============
const CREDENTIAL_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes('Credential(bytes32 emailHash,address burner,uint256 electionID)')
);

const VOTE_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes('Vote(uint256 candidateID,uint256 electionID,uint256 timestamp)')
);

// ============ STATE ============
class PerformanceTest {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.issuerWallet = new ethers.Wallet(ISSUER_PRIVATE_KEY, this.provider);
    this.relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, this.provider);
    
    // Find ABI file (handle path traversal properly)
    const abiPath = path.resolve(__dirname, '../../../blockchain/artifacts/contracts/VotingSSI.sol/VotingSSI.json');
    if (!fs.existsSync(abiPath)) {
      console.error(`❌ ABI file not found: ${abiPath}`);
      throw new Error('VotingSSI.json not found');
    }
    this.contractABI = require(abiPath).abi;
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, this.contractABI, this.issuerWallet);
    
    this.results = [];
    this.currentElectionId = null;
  }

  hashEmail(email) {
    const salt = 'ZKEMAIL_VOTING_SSI_2026';
    const normalized = email.trim().toLowerCase();
    return ethers.keccak256(ethers.toUtf8Bytes(normalized + salt));
  }

  async getDomain() {
    if (!this.cachedDomain) {
      const network = await this.provider.getNetwork();
      this.cachedDomain = {
        name: 'VotingSSI',
        version: '1.0',
        chainId: Number(network.chainId), // Dynamic: 31337 (Hardhat) or 11155111 (Sepolia)
        verifyingContract: CONTRACT_ADDRESS
      };
    }
    return this.cachedDomain;
  }

  async issueCredential(email, electionID, burnerAddress) {
    const emailHash = this.hashEmail(email);
    const domain = await this.getDomain();

    const credentialProof = {
      emailHash: emailHash,
      burner: burnerAddress,
      electionID: electionID
    };

    const types = {
      Credential: [
        { name: 'emailHash', type: 'bytes32' },
        { name: 'burner', type: 'address' },
        { name: 'electionID', type: 'uint256' }
      ]
    };

    try {
      const signature = await this.issuerWallet.signTypedData(domain, types, credentialProof);
      return { emailHash, signature };
    } catch (error) {
      console.error(`❌ Credential issuing failed for ${email}:`, error.message);
      throw error;
    }
  }

  async signVote(burnerWallet, candidateID, electionID) {
    const timestamp = Math.floor(Date.now() / 1000);
    const domain = await this.getDomain();

    const types = {
      Vote: [
        { name: 'candidateID', type: 'uint256' },
        { name: 'electionID', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' }
      ]
    };

    const message = { candidateID, electionID, timestamp };

    try {
      const signature = await burnerWallet.signTypedData(domain, types, message);
      return { signature, timestamp };
    } catch (error) {
      console.error(`❌ Vote signing failed:`, error.message);
      throw error;
    }
  }

  async setupElection() {
    const title = `Performance Test Election ${Date.now()}`;
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + 86400; // 24 hours

    try {
      const tx = await this.contract.createElection(
        title,
        startTime,
        endTime,
        ['Candidate A', 'Candidate B', 'Candidate C']
      );
      const receipt = await tx.wait();

      // Extract election ID from event
      const event = receipt.logs.find(log => {
        try {
          const parsed = this.contract.interface.parseLog(log);
          return parsed && parsed.name === 'ElectionCreated';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = this.contract.interface.parseLog(event);
        this.currentElectionId = Number(parsed.args[0]);
        console.log(`✅ Election created: ID ${this.currentElectionId}`);
        return this.currentElectionId;
      }
    } catch (error) {
      console.error('❌ Election setup failed:', error.message);
      throw error;
    }
  }

  async submitVote(emailHash, issuerSignature, burnerSignature, burnerAddress, candidateID, timestamp) {
    const relayerConnectedContract = this.contract.connect(this.relayerWallet);

    try {
      // Call vote() method with VoteProof struct
      const proof = {
        emailHash,
        burner: burnerAddress,  // field name is 'burner' not 'burnerAddress'
        electionID: this.currentElectionId,
        candidateID,
        timestamp,
        issuerSignature,
        burnerSignature
      };

      const gasEstimate = await relayerConnectedContract.vote.estimateGas(proof);

      const tx = await relayerConnectedContract.vote(proof);

      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.gasPrice;
      const gasCost = ethers.formatEther(gasUsed * gasPrice);

      return {
        txHash: tx.hash,
        gasUsed: Number(gasUsed),
        gasPrice: Number(gasPrice),
        gasCost: parseFloat(gasCost),
        confirmationTime: receipt.blockNumber
      };
    } catch (error) {
      console.error('❌ Vote submission failed:', error.message);
      throw error;
    }
  }

  async runVoterSimulation(voterCount) {
    console.log(`\n📊 Starting performance test: ${voterCount} voters`);
    
    const measurements = [];
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < voterCount; i++) {
      try {
        const email = `voter${i}@university.edu`;
        const burner = ethers.Wallet.createRandom();
        const candidateID = i % 3; // 3 candidates

        // 1. CREDENTIAL ISSUANCE (Issuer)
        const credentialStart = Date.now();
        const { emailHash, signature: issuerSig } = await this.issueCredential(
          email,
          this.currentElectionId,
          burner.address
        );
        const credentialTime = Date.now() - credentialStart;

        // 2. VOTE SIGNING (Voter - Burner)
        const votingStart = Date.now();
        const { signature: burnerSig, timestamp } = await this.signVote(
          burner,
          candidateID,
          this.currentElectionId
        );
        const votingTime = Date.now() - votingStart;

        // 3. SUBMIT TO BLOCKCHAIN (Relayer)
        const submitStart = Date.now();
        const submitResult = await this.submitVote(
          emailHash,
          issuerSig,
          burnerSig,
          burner.address,
          candidateID,
          timestamp
        );
        const submitTime = Date.now() - submitStart;

        const totalTime = credentialTime + votingTime + submitTime;

        measurements.push({
          voter_id: i,
          email,
          credential_time_ms: credentialTime,
          signing_time_ms: votingTime,
          blockchain_time_ms: submitTime,
          total_time_ms: totalTime,
          gas_used: submitResult.gasUsed,
          gas_price_wei: submitResult.gasPrice,
          gas_cost_eth: submitResult.gasCost,
          tx_hash: submitResult.txHash,
          timestamp: new Date().toISOString()
        });

        successCount++;

        if ((i + 1) % 10 === 0) {
          console.log(`  ✓ ${i + 1}/${voterCount} votes submitted (${successCount} success, ${failCount} failed)`);
        }
      } catch (error) {
        failCount++;
        console.log(`  ✗ Voter ${i} failed: ${error.message.substring(0, 50)}`);
      }
    }

    const endTime = Date.now();
    const totalDuration = (endTime - startTime) / 1000; // seconds
    const throughput = successCount / totalDuration;

    // Calculate statistics
    const latencies = measurements.map(m => m.total_time_ms).sort((a, b) => a - b);
    const gasCosts = measurements.map(m => m.gas_cost_eth);

    const stats = {
      scenario: `${voterCount}-voters`,
      timestamp: TIMESTAMP,
      total_voters: voterCount,
      successful_votes: successCount,
      failed_votes: failCount,
      success_rate: ((successCount / voterCount) * 100).toFixed(2) + '%',
      total_duration_seconds: totalDuration.toFixed(2),
      throughput_votes_per_second: throughput.toFixed(2),
      latency_p50_ms: latencies[Math.floor(latencies.length * 0.5)],
      latency_p95_ms: latencies[Math.floor(latencies.length * 0.95)],
      latency_p99_ms: latencies[Math.floor(latencies.length * 0.99)],
      latency_min_ms: Math.min(...latencies),
      latency_max_ms: Math.max(...latencies),
      latency_avg_ms: (latencies.reduce((a, b) => a + b) / latencies.length).toFixed(2),
      gas_cost_avg_eth: (gasCosts.reduce((a, b) => a + b) / gasCosts.length).toFixed(8),
      gas_cost_min_eth: Math.min(...gasCosts).toFixed(8),
      gas_cost_max_eth: Math.max(...gasCosts).toFixed(8),
      gas_cost_total_eth: gasCosts.reduce((a, b) => a + b).toFixed(8)
    };

    return { stats, measurements };
  }

  async run() {
    console.log('🚀 E-Voting System Performance Benchmark');
    console.log(`   RPC: ${RPC_URL}`);
    console.log(`   Contract: ${CONTRACT_ADDRESS}`);
    console.log(`   Scenarios: ${TEST_SCENARIOS.map(s => s.name).join(', ')}`);
    if (isTestMode) console.log('   Mode: TEST (quick validation)\n');
    else console.log('\n');

    // Ensure report directory exists
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }

    try {
      // Setup election
      await this.setupElection();

      // Run each scenario
      for (const scenario of TEST_SCENARIOS) {
        const { stats, measurements } = await this.runVoterSimulation(scenario.voters);
        this.results.push({ stats, measurements });

        // Save raw measurements as JSON
        const jsonPath = path.join(REPORT_DIR, `${scenario.name}-${TIMESTAMP}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify({ stats, measurements }, null, 2));
        console.log(`   📁 Saved: ${jsonPath}`);

        // Save as CSV
        const csvPath = path.join(REPORT_DIR, `${scenario.name}-${TIMESTAMP}.csv`);
        const csvHeader = Object.keys(measurements[0]).join(',');
        const csvRows = measurements.map(m => Object.values(m).join(','));
        fs.writeFileSync(csvPath, [csvHeader, ...csvRows].join('\n'));
        console.log(`   📁 Saved: ${csvPath}`);
      }

      // Generate summary report
      this.generateSummaryReport();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  generateSummaryReport() {
    const summaryPath = path.join(REPORT_DIR, `summary-${TIMESTAMP}.json`);
    const summary = {
      test_date: TIMESTAMP,
      scenarios: this.results.map(r => r.stats),
      total_votes: this.results.reduce((sum, r) => sum + r.stats.successful_votes, 0)
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`\n✅ Summary report saved: ${summaryPath}`);
    console.log('\n📈 Performance Summary:');
    this.results.forEach(result => {
      const s = result.stats;
      console.log(`\n  ${s.scenario}:`);
      console.log(`    ✓ Throughput: ${s.throughput_votes_per_second} votes/sec`);
      console.log(`    ✓ Latency P50: ${s.latency_p50_ms}ms | P95: ${s.latency_p95_ms}ms | P99: ${s.latency_p99_ms}ms`);
      console.log(`    ✓ Gas Cost: ${s.gas_cost_avg_eth} ETH/vote (avg) | Total: ${s.gas_cost_total_eth} ETH`);
      console.log(`    ✓ Success Rate: ${s.success_rate}`);
    });
  }
}

// ============ MAIN ============
(async () => {
  const test = new PerformanceTest();
  await test.run();
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
