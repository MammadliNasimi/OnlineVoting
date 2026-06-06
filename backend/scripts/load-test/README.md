# Load Test & Benchmark Documentation

## Overview
This directory contains performance benchmarking tools for the OnlineVoting e-voting system. The load test simulates concurrent voters and measures:

- **Throughput**: votes/sec
- **Latency**: submission → on-chain confirmation (p50, p95, p99)
- **Gas Usage**: per-vote cost
- **Success Rate**: pass/fail ratio

## Quick Start

### Prerequisites
1. Backend running: `npm start` (port 3000)
2. Blockchain node running (local Hardhat or Sepolia)
3. Contract deployed and environment variables set

### Run Load Test

```bash
# 100 votes, 5 concurrent
node load-test.js --count 100 --concurrency 5

# 1000 votes, 10 concurrent, custom election
node load-test.js --count 1000 --concurrency 10 --electionID 1 --candidateID 1

# 10k votes, 20 concurrent (full benchmark)
node load-test.js --count 10000 --concurrency 20 --api http://localhost:3000
```

### Output

Results are saved in `reports/`:
- **CSV**: `results-load-test-1000voters-TIMESTAMP.csv` (raw metrics per voter)
- **JSON**: `results-load-test-1000voters-TIMESTAMP.json` (stats summary + metrics)

Console output:
```
======================================================================
📊 PERFORMANCE METRICS SUMMARY
======================================================================
Test Name: load-test-1000voters
Total Votes: 1000 (Success: 998, Failed: 2)
Success Rate: 99.80%
Throughput: 45.32 votes/sec

⏱️  Latency (ms):
   Min: 234
   Avg: 1456.21
   P50: 1200
   P95: 2450
   P99: 3100
   Max: 4200

⛽ Gas Used:
   Total: 45230000
   Avg/vote: 45304
   Min: 45000
   Max: 46000

⏳ Elapsed Time: 22.05s
```

## Components

### `metrics.js`
Collects and reports metrics:
- Latency per vote
- Gas usage
- Success/failure counts
- Percentile calculations (p50, p95, p99)
- CSV/JSON export

### `voter-simulator.js`
Simulates individual voter behavior:
- Creates random burner wallet
- Signs EIP-712 Vote message
- Submits to backend API
- Returns latency + gas data

### `load-test.js`
Orchestrates concurrent test execution:
- Spawns N voter tasks
- Controls concurrency pool
- Collects metrics
- Saves reports

## Configuration

### Environment Variables
```bash
export VOTING_CONTRACT_ADDRESS=0x62a8878de43d5d6fd9B199d92556843a57F39aae
export REACT_APP_CHAIN_ID=11155111
```

### CLI Arguments
- `--count N`: Number of voters (default: 100)
- `--concurrency N`: Max concurrent requests (default: 5)
- `--api URL`: Backend API URL (default: http://localhost:3000)
- `--electionID N`: Election ID (default: 1)
- `--candidateID N`: Candidate ID (default: 1)
- `--chainId N`: Blockchain chain ID (default: 11155111)
- `--contractAddress ADDR`: Smart contract address

## Example Results Analysis

### Baseline (100 voters, 5 concurrent)
```
Throughput: 18.5 votes/sec
Avg Latency: 1200ms
Success Rate: 100%
Avg Gas: 45,304 per vote
```

### Scaled (10,000 voters, 20 concurrent)
```
Throughput: 42.3 votes/sec
Avg Latency: 1850ms
Success Rate: 99.8%
Avg Gas: 45,500 per vote (slight increase due to queue delay)
```

## Academic Use

For IEEE/academic papers, include:

1. **Method**: "Load testing simulated N concurrent voters on Sepolia testnet"
2. **Metrics Table**:
   | Test | Voters | Concurrency | Throughput | Avg Latency | P95 Latency | Success Rate |
   |------|--------|-------------|-----------|-------------|------------|--------------|
   | Baseline | 100 | 5 | 18.5 | 1200ms | 1800ms | 100% |
   | Medium | 1000 | 10 | 32.1 | 1450ms | 2200ms | 99.9% |
   | Heavy | 10000 | 20 | 42.3 | 1850ms | 2900ms | 99.8% |

3. **Figures**:
   - Latency distribution (histogram)
   - Throughput vs concurrency (line chart)
   - Gas usage box plot
   - Success rate by load

## Troubleshooting

### Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```
→ Ensure backend is running: `npm start` in `/backend`

### Vote Failures (>5%)
```
Error: Election not found / Invalid candidate
```
→ Check election/candidate IDs match current DB state

### Out of Memory
```
JavaScript heap out of memory
```
→ Reduce `--count` or `--concurrency`, or increase Node heap:
```bash
node --max-old-space-size=4096 load-test.js --count 50000
```

## Next Steps

- Integrate with CI/CD (GitHub Actions) for regression testing
- Compare results across different networks (testnet vs mainnet)
- Test with ZKP-enabled contract variant
- Measure mobile client performance (signing time)

---
Generated for IEEE paper: "Blockchain-Based E-Voting with Credential Issuance and Nullifier Mechanism"
