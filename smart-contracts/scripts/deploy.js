/**
 * @file deploy.js
 * @description Deployment script for VotingAnonymous smart contract
 * 
 * Usage:
 * 1. Start local Hardhat node: npx hardhat node
 * 2. Deploy contract: npx hardhat run deploy.js --network localhost
 * 
 * The script will:
 * - Deploy VotingAnonymous contract with admin address from .env
 * - Save contract address to .env file
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
  console.log("\n🚀 DEPLOYING VOTINGANONYMOUS CONTRACT...\n");

  // Get admin address from .env ADMIN_PRIVATE_KEY
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
  
  if (!adminPrivateKey) {
    throw new Error("❌ ADMIN_PRIVATE_KEY not found in .env file");
  }

  // Create wallet from private key to get admin address
  const adminWallet = new hre.ethers.Wallet(adminPrivateKey);
  const adminAddress = adminWallet.address;

  console.log("📝 Deployment Configuration:");
  console.log("   Admin Address:", adminAddress);
  console.log("   Network:", hre.network.name);
  console.log("");

  // Deploy contract
  const VotingAnonymous = await hre.ethers.getContractFactory("VotingAnonymous");
  const votingContract = await VotingAnonymous.deploy(adminAddress);

  await votingContract.waitForDeployment();

  const contractAddress = await votingContract.getAddress();

  console.log("✅ VotingAnonymous deployed successfully!");
  console.log("   Contract Address:", contractAddress);
  console.log("   Admin Address:", adminAddress);
  console.log("");

  // Update .env file with contract address
  const rootEnvPath = path.resolve(__dirname, "../..", ".env");
  let envContent = fs.readFileSync(rootEnvPath, "utf8");
  
  // Replace VOTING_CONTRACT_ADDRESS value
  envContent = envContent.replace(
    /VOTING_CONTRACT_ADDRESS=.*/,
    `VOTING_CONTRACT_ADDRESS=${contractAddress}`
  );
  
  fs.writeFileSync(rootEnvPath, envContent);
  console.log("📄 Updated .env with contract address");
  console.log("");

  // Create election example (optional)
  console.log("🗳️  Creating sample election...");
  
  const startTime = Math.floor(Date.now() / 1000); // Now
  const endTime = startTime + (7 * 24 * 60 * 60); // 1 week from now

  const tx = await votingContract.createElection(
    "2026 Öğrenci Başkanı Seçimi",
    startTime,
    endTime,
    ["Ali Yılmaz", "Ayşe Demir", "Mehmet Kaya"]
  );

  await tx.wait();
  
  console.log("✅ Sample election created:");
  console.log("   Title: 2026 Öğrenci Başkanı Seçimi");
  console.log("   Candidates: 3");
  console.log("   Duration: 7 days");
  console.log("");

  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("");
  console.log("📋 Next Steps:");
  console.log("   1. Backend will use contract at:", contractAddress);
  console.log("   2. Frontend needs MetaMask connection");
  console.log("   3. Test voting flow with authService");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
