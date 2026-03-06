/**
 * @file deploy-ssi.js
 * @description Deployment script for VotingSSI smart contract (Self-Sovereign Identity)
 * 
 * Usage:
 * 1. Start local Hardhat node: npx hardhat node
 * 2. Deploy contract: npx hardhat run scripts/deploy-ssi.js --network localhost
 * 
 * The script will:
 * - Deploy VotingSSI contract with EIP-712 support
 * - Configure issuer address from .env
 * - Save contract address to .env file
 * - Create sample election
 * - Display deployment info
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Load .env from project root (one level up)
const dotenv = require("dotenv");
const envPath = path.resolve(__dirname, "../..", ".env");
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error("❌ Error loading .env file:", result.error);
  console.log("   Looking for .env at:", envPath);
  process.exit(1);
}

async function main() {
  console.log("\n🚀 DEPLOYING VOTINGSSI CONTRACT (Self-Sovereign Identity)...\n");

  // Get issuer address from .env ADMIN_PRIVATE_KEY
  const issuerPrivateKey = process.env.ADMIN_PRIVATE_KEY;
  
  if (!issuerPrivateKey) {
    throw new Error("❌ ADMIN_PRIVATE_KEY not found in .env file");
  }

  // Create wallet from private key to get issuer address
  const issuerWallet = new hre.ethers.Wallet(issuerPrivateKey);
  const issuerAddress = issuerWallet.address;

  console.log("📝 Deployment Configuration:");
  console.log("   Issuer Address:", issuerAddress);
  console.log("   Network:", hre.network.name);
  console.log("   Chain ID:", hre.network.config.chainId || 31337);
  console.log("");

  // Deploy contract with EIP-712 domain parameters
  const VotingSSI = await hre.ethers.getContractFactory("VotingSSI");
  const votingContract = await VotingSSI.deploy(
    issuerAddress,
    "VotingSSI",      // EIP-712 domain name
    "1.0"             // EIP-712 version
  );

  await votingContract.waitForDeployment();

  const contractAddress = await votingContract.getAddress();

  console.log("✅ VotingSSI deployed successfully!");
  console.log("   Contract Address:", contractAddress);
  console.log("   Issuer Address:", issuerAddress);
  console.log("");

  // Verify EIP-712 domain separator
  const domainSeparator = await votingContract.DOMAIN_SEPARATOR();
  console.log("🔐 EIP-712 Configuration:");
  console.log("   Domain Separator:", domainSeparator);
  console.log("   VoteProof TypeHash:", await votingContract.VOTEPROOF_TYPEHASH());
  console.log("");

  // Update .env file with contract address
  const rootEnvPath = path.resolve(__dirname, "../..", ".env");
  let envContent = fs.readFileSync(rootEnvPath, "utf8");
  
  // Update or add CONTRACT_ADDRESS
  if (envContent.includes('CONTRACT_ADDRESS=')) {
    envContent = envContent.replace(
      /CONTRACT_ADDRESS=.*/,
      `CONTRACT_ADDRESS=${contractAddress}`
    );
  } else {
    envContent += `\nCONTRACT_ADDRESS=${contractAddress}\n`;
  }
  
  // Update or add VOTING_CONTRACT_ADDRESS for backward compatibility
  if (envContent.includes('VOTING_CONTRACT_ADDRESS=')) {
    envContent = envContent.replace(
      /VOTING_CONTRACT_ADDRESS=.*/,
      `VOTING_CONTRACT_ADDRESS=${contractAddress}`
    );
  } else {
    envContent += `VOTING_CONTRACT_ADDRESS=${contractAddress}\n`;
  }
  
  fs.writeFileSync(rootEnvPath, envContent);
  console.log("📄 Updated .env with contract address");
  console.log("");

  // Create sample election
  console.log("🗳️  Creating sample election...");
  
  const startTime = Math.floor(Date.now() / 1000); // Now
  const endTime = startTime + (7 * 24 * 60 * 60); // 1 week from now

  const tx = await votingContract.createElection(
    "2026 Öğrenci Başkanı Seçimi (SSI)",
    startTime,
    endTime,
    ["Ali Yılmaz", "Ayşe Demir", "Mehmet Kaya"]
  );

  await tx.wait();
  
  console.log("✅ Sample election created:");
  console.log("   Title: 2026 Öğrenci Başkanı Seçimi (SSI)");
  console.log("   Candidates: 3");
  console.log("   Duration: 7 days");
  console.log("   Start Time:", new Date(startTime * 1000).toLocaleString());
  console.log("   End Time:", new Date(endTime * 1000).toLocaleString());
  console.log("");

  // Test nullifier calculation
  const testStudentIDHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test_student_123"));
  const testNullifier = await votingContract.calculateNullifier(testStudentIDHash, 1);
  console.log("🧪 Test Nullifier Calculation:");
  console.log("   Student ID Hash:", testStudentIDHash);
  console.log("   Nullifier:", testNullifier);
  console.log("");

  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("");
  console.log("📋 Next Steps:");
  console.log("   1. Backend Credential Issuer will use contract at:", contractAddress);
  console.log("   2. Frontend should connect to contract for voting");
  console.log("   3. Relayer service can submit transactions on behalf of users");
  console.log("");
  console.log("🔧 SSI Flow:");
  console.log("   1. User requests authorization → Backend issues token");
  console.log("   2. User selects candidate → Backend signs EIP-712 credential");
  console.log("   3. User submits credential → Smart contract verifies & records vote");
  console.log("   4. Nullifier prevents double voting while preserving anonymity");
  console.log("");
  console.log("📚 Key Features:");
  console.log("   ✅ EIP-712 structured data signing");
  console.log("   ✅ Nullifier mechanism (no identity on-chain)");
  console.log("   ✅ Verifiable credentials");
  console.log("   ✅ Self-sovereign identity principles");
  console.log("   ✅ Gas-less voting via relayer");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
