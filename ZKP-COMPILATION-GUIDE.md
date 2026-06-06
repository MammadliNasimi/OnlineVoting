# ZK Proof Compilation Guide

**Status**: Circuit code ready (`backend/zkp/circuits/nullifier.circom`). Need to compile it to generate real ZK proofs.

---

## Quick Summary

The nullifier circuit is defined but **not compiled**. To generate real Groth16 proofs instead of mock proofs:

1. Compile circuit → `nullifier.wasm` + `nullifier.r1cs`
2. Generate proving key → `nullifier_final.zkey` (Powers of Tau)
3. Export verifier → `Verifier.sol` (Solidity contract)
4. Redeploy contract + regenerate proofs

---

## Option 1: Docker (Recommended - Windows Compatible) ✅

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed

### Steps

```bash
# 1. Navigate to project
cd "c:\Users\Nasimi\OneDrive - Akdeniz Üniversitesi\Masaüstü\OnlineVoting"

# 2. Create build directory
mkdir -p backend\zkp\build

# 3. Run circom in Docker
docker run --rm -v "%cd%\backend\zkp:/circuits" 0xparc/circom circom /circuits/circuits/nullifier.circom --r1cs --wasm --sym -o /circuits/build

# Expected output:
# - backend/zkp/build/nullifier.r1cs (constraint system)
# - backend/zkp/build/nullifier.wasm (witness generator)
# - backend/zkp/build/nullifier.sym (debug symbols)
```

**Next**: Jump to **Powers of Tau + Trusted Setup** below.

---

## Option 2: Online Compiler (Instant, Browser-Based)

### Steps

1. Go to [ZK-REPL](https://zkrepl.dev/)
2. Copy circuit from: `backend/zkp/circuits/nullifier.circom`
3. Paste into editor and compile
4. Download generated `.r1cs` and `.wasm` files
5. Save to `backend/zkp/build/`

**Note**: This is fastest but verify the output matches local compilation.

---

## Option 3: WSL (Windows Subsystem for Linux) + Rust

### Prerequisites
- [WSL 2](https://docs.microsoft.com/windows/wsl/install) with Ubuntu
- Rust toolchain: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

### Steps (inside WSL)
```bash
# Install circom from source
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
./target/release/circom /path/to/backend/zkp/circuits/nullifier.circom --r1cs --wasm -o /path/to/backend/zkp/build
```

---

## Powers of Tau + Trusted Setup

**Once circuit is compiled** (`nullifier.r1cs` + `nullifier.wasm` exist):

### 1. Download Powers of Tau (30 MB)
```bash
cd backend/zkp/build

# Download Phase 1 trusted setup (BN128 curve, 2^12 constraints)
curl -o pot12_final.ptau https://hermez.s3-eu-west-1.amazonaws.com/pot12_final.ptau
```

### 2. Groth16 Setup
```bash
# From backend/zkp/build:
npx snarkjs groth16 setup nullifier.r1cs pot12_final.ptau nullifier_0000.zkey
```

### 3. Phase 2 Contribution (Optional Security)
```bash
# Add a random contribution (simulates "your" contribution to randomness)
npx snarkjs zkey contribute nullifier_0000.zkey nullifier_final.zkey --name="My Contribution" --entropy="some random text"
```

### 4. Extract Verification Key
```bash
npx snarkjs zkey export verificationkey nullifier_final.zkey verification_key.json
```

### 5. Generate Solidity Verifier Contract
```bash
npx snarkjs zkey export solidityverifier nullifier_final.zkey ../../blockchain/contracts/Verifier.sol
```

**Output**: `Verifier.sol` with real BN128 curve verification logic

---

## Redeploy Contracts

```bash
cd blockchain
npx hardhat run scripts/deploy-ssi.js --network localhost
```

This deploys the **real Verifier** contract. Update `.env`:

```env
VOTING_CONTRACT_ADDRESS=0x<new_voting_address>
VERIFIER_ADDRESS=0x<new_verifier_address>
```

---

## Verify Real Proofs Are Generated

```bash
cd backend
node scripts/load-test/measure-performance.js --test
```

Expected output:
```
✅ Real ZK proof generated (circuit not compiled; real proof after: snarkjs zkey export)
```

Should change to:
```
✅ Real ZK proof generated
```

And `zkp_time_ms` will be 100-500ms (vs 5-10ms for mock).

---

## File Structure After Compilation

```
backend/zkp/
├── circuits/
│   └── nullifier.circom          [WRITTEN]
├── build/
│   ├── nullifier.r1cs            [COMPILED]
│   ├── nullifier.wasm            [COMPILED]
│   ├── nullifier_final.zkey       [GENERATED]
│   ├── verification_key.json      [EXPORTED]
│   └── pot12_final.ptau           [DOWNLOADED]
└── README.md
```

---

## Troubleshooting

### "Circuit not found" error
- Verify `backend/zkp/build/nullifier.wasm` exists
- Check file paths are absolute or relative correctly

### Powers of Tau download fails
- Use proxy or download manually: https://hermez.s3-eu-west-1.amazonaws.com/pot12_final.ptau
- Save to `backend/zkp/build/pot12_final.ptau`

### Verifier contract fails to deploy
- Run: `npx hardhat compile` to verify Solidity syntax
- Check that Verifier.sol was properly generated (should be ~1500 lines)

### Mock proofs still generated after compilation
- Delete `backend/services/zkp/proofGenerator.js` cache or restart Node
- Verify `backend/zkp/build/nullifier.wasm` exists

---

## Timeline

| Step | Duration | Notes |
|------|----------|-------|
| Compile circuit (Docker) | 2-3 min | Fastest option |
| Download Powers of Tau | 2-3 min | One-time, 30 MB |
| Trusted setup | 5-10 min | Groth16 computation |
| Redeploy contract | 1-2 min | Update addresses in .env |
| Verify with benchmark | 5-10 min | Run test suite |

**Total**: ~20-30 minutes for real proofs

---

## Performance Impact

| Metric | Mock Proof | Real Proof |
|--------|-----------|-----------|
| Generation time | 5-10 ms | 100-500 ms |
| Proof size | Small (fake) | 288 bytes (Groth16) |
| Verification time | <1 ms (stub) | 5-10 ms (real BN128) |
| Security | None (testing) | Cryptographic ZK proof |

---

## Next Steps

1. **Now**: Choose compilation method (Docker recommended)
2. **After compilation**: Run powers of tau setup
3. **Then**: Redeploy contracts with real verifier
4. **Finally**: Run benchmark test to measure real proof performance

**Recommendation**: Start with **Option 1 (Docker)** - requires no local Rust/Cargo installation, works on Windows, and is the most reproducible.
