# Performance Benchmark Suite

This suite measures the performance of the E-Voting system across multiple scenarios.

## Metrics Collected

### 1. **Throughput**
- Votes per second
- Success rate
- Total duration

### 2. **Latency** (end-to-end: signature → blockchain confirmation)
- P50 (median)
- P95 (95th percentile)
- P99 (99th percentile)
- Min/Max

### 3. **Gas Costs**
- Average gas per vote (ETH)
- Total gas cost (ETH)
- Min/Max gas variation

### 4. **Relayer Overhead**
- Time from submission to blockchain confirmation

## Running Benchmarks

### Prerequisites

```bash
# Ensure environment is configured
cp backend/.env.example backend/.env

# Fill in:
# VOTING_RPC_URL=http://127.0.0.1:8545  # or Sepolia
# VOTING_CONTRACT_ADDRESS=0x...          # deployed contract
# ADMIN_PRIVATE_KEY=0x...                # issuer key
# RELAYER_PRIVATE_KEY=0x...              # relayer key
```

### Option A: Local Hardhat Network

```bash
# Terminal 1: Start hardhat node
cd blockchain
npx hardhat node

# Terminal 2: Deploy contract
npx hardhat run scripts/deploy-ssi.js --network localhost

# Terminal 3: Run benchmarks
cd ../backend
node scripts/load-test/measure-performance.js
```

### Option B: Sepolia Testnet

```bash
# Ensure contract is deployed on Sepolia
# Update .env with Sepolia RPC and addresses

cd backend
node scripts/load-test/measure-performance.js
```

### Option C: Docker Compose (recommended)

```bash
# (Optional) Build and run complete stack
docker-compose -f docker-compose.test.yml up

# Then in another terminal:
node scripts/load-test/measure-performance.js
```

## Interpreting Results

### Output Files

Each run generates:
- `reports/100-voters-YYYY-MM-DD-HH-MM-SS.json` - Raw measurements
- `reports/100-voters-YYYY-MM-DD-HH-MM-SS.csv` - Spreadsheet format
- `reports/summary-YYYY-MM-DD-HH-MM-SS.json` - Aggregated summary
- `reports/report-YYYY-MM-DD-HH-MM-SS.md` - Human-readable report
- `reports/analysis-YYYY-MM-DD-HH-MM-SS.json` - Analysis + recommendations

### Example: Reading Report

```bash
# Generate formatted report from latest results
node scripts/load-test/generate-report.js
```

### Sample Output

```
📊 THROUGHPUT (votes/second)

Scenario     | Votes/sec | Success Rate | Duration
─────────────┼───────────┼──────────────┼──────────
100-voters   | 45.23     | 100%         | 2.21s
500-voters   | 42.15     | 99.8%        | 11.85s
1k-voters    | 39.87     | 99.6%        | 25.07s
```

## Modifying Test Scenarios

Edit `measure-performance.js` → `TEST_SCENARIOS` array:

```javascript
const TEST_SCENARIOS = [
  { voters: 100, name: '100-voters' },
  { voters: 500, name: '500-voters' },
  { voters: 1000, name: '1k-voters' },
  { voters: 5000, name: '5k-voters' },  // Add new scenario
];
```

## Performance Targets (IEEE Paper Reference)

| Metric | Target | Status |
|--------|--------|--------|
| Throughput | >50 votes/sec | ✓ Testing |
| Latency P95 | <2000ms | ✓ Testing |
| Gas Cost | <0.01 ETH/vote | ✓ Testing |
| Success Rate | >99% | ✓ Testing |

## Troubleshooting

**Error: Contract not found**
```bash
# Re-deploy contract
cd blockchain
npx hardhat run scripts/deploy-ssi.js --network localhost
# Copy address to .env
```

**Error: Invalid signature**
```bash
# Ensure private keys match contract issuer/relayer addresses
node backend/test-issuer.js  # Verify issuer address
```

**Error: RPC connection failed**
```bash
# Check RPC URL in .env
# If using local hardhat: ensure `npx hardhat node` is running
```

## Next Steps

- [ ] Run full benchmark suite (100/500/1k voters)
- [ ] Save results in `reports/` directory
- [ ] Generate formatted report: `node generate-report.js`
- [ ] Compare against baseline (if re-running)
- [ ] Document findings in paper

---

**Last Updated:** 2026-06-06  
**Author:** Performance Test Suite  
**Version:** 1.0
