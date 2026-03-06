/**
 * @file authService.js
 * @description Backend service for authorizing anonymous votes
 * 
 * Purpose: Acts as the "Admin" to sign vote authorization requests.
 * Only eligible users (verified in database) receive signed commitments.
 * 
 * Flow:
 * 1. User sends studentId + commitment hash to backend
 * 2. Backend verifies studentId in database (eligibility check)
 * 3. If eligible, backend signs the commitment with Admin's private key
 * 4. User receives signature and submits vote to blockchain with it
 */

const { ethers } = require('ethers');
require('dotenv').config();

class VoteAuthService {
  constructor() {
    // Load admin private key from environment variables
    this.adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    
    if (!this.adminPrivateKey) {
      throw new Error('❌ ADMIN_PRIVATE_KEY not found in .env file');
    }
    
    // Create wallet instance for signing
    this.adminWallet = new ethers.Wallet(this.adminPrivateKey);
    
    console.log('✅ Vote Auth Service initialized');
    console.log('   Admin Address:', this.adminWallet.address);
  }

  /**
   * Sign a vote authorization
   * 
   * @param {string} commitmentHash - User's commitment hash (bytes32 hex string)
   * @returns {Promise<string>} Signature that can be verified on-chain
   * 
   * Process:
   * 1. Takes the commitment hash (already hashed by user as keccak256(secret + electionId))
   * 2. Signs it with admin's private key using Ethereum's standard signing method
   * 3. Returns signature that matches Solidity's ecrecover expectations
   * 
   * Note: Ethers.js automatically adds the "\x19Ethereum Signed Message:\n32" prefix
   * when signing, which matches the smart contract's verification logic
   */
  async signVoteAuth(commitmentHash) {
    try {
      // Validate input
      if (!commitmentHash) {
        throw new Error('Commitment hash is required');
      }

      // Ensure commitment is a valid bytes32 hex string
      if (!ethers.isHexString(commitmentHash, 32)) {
        throw new Error('Commitment must be a valid 32-byte hex string (0x...)');
      }

      console.log('📝 Signing vote authorization...');
      console.log('   Commitment:', commitmentHash);

      // Sign the commitment hash
      // Ethers.js will automatically:
      // 1. Add "\x19Ethereum Signed Message:\n32" prefix
      // 2. Hash the prefixed message
      // 3. Sign with ECDSA using the admin's private key
      const signature = await this.adminWallet.signMessage(
        ethers.getBytes(commitmentHash)
      );

      console.log('✅ Signature created:', signature.substring(0, 20) + '...');

      return signature;

    } catch (error) {
      console.error('❌ Signing error:', error.message);
      throw error;
    }
  }

  /**
   * Verify a signature (for testing purposes)
   * 
   * @param {string} commitmentHash - Original commitment hash
   * @param {string} signature - Signature to verify
   * @returns {boolean} True if signature is valid and from admin
   */
  verifySignature(commitmentHash, signature) {
    try {
      // Recover the address that created the signature
      const recoveredAddress = ethers.verifyMessage(
        ethers.getBytes(commitmentHash),
        signature
      );

      // Check if it matches admin address
      const isValid = recoveredAddress.toLowerCase() === this.adminWallet.address.toLowerCase();

      console.log('🔍 Signature verification:');
      console.log('   Expected (Admin):', this.adminWallet.address);
      console.log('   Recovered:', recoveredAddress);
      console.log('   Valid:', isValid ? '✅' : '❌');

      return isValid;

    } catch (error) {
      console.error('❌ Verification error:', error.message);
      return false;
    }
  }

  /**
   * Get admin address (public key)
   * Used to deploy the smart contract with the correct admin address
   * 
   * @returns {string} Admin's Ethereum address
   */
  getAdminAddress() {
    return this.adminWallet.address;
  }
}

module.exports = VoteAuthService;
