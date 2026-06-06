#!/usr/bin/env pwsh
# ZK Proof Compilation Automation Script
# Compiles nullifier circuit and sets up Groth16 trusted setup
# Prerequisites: Docker Desktop installed and running

param(
    [string]$ProjectRoot = "c:\Users\Nasimi\OneDrive - Akdeniz Üniversitesi\Masaüstü\OnlineVoting",
    [switch]$SkipDocker = $false,
    [switch]$SkipTrustedSetup = $false
)

Set-StrictMode -Version 3

function Write-Header {
    param([string]$Text)
    Write-Host "`n$('='*60)" -ForegroundColor Cyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host $('='*60)`n -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "✅ $Text" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Text)
    Write-Host "❌ $Text" -ForegroundColor Red
    exit 1
}

# Validate project directory
if (-not (Test-Path "$ProjectRoot\backend\zkp\circuits\nullifier.circom")) {
    Write-Error-Custom "Circuit file not found: $ProjectRoot\backend\zkp\circuits\nullifier.circom"
}

Write-Header "🔐 ZK Proof Compilation & Trusted Setup"

# Create build directory
$BuildDir = "$ProjectRoot\backend\zkp\build"
if (-not (Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
    Write-Success "Created build directory"
}

# Step 1: Compile Circuit with Docker
if (-not $SkipDocker) {
    Write-Header "Step 1: Compile Circuit (Docker)"
    
    # Check Docker
    try {
        $dockerVersion = docker --version
        Write-Success "Docker found: $dockerVersion"
    } catch {
        Write-Error-Custom "Docker not installed or not in PATH. Install Docker Desktop from https://www.docker.com/products/docker-desktop"
    }
    
    # Pull circom image
    Write-Host "Pulling circom Docker image..."
    docker pull 0xparc/circom | Out-Null
    
    # Run compilation
    Write-Host "Compiling nullifier.circom..."
    
    # Use relative path for docker mount on Windows
    Push-Location $ProjectRoot
    
    docker run --rm `
        -v "$($ProjectRoot)\backend\zkp:/circuits" `
        0xparc/circom:latest `
        circom /circuits/circuits/nullifier.circom --r1cs --wasm --sym -o /circuits/build
    
    Pop-Location
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Circom compilation failed"
    }
    
    # Verify output
    $expectedFiles = @("nullifier.r1cs", "nullifier.wasm", "nullifier.sym")
    foreach ($file in $expectedFiles) {
        if (-not (Test-Path "$BuildDir\$file")) {
            Write-Error-Custom "Expected file not found: $file"
        }
    }
    
    Write-Success "Circuit compiled successfully"
    Write-Host "  - nullifier.r1cs ($(((Get-Item "$BuildDir\nullifier.r1cs").Length / 1KB) -as [int]) KB)"
    Write-Host "  - nullifier.wasm ($(((Get-Item "$BuildDir\nullifier.wasm").Length / 1MB) -as [int]) MB)"
}

# Step 2: Download Powers of Tau
if (-not $SkipTrustedSetup) {
    Write-Header "Step 2: Download Powers of Tau"
    
    $PotFile = "$BuildDir\pot12_final.ptau"
    
    if (Test-Path $PotFile) {
        Write-Success "Powers of Tau already exists ($(((Get-Item $PotFile).Length / 1MB) -as [int]) MB)"
    } else {
        Write-Host "Downloading pot12_final.ptau (30 MB)..."
        
        $ProgressPreference = 'SilentlyContinue'
        try {
            Invoke-WebRequest -Uri "https://hermez.s3-eu-west-1.amazonaws.com/pot12_final.ptau" `
                -OutFile $PotFile `
                -ErrorAction Stop
            Write-Success "Powers of Tau downloaded"
        } catch {
            Write-Error-Custom "Failed to download Powers of Tau: $_"
        }
    }
}

# Step 3: Groth16 Setup
if (-not $SkipTrustedSetup) {
    Write-Header "Step 3: Groth16 Trusted Setup"
    
    # Install snarkjs locally if needed
    Push-Location $ProjectRoot\backend
    
    $snarkjsLocal = ".\node_modules\.bin\snarkjs"
    if (-not (Test-Path $snarkjsLocal)) {
        Write-Host "Installing snarkjs..."
        npm install snarkjs@0.7.4 | Out-Null
    }
    
    # Run setup
    Write-Host "Running groth16 setup (this may take a few minutes)..."
    & $snarkjsLocal groth16 setup "$BuildDir\nullifier.r1cs" "$BuildDir\pot12_final.ptau" "$BuildDir\nullifier_0000.zkey"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Groth16 setup failed"
    }
    
    Write-Success "Generated nullifier_0000.zkey"
    
    # Phase 2 contribution
    Write-Host "Adding Phase 2 contribution..."
    & $snarkjsLocal zkey contribute "$BuildDir\nullifier_0000.zkey" "$BuildDir\nullifier_final.zkey" `
        --name="Academic Contribution 2026" `
        --entropy="$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Phase 2 contribution failed"
    }
    
    Write-Success "Generated nullifier_final.zkey (final proving key)"
    
    # Extract verification key
    Write-Host "Extracting verification key..."
    & $snarkjsLocal zkey export verificationkey "$BuildDir\nullifier_final.zkey" "$BuildDir\verification_key.json"
    
    Write-Success "Generated verification_key.json"
    
    # Export Solidity verifier
    Write-Host "Exporting Solidity verifier contract..."
    & $snarkjsLocal zkey export solidityverifier "$BuildDir\nullifier_final.zkey" "$ProjectRoot\blockchain\contracts\Verifier.sol"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Verifier export failed"
    }
    
    Write-Success "Generated real Verifier.sol"
    
    Pop-Location
}

# Step 4: Summary
Write-Header "✅ Compilation Complete!"

Write-Host "Generated files in backend/zkp/build:"
Get-ChildItem -Path $BuildDir -File | ForEach-Object {
    $size = if ($_.Length -gt 1MB) { "$($_.Length / 1MB -as [int]) MB" } else { "$($_.Length / 1KB -as [int]) KB" }
    Write-Host "  ✓ $($_.Name) ($size)"
}

Write-Host "`n📋 Next Steps:"
Write-Host "  1. Redeploy contract: cd blockchain && npx hardhat run scripts/deploy-ssi.js --network localhost"
Write-Host "  2. Update .env with new contract addresses"
Write-Host "  3. Run benchmark: cd backend && node scripts/load-test/measure-performance.js --test"
Write-Host "`n🎯 The mock proof generator will auto-detect real artifacts and use snarkjs for real proofs!"
