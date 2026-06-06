require("@nomicfoundation/hardhat-toolbox");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

function normalizePrivateKey(value) {
  if (!value) return undefined;
  const key = String(value).trim();
  return key.startsWith("0x") ? key : `0x${key}`;
}

const adminPrivateKey = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY);

function validatePrivateKey(key, sourceName) {
  if (!key) return;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      `${sourceName} must be a 32-byte hex private key. Expected 64 hex chars, optional 0x prefix. ` +
      `Got length ${key.replace(/^0x/, "").length}.`
    );
  }
}

validatePrivateKey(adminPrivateKey, "DEPLOYER_PRIVATE_KEY/ADMIN_PRIVATE_KEY");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    sepolia: {
      url: process.env.BLOCKCHAIN_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo",
      accounts: adminPrivateKey ? [adminPrivateKey] : [],
      chainId: 11155111
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
