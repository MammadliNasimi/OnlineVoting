const { ethers } = require('ethers');
require('dotenv').config();

class VoteAuthService {
  constructor() {

    // Trim: panellerden yapıştırırken arkaya kaçan \n / boşluklar ethers v6'da hata yaratır.
    this.adminPrivateKey = (process.env.ADMIN_PRIVATE_KEY || '').trim();

    if (!this.adminPrivateKey) {
      throw new Error('❌ ADMIN_PRIVATE_KEY not found in .env file');
    }

    this.adminWallet = new ethers.Wallet(this.adminPrivateKey);

    console.log('✅ Vote Auth Service initialized');
    console.log('   Admin Address:', this.adminWallet.address);
  }

  async signVoteAuth(commitmentHash) {
    try {

      if (!commitmentHash) {
        throw new Error('Commitment hash is required');
      }

      if (!ethers.isHexString(commitmentHash, 32)) {
        throw new Error('Commitment must be a valid 32-byte hex string (0x...)');
      }

      console.log('📝 Signing vote authorization...');
      console.log('   Commitment:', commitmentHash);

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

  verifySignature(commitmentHash, signature) {
    try {

      const recoveredAddress = ethers.verifyMessage(
        ethers.getBytes(commitmentHash),
        signature
      );

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

  getAdminAddress() {
    return this.adminWallet.address;
  }
}

module.exports = VoteAuthService;
