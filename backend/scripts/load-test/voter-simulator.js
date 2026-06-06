const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

/**
 * Voter Simulator
 * Simulates individual voter: creates burner wallet, signs EIP-712, sends vote
 */
class VoterSimulator {
  constructor(backend_api_url = 'http://localhost:3000') {
    this.apiUrl = backend_api_url;
    this.sessionId = null;
  }

  // Create random burner wallet
  createBurnerWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      wallet
    };
  }

  // Sign EIP-712 Vote message
  signVoteEIP712(
    burnerWallet,
    candidateID,
    electionID,
    chainId = 11155111,
    contractAddress = process.env.VOTING_CONTRACT_ADDRESS || '0x62a8878de43d5d6fd9B199d92556843a57F39aae'
  ) {
    const timestamp = Math.floor(Date.now() / 1000);

    const domain = {
      name: 'VotingSSI',
      version: '1.0',
      chainId,
      verifyingContract: contractAddress
    };

    const types = {
      Vote: [
        { name: 'candidateID', type: 'uint256' },
        { name: 'electionID', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' }
      ]
    };

    const message = {
      candidateID: BigInt(candidateID),
      electionID: BigInt(electionID),
      timestamp: BigInt(timestamp)
    };

    const signature = burnerWallet._signTypedData(domain, types, message);

    return {
      burnerSignature: signature,
      timestamp
    };
  }

  // Submit vote via HTTP (simulating frontend)
  async submitVote(voterId, electionID, candidateID, burner, burnerSignature, timestamp) {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.apiUrl}/vote/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          electionID: parseInt(electionID),
          candidateID: parseInt(candidateID),
          burner,
          burnerSignature,
          timestamp: parseInt(timestamp)
        })
      });

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || 'Vote submission failed',
          latencyMs,
          gasUsed: null,
          transactionHash: null,
          blockNumber: null
        };
      }

      // Parse gas and TX info from response
      return {
        success: true,
        error: null,
        latencyMs,
        gasUsed: data.gasUsed ? BigInt(data.gasUsed) : null,
        transactionHash: data.transactionHash || data.txHash,
        blockNumber: data.blockNumber,
        message: data.message
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        latencyMs,
        gasUsed: null,
        transactionHash: null,
        blockNumber: null
      };
    }
  }

  // Full vote flow: burner + sign + submit
  async castVote(voterId, electionID, candidateID, chainId, contractAddress) {
    const burner = this.createBurnerWallet();
    const signed = this.signVoteEIP712(burner.wallet, candidateID, electionID, chainId, contractAddress);

    const result = await this.submitVote(
      voterId,
      electionID,
      candidateID,
      burner.address,
      signed.burnerSignature,
      signed.timestamp
    );

    return {
      voterId,
      burnerAddress: burner.address,
      ...result
    };
  }
}

module.exports = VoterSimulator;
