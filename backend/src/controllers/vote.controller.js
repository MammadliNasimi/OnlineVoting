const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database-sqlite');
const state = require('../config/state');
const { ethers } = require('ethers');
const { getUserFromSession, extractStudentIdFromEmail, isValidStudentId, validateUserIdentityMapping } = require('../utils/helpers');

const { parseContractError, isDomainAllowed } = require('../utils/voteHelpers');
const { voteJobQueue } = require('../services/voteQueue.service');
const voteService = require('../services/vote.service');

class VoteController {
  async addCandidate(req, res) {
    try {
      const { name, electionId, description } = req.body;
      const candidate = await voteService.addCandidate(req.user, name, electionId, description);
      res.json({ message: 'Candidate successfully added via Database', candidate });
    } catch (error) {
      console.error('Error adding candidate:', error);
      res.status(error.message.includes('admin') ? 403 : (error.message.includes('gerekli') ? 400 : 500)).json({ message: error.message });
    }
  }

  async getCandidates(req, res) {
    try {
      const candidates = await voteService.getCandidates();
      res.json(candidates.map(c => c.name));
    } catch (error) {
      console.error('Error fetching candidates:', error);
      res.status(error.message.includes('Database') ? 503 : 500).json({ message: 'Failed to fetch candidates' });
    }
  }

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
      const candidates = await voteService.getElectionCandidates(parseInt(req.params.electionId));
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
      const msg = error.message;
      let status = 500;
      if (msg.includes('Database') || msg.includes('unavailable')) status = 503;
      if (msg === 'Unauthorized') status = 401;
      if (msg.includes('Bulunamadı') || msg.includes('bulunamadı') || msg.includes('Aday')) status = 404;
      if (msg.includes('aktif') || msg.includes('yetkili')) status = 400;
      if (msg.includes('domain')) status = 403;
      
      res.status(status).json({
        message: msg || 'Oy kuyruğa eklenemedi',
        error: error.toString()
      });
    }
  }

  async getVotes(req, res) {
    try {
      if (!state.useDatabase) return res.status(503).json({ message: 'Database not available' });
      const electionId = req.query?.electionId ? Number(req.query.electionId) : null;
      if (electionId !== null && Number.isNaN(electionId)) return res.status(400).json({ message: 'Invalid electionId' });
      const results = db.getVoteResultsByElection(electionId);
      res.json(results);
    } catch (error) {
      console.error('Get vote results error:', error);
      res.status(500).json({ message: 'Failed to fetch vote results' });
    }
  }

  async postVote(req, res) {
     res.status(410).json({ message: 'Deprecated. Use voteSimple with Web3 signature.' });
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

  async getVotingPeriod(req, res) {
    res.json({}); 
  }
  async setVotingPeriod(req, res) {
    res.json({ message: 'Deprecated' });
  }

  async getAdminDatabase(req, res) {
    try {
      const user = req.user;
      if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin girisi gerekli' });
      
      const users = db.db.prepare('SELECT id, name, role, created_at FROM users').all();
      const sessions = db.db.prepare('SELECT id, user_id, temp_wallet_address, created_at, expires_at FROM sessions').all();
      const elections = db.db.prepare('SELECT id, title, description, start_date, end_date, is_active FROM elections').all();
      const candidates = db.db.prepare('SELECT id, election_id, name, description, vote_count FROM candidates').all();
      const votes = db.db.prepare('SELECT id, election_id, candidate_id, commitment, transaction_hash, created_at FROM votes').all();
      const vote_status = db.db.prepare('SELECT id, user_id, election_id, has_voted, voted_at, transaction_hash, commitment FROM vote_status').all();
      
      const data = { users, sessions, elections, candidates, votes, vote_status };
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch database data' });
    }
  }
}

module.exports = { VoteController: new VoteController(), voteJobQueue };