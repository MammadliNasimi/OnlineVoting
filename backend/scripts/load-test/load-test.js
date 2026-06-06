#!/usr/bin/env node
/**
 * Load Test Orchestrator
 * Simulates N concurrent voters and measures performance metrics
 * 
 * Usage:
 *   node load-test.js --count 1000 --concurrency 10 --api http://localhost:3000
 */

const VoterSimulator = require('./voter-simulator');
const MetricsCollector = require('./metrics');
const fs = require('fs');

// Parse CLI args
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    count: 100,          // number of voters
    concurrency: 5,      // concurrent requests
    api: 'http://localhost:3000',
    electionID: 1,
    candidateID: 1,
    chainId: 11155111,   // Sepolia
    contractAddress: process.env.VOTING_CONTRACT_ADDRESS || '0x62a8878de43d5d6fd9B199d92556843a57F39aae'
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count') config.count = parseInt(args[i + 1], 10);
    if (args[i] === '--concurrency') config.concurrency = parseInt(args[i + 1], 10);
    if (args[i] === '--api') config.api = args[i + 1];
    if (args[i] === '--electionID') config.electionID = parseInt(args[i + 1], 10);
    if (args[i] === '--candidateID') config.candidateID = parseInt(args[i + 1], 10);
  }

  return config;
}

// Concurrency controller: run tasks with max concurrent count
async function runConcurrent(tasks, concurrency) {
  const results = [];
  const running = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const promise = task()
      .then(result => {
        results[i] = result;
        const idx = running.indexOf(promise);
        if (idx > -1) running.splice(idx, 1);
      })
      .catch(error => {
        results[i] = { error: error.message };
        const idx = running.indexOf(promise);
        if (idx > -1) running.splice(idx, 1);
      });

    running.push(promise);

    if (running.length >= concurrency) {
      await Promise.race(running);
    }
  }

  await Promise.all(running);
  return results;
}

async function main() {
  const config = parseArgs();

  console.log(`\n${'='.repeat(70)}`);
  console.log('🚀 E-VOTING LOAD TEST');
  console.log(`${'='.repeat(70)}`);
  console.log(`Total Voters: ${config.count}`);
  console.log(`Concurrency: ${config.concurrency}`);
  console.log(`Backend API: ${config.api}`);
  console.log(`Election ID: ${config.electionID}`);
  console.log(`Candidate ID: ${config.candidateID}`);
  console.log(`Chain ID: ${config.chainId}`);
  console.log(`Contract: ${config.contractAddress}`);
  console.log(`${'='.repeat(70)}\n`);

  const simulator = new VoterSimulator(config.api);
  const metrics = new MetricsCollector(`load-test-${config.count}voters`);

  // Create voter tasks
  const tasks = [];
  for (let i = 0; i < config.count; i++) {
    tasks.push(async () => {
      const voterId = i + 1;
      try {
        const result = await simulator.castVote(
          voterId,
          config.electionID,
          config.candidateID,
          config.chainId,
          config.contractAddress
        );

        metrics.recordVote({
          voterId,
          latencyMs: result.latencyMs,
          gasUsed: result.gasUsed,
          success: result.success,
          error: result.error,
          burnerAddress: result.burnerAddress,
          transactionHash: result.transactionHash,
          blockNumber: result.blockNumber,
          timestamp: new Date().toISOString()
        });

        if (voterId % Math.max(1, Math.floor(config.count / 10)) === 0) {
          console.log(`Progress: ${voterId}/${config.count} voters completed`);
        }

        return result;
      } catch (error) {
        metrics.recordVote({
          voterId,
          latencyMs: 0,
          gasUsed: null,
          success: false,
          error: error.message,
          burnerAddress: '',
          transactionHash: null,
          blockNumber: null,
          timestamp: new Date().toISOString()
        });
        return { success: false, error: error.message };
      }
    });
  }

  // Run with concurrency control
  console.log(`Starting ${config.count} votes with ${config.concurrency} concurrent requests...\n`);
  await runConcurrent(tasks, config.concurrency);

  // Print and save results
  metrics.printSummary();
  metrics.saveCSV();
  metrics.saveJSON();

  console.log('\n✅ Load test completed!');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
