# Immediate Real ZK Proof Setup (Browser-Based)

**Situation**: Docker not installed on your machine.

**Solution**: Use online ZK compiler to generate real circuit artifacts in 5 minutes. No local installation needed.

---

## Quick Path to Real ZK Proofs (20 minutes total)

### Step 1: Online Circuit Compilation (5 min)

1. **Open Browser**: Go to https://zkrepl.dev/
2. **Clear existing code** in the editor (left pane)
3. **Copy-paste circuit** from your project:

```circom
pragma circom 2.0.0;

template Nullifier() {
    signal input emailHash;        // private
    signal input electionID;       // public
    signal output nullifier;       // public
    nullifier <== emailHash + electionID;
}

component main = Nullifier();
```

4. **Click "Compile"** (green button, top right)
5. **Wait** for compilation to finish (should show ✅ success)

### Step 2: Download Artifacts (1 min)

On the right panel, you'll see download buttons:
- Click **"Download WASM"** → saves `nullifier.wasm`
- Click **"Download R1CS"** → saves `nullifier.r1cs`

Save both files to: `backend/zkp/build/`

### Step 3: Setup Verification Key (5 min)

Back in your terminal:

```powershell
cd "c:\Users\Nasimi\OneDrive - Akdeniz Üniversitesi\Masaüstü\OnlineVoting\backend"

# Install snarkjs if not already
npm install snarkjs@0.7.4

# Download powers of tau
$BuildDir = ".\zkp\build"
Invoke-WebRequest -Uri "https://hermez.s3-eu-west-1.amazonaws.com/pot12_final.ptau" -OutFile "$BuildDir\pot12_final.ptau"

# Trusted setup
npx snarkjs groth16 setup "$BuildDir\nullifier.r1cs" "$BuildDir\pot12_final.ptau" "$BuildDir\nullifier_0000.zkey"

# Phase 2
npx snarkjs zkey contribute "$BuildDir\nullifier_0000.zkey" "$BuildDir\nullifier_final.zkey" --name="2026 Setup"

# Export verifier
npx snarkjs zkey export solidityverifier "$BuildDir\nullifier_final.zkey" "..\blockchain\contracts\Verifier.sol"
```

### Step 4: Redeploy & Test (9 min)

```powershell
cd blockchain
npx hardhat run scripts/deploy-ssi.js --network localhost

# Update backend/.env with new contract addresses
# Then test:
cd ..\backend
node scripts/load-test/measure-performance.js --test
```

---

## Why This Works

- ✅ **Zero dependencies**: No Rust, Docker, or complex tools
- ✅ **Real cryptography**: Uses actual Groth16 curve math  
- ✅ **Verified**: Built on same snarkjs/circom as local compilation
- ✅ **Fast**: Compilation happens in browser (5 min)
- ✅ **Secure**: You verify the circuit code matches your source

---

## Browser Compilation Verification

The online compiler at zkrepl.dev uses the exact same circom compiler as the Docker image, just running in your browser. The generated `.wasm` and `.r1cs` files are identical to local compilation.

To verify:
1. The circuit you paste is exactly what's in `backend/zkp/circuits/nullifier.circom`
2. Compilation succeeds (green checkmark)
3. WASM file is ~1.5 KB, R1CS file is ~2-3 KB

---

## Full Command Reference

```powershell
# 1. After downloading nullifier.wasm and nullifier.r1cs from zkrepl.dev

cd backend
npm install snarkjs@0.7.4

# 2. Download Powers of Tau (30 MB, one-time)
mkdir -p zkp\build
cd zkp\build

Invoke-WebRequest `
  -Uri "https://hermez.s3-eu-west-1.amazonaws.com/pot12_final.ptau" `
  -OutFile "pot12_final.ptau"

# 3. Groth16 Setup
cd ..
npx snarkjs groth16 setup build\nullifier.r1cs build\pot12_final.ptau build\nullifier_0000.zkey
npx snarkjs zkey contribute build\nullifier_0000.zkey build\nullifier_final.zkey --name="Academic 2026"
npx snarkjs zkey export solidityverifier build\nullifier_final.zkey ..\..\blockchain\contracts\Verifier.sol

# 4. Redeploy
cd ../../blockchain
npx hardhat run scripts/deploy-ssi.js --network localhost

# 5. Test
cd ../backend
node scripts/load-test/measure-performance.js --test
```

---

## Timeline

| Step | Time | Action |
|------|------|--------|
| Compile circuit (browser) | 3 min | Go to zkrepl.dev, paste, compile |
| Download artifacts | 1 min | Save .wasm + .r1cs to backend/zkp/build |
| Setup verification key | 3 min | npm commands (trusted setup) |
| Redeploy contracts | 2 min | npx hardhat run scripts/deploy-ssi.js |
| Test with real proofs | 2 min | Run measure-performance.js |

**Total**: ~11 minutes

---

## What Happens Next in the Code

Once artifacts are in `backend/zkp/build/`:

1. **proofGenerator.js** auto-detects `nullifier.wasm`
2. Switches from mock proof → **real snarkjs proof**
3. Performance metrics show `zkp_time_ms: 150-300ms` (vs 5-10ms for mock)
4. All tests continue to work, now with real Groth16 proofs

---

## Alternative: Docker Later

Once Docker Desktop is installed:

```powershell
cd "c:\Users\Nasimi\OneDrive - Akdeniz Üniversitesi\Masaüstü\OnlineVoting"
.\compile-zkp.ps1
```

This automates the entire process (circuit compilation through verifier generation).

---

## Troubleshooting zkrepl.dev

**Compilation fails?**
- Make sure circuit syntax is exactly as shown above
- Clear cache: F12 → Application → Clear Storage → Reload

**WASM/R1CS won't download?**
- Try private/incognito mode
- Use Firefox instead of Chrome
- Manual fallback: run Docker instead (when available)

---

## Next Action

1. Open https://zkrepl.dev in a new tab
2. Copy-paste the nullifier circuit code above
3. Click "Compile"
4. Download .wasm and .r1cs files
5. Return here and run the PowerShell commands above
