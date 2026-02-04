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

// ========== USAGE EXAMPLE ==========

/**
 * Example: How to integrate this service into your backend
 * 
 * 1. User Registration/Login Flow:
 *    - User logs in with studentId
 *    - Backend checks database: is this student eligible to vote?
 * 
 * 2. Vote Authorization Flow:
 *    - Frontend generates: commitment = keccak256(userSecret + electionId)
 *    - Frontend sends to backend: POST /api/vote/authorize { studentId, commitment }
 *    - Backend:
 *        a. Verify studentId in database
 *        b. Check if student already voted (optional - can also rely on blockchain)
 *        c. If eligible: signature = authService.signVoteAuth(commitment)
 *        d. Return { signature } to frontend
 *    - Frontend sends to blockchain: vote(electionId, candidateId, commitment, signature)
 */

// Example endpoint implementation:
/*
const authService = new VoteAuthService();

app.post('/api/vote/authorize', async (req, res) => {
  try {
    const { studentId, commitment } = req.body;
    
    // 1. Verify student in database
    const student = await db.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // 2. Check eligibility (e.g., not already voted, correct election period, etc.)
    const hasVoted = await db.query(
      'SELECT * FROM vote_authorizations WHERE student_id = $1 AND election_id = $2',
      [studentId, currentElectionId]
    );
    
    if (hasVoted.rows.length > 0) {
      return res.status(403).json({ error: 'Already authorized for this election' });
    }
    
    // 3. Sign the commitment
    const signature = await authService.signVoteAuth(commitment);
    
    // 4. (Optional) Store authorization in database for audit trail
    await db.query(
      'INSERT INTO vote_authorizations (student_id, election_id, commitment, signature) VALUES ($1, $2, $3, $4)',
      [studentId, currentElectionId, commitment, signature]
    );
    
    // 5. Return signature to frontend
    res.json({
      success: true,
      signature: signature,
      adminAddress: authService.getAdminAddress() // For frontend verification
    });
    
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
});
*/

module.exports = VoteAuthService;

// ========== STANDALONE TESTING ==========

// Uncomment below to test the service standalone
/*
async function testAuthService() {
  console.log('\n🧪 Testing Vote Auth Service...\n');
  
  const authService = new VoteAuthService();
  
  // Simulate user-generated commitment
  const userSecret = 'my_secret_vote_12345';
  const electionId = 1;
  const commitment = ethers.keccak256(
    ethers.toUtf8Bytes(userSecret + electionId.toString())
  );
  
  console.log('User Commitment:', commitment);
  
  // Backend signs the commitment
  const signature = await authService.signVoteAuth(commitment);
  console.log('\nSignature:', signature);
  
  // Verify signature (this would happen on-chain)
  const isValid = authService.verifySignature(commitment, signature);
  console.log('\nSignature Valid:', isValid ? '✅ YES' : '❌ NO');
  
  // Test with wrong commitment (should fail)
  const wrongCommitment = ethers.keccak256(ethers.toUtf8Bytes('wrong_secret'));
  const isInvalid = authService.verifySignature(wrongCommitment, signature);
  console.log('Wrong Commitment Valid:', isInvalid ? '❌ YES (BUG!)' : '✅ NO (CORRECT)');
}

// Run test
testAuthService().catch(console.error);
*/
