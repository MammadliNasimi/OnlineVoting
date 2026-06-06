const voteService = require('../services/vote.service');
const db = require('../config/database-sqlite');
const state = require('../config/state');
const { ethers } = require('ethers');

class VoteController {
  async getElections(req, res) {
    try {
      const elections = await voteService.getElections(req.user);
      res.json(elections);
    } catch (error) {
      console.error('Error fetching elections:', error);
      if (error.message === 'Unauthorized') return res.status(401).json({ message: 'Unauthorized' });
      if (error.message.includes('Database')) return res.status(503).json({ message: 'Database not available' });
      res.status(500).json({ message: 'Failed to fetch elections' });
    }
  }

  async getElectionCandidates(req, res) {
    try {
      const candidates = await voteService.getElectionCandidates(parseInt(req.params.electionId), req.user);
      res.json(candidates);
    } catch (error) {
      console.error('Error fetching election candidates:', error);
      if (error.message === 'Invalid election ID') return res.status(400).json({ message: error.message });
      if (error.message === 'Election not found') return res.status(404).json({ message: error.message });
      res.status(500).json({ message: 'Failed to fetch candidates' });
    }
  }

  async voteSimple(req, res) {
    try {
      await voteService.processSimpleVote(req.user, req.body);
      res.status(202).json({
        success: true,
        status: 'queued',
        message: 'Oyunuz havuza alındı, işleniyor. Lütfen bildirim bekleyin veya sayfayı yenileyin.'
      });
    } catch (error) {
      console.error('Error in simple vote pre-check:', error);
      const msg = error.message || '';
      let status = 500;
      if (error.code === 'DUPLICATE_PENDING_VOTE' || error.code === 'ALREADY_VOTED') status = 409;
      else if (msg.includes('Database') || msg.includes('unavailable')) status = 503;
      else if (msg === 'Unauthorized') status = 401;
      else if (msg.includes('Bulunamadı') || msg.includes('bulunamadı') || msg.includes('Aday')) status = 404;
      else if (msg.includes('aktif') || msg.includes('yetkili')) status = 400;
      else if (msg.includes('domain')) status = 403;

      res.status(status).json({
        message: msg || 'Oy kuyruğa eklenemedi',
        error: error.toString()
      });
    }
  }

  async getVotingHistory(req, res) {
    try {
      const history = await voteService.getVotingHistory(req.user);
      res.json(history);
    } catch (error) {
      console.error('Get voting history error:', error);
      res.status(error.message === 'Unauthorized' ? 401 : 500).json({ message: 'Failed to fetch voting history' });
    }
  }

  async verifyReceipt(req, res) {
    try {
      const txHash = req.params.txHash;
      
      // Validate txHash format
      if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
        return res.status(400).json({ error: 'Invalid transaction hash format' });
      }

      // Query local DB for vote record
      const voteRecord = db.db.prepare(
        'SELECT id, election_id, candidate_id, email_hash, tx_hash, created_at FROM votes WHERE tx_hash = ?'
      ).get(txHash);

      if (!voteRecord) {
        return res.status(404).json({ 
          error: 'Vote not found', 
          message: 'No vote record with this transaction hash' 
        });
      }

      // Verify on blockchain if available
      let blockchainVerified = false;
      let blockNumber = null;
      let confirmations = 0;

      if (state.relayerService && state.relayerService.provider) {
        try {
          const provider = state.relayerService.provider;
          const receipt = await provider.getTransactionReceipt(txHash);

          if (receipt && receipt.status === 1) {
            blockchainVerified = true;
            blockNumber = receipt.blockNumber;
            
            // Calculate confirmations
            const currentBlock = await provider.getBlockNumber();
            confirmations = Math.max(0, currentBlock - blockNumber);
          }
        } catch (error) {
          console.warn('Blockchain verification failed:', error.message);
          // Continue without blockchain verification
        }
      }

      // Get election and candidate info
      const election = db.db.prepare('SELECT id, title FROM elections WHERE id = ?')
        .get(voteRecord.election_id);
      const candidate = db.db.prepare('SELECT id, name FROM candidates WHERE election_id = ? AND id = ?')
        .get(voteRecord.election_id, voteRecord.candidate_id);

      res.json({
        txHash,
        verified: blockchainVerified,
        electionID: voteRecord.election_id,
        electionTitle: election?.title,
        candidateID: voteRecord.candidate_id,
        candidateName: candidate?.name,
        nullifier: voteRecord.email_hash,  // Hashed for privacy
        votedAt: voteRecord.created_at,
        blockNumber,
        confirmations,
        status: blockchainVerified ? 'confirmed' : 'pending'
      });
    } catch (error) {
      console.error('Verify receipt error:', error);
      res.status(500).json({ error: 'Failed to verify receipt', message: error.message });
    }
  }
}

module.exports = { VoteController: new VoteController() };
