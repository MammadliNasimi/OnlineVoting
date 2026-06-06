# ZKP nullifier prototype

This folder contains a minimal prototype for Adım 2 (ZKP Entegrasyonu).

Overview
- `circuits/nullifier.circom`: Simple Circom circuit that proves knowledge of `emailHash` such that `nullifier = emailHash + electionID`.

Build & Proof (local steps)
1. Install dependencies (you need `circom` and `snarkjs` installed):

```bash
# circom (see https://docs.circom.io/getting-started/installation/)
# snarkjs
npm install -g snarkjs
```

2. Compile circuit and generate keys (example using `circom` + `snarkjs`):

```bash
mkdir -p build
circom circuits/nullifier.circom --r1cs --wasm --sym -o build
# trusted setup (powers of tau) step (example):
snarkjs groth16 setup build/nullifier.r1cs pot12_final.ptau build/nullifier_0000.zkey
snarkjs zkey contribute build/nullifier_0000.zkey build/nullifier_final.zkey --name="contrib"
snarkjs zkey export verificationkey build/nullifier_final.zkey build/verification_key.json
```

3. Generate a proof (example):

```bash
node ../services/zkp/generate-nullifier-proof.js 0x1 1
```

Notes
- This circuit is a prototype and uses a simple arithmetic relation (not a secure hash). Replace with a hash-based construction (Poseidon/Keccak) for production.
- After generating `build/nullifier_final.zkey`, you can produce a Solidity verifier using `snarkjs zkey export solidityverifier build/nullifier_final.zkey ../../blockchain/contracts/Verifier.sol`
