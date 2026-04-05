const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database-sqlite');
const state = require('../config/state');
const { ethers } = require('ethers');
const { getUserFromSession, extractStudentIdFromEmail, isValidStudentId, validateUserIdentityMapping } = require('../utils/helpers');

class VoteQueue {
  constructor() {
    this.isProcessing = false;
  }

  add(jobData) {
    db.addVoteToQueue(jobData);
    console.log('[VoteQueue] 📦 Job inserted to DB queue for user', jobData.userId);
    
    if (!this.isProcessing) {
      this.processNext();
    }
  }

  async processNext() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (true) {
        const jobData = db.getNextPendingVote();
        if (!jobData) break;

        console.log(`[VoteQueue] ⚙️ Processing Job ${jobData.id} for user ${jobData.user_id}`);
        db.updateVoteStatus(jobData.id, 'processing');
        
        try {
          const completeVoteProof = JSON.parse(jobData.signature);
          
          const result = await state.relayerService.submitVote(
            completeVoteProof,
            `user_${jobData.user_id}`,
            state.credentialIssuer.getIssuerAddress()
          );

          await db.recordVote(
            jobData.user_id,
            jobData.election_id,
            jobData.candidate_id,
            result.txHash,
            result.txHash
          );

          db.updateVoteStatus(jobData.id, 'completed', result.txHash);
          console.log(`[VoteQueue] ✅ Job ${jobData.id} Completed! Tx: ${result.txHash}`);
          
          if (state.io) {
            state.io.to(`user_${jobData.user_id}`).emit('voteProcessed', {
                success: true,
                message: 'Oyunuz başarıyla blokzincire yazıldı',
                txHash: result.txHash,
                electionId: jobData.election_id
            });
            state.io.emit('voteUpdated', { 
                success: true, 
                electionId: jobData.election_id 
            });
          }

        } catch (jobError) {
          console.error(`[VoteQueue] ❌ Job ${jobData.id} Failed:`, jobError.message);
          db.updateVoteStatus(jobData.id, 'failed', null, jobError.message);
          
           if (state.io) {
             state.io.to(`user_${jobData.user_id}`).emit('voteFailed', {
                 success: false,       
                 message: 'İşlem başarısız. Zaten oy kullanmış olabilirsiniz.',
                 electionId: jobData.election_id
             });
           }
        }
      }
    } catch (e) {
      console.error("[VoteQueue] Critical Error:", e);
    } finally {
      this.isProcessing = false;
    }
  }
}
const voteJobQueue = new VoteQueue();

function isDomainAllowed(userRole, userDomain, election) {
  if (userRole === 'admin') return true;
  if (!election.allowedDomains || election.allowedDomains.length === 0) return true;
  if (!userDomain) return false;
  return election.allowedDomains.some(d => {
    let restrictedDomain = d.domain.toLowerCase().trim();
    if (restrictedDomain.startsWith('@')) restrictedDomain = restrictedDomain.substring(1);
    return userDomain === restrictedDomain;
  });
}

class VoteController {

  async addCandidate(req, res) {
    const user = req.user;
    if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Only admin can add candidates' });
    
    const { name, electionId, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Aday ismi gerekli' });

    try {
      if (!state.useDatabase) {
        return res.status(503).json({ message: 'Database not available' });
      }
      
      const eid = electionId || 1; // Default to first election if not provided
      const candidate = db.addCandidateToElection(eid, name, description || "");
      console.log(`[Admin] Added new candidate: ${name} to election: ${eid}`);
      
      res.json({ message: 'Candidate successfully added via Database', candidate });
    } catch (error) {
      console.error('Error adding candidate:', error);
      res.status(500).json({ message: 'Error adding candidate', error: error.message });
    }
  }
  async getCandidates(req, res) {

  try {
    if (!state.useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }
    const candidates = await db.getAllCandidates();
    res.json(candidates.map(c => c.name));
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ message: 'Failed to fetch candidates' });
  }

  }

  async getElections(req, res) {

  try {
    if (!state.useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userDetails = await db.findUserByName(user.name);
    const userEmail = userDetails?.email;
    const userDomain = userEmail ? userEmail.split('@')[1]?.toLowerCase() : null;

    const allElections = db.getAllElections();

    const activeElections = allElections.filter(e => e.is_active === 1);

    const accessibleElections = activeElections.filter(election => isDomainAllowed(user.role, userDomain, election));
      res.json(accessibleElections);
  } catch (error) {
    console.error('Error fetching elections:', error);
    res.status(500).json({ message: 'Failed to fetch elections' });
  }

  }

  async getElectionCandidates(req, res) {

  try {
    if (!state.useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }
    const electionId = parseInt(req.params.electionId);
    if (isNaN(electionId)) {
      return res.status(400).json({ message: 'Invalid election ID' });
    }
    const allElections = db.getAllElections();
    const election = allElections.find(e => e.id === electionId);
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    res.json(election.candidates || []);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ message: 'Failed to fetch candidates' });
  }

  }

  async voteSimple(req, res) {

  try {
    const { electionId, candidateId, burnerAddress, burnerSignature, timestamp } = req.body;
    const normalizedElectionId = Number(electionId);
    const normalizedCandidateId = Number(candidateId);

    if (!burnerAddress || !burnerSignature || !timestamp) {
       return res.status(400).json({ message: 'Invalid Client-Side Identity Proof' });
    }

    if (!state.useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!state.credentialIssuer) {
      return res.status(503).json({ message: 'Credential service unavailable' });
    }

    if (!state.relayerService) {
      return res.status(503).json({ message: 'Relayer service unavailable' });
    }

    const user = req.user; // Use req.user populated by auth middleware
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userDetails = await db.findUserByName(user.name);
    if (!userDetails || !userDetails.email) {
      return res.status(400).json({ message: 'Kullanıcı email adresi bulunamadı. Lütfen profilinizi güncelleyin.' });
    }

    const email = userDetails.email;

    const allElections = db.getAllElections();
    const election = allElections.find(e => e.id === normalizedElectionId);

    if (!election) {
      return res.status(404).json({ message: 'Seçim bulunamadı' });
    }

    if (!election.is_active) {
      return res.status(400).json({ message: 'Bu seçim aktif değil' });
    }

    if (election.allowedDomains && election.allowedDomains.length > 0) {
      const userDomain = email.split('@')[1]?.toLowerCase();
      const isAllowed = election.allowedDomains.some(d => d.domain.toLowerCase() === userDomain);

      if (!isAllowed) {
        return res.status(403).json({ message: 'Bu seçim için email domain\'iniz yetkili değil' });
      }
    }

    const blockchainElectionId = election.blockchain_election_id;

    const candidate = election.candidates.find(c => c.id === normalizedCandidateId);
    if (!candidate) {
      return res.status(404).json({ message: 'Aday bulunamadı' });
    }
    const blockchainCandidateId = candidate.blockchain_candidate_id;

    // Issue the Credential Bound to Burner Address (Backend proxy logic replaced by SSI Issue)
    const credentialData = await state.credentialIssuer.issueVoteCredential(
      email,
      blockchainElectionId,
      burnerAddress
    );
    
    // Combine Server Signature with Client Signature
    const completeVoteProof = {
      emailHash: credentialData.credential.emailHash,
      burner: burnerAddress,
      electionID: blockchainElectionId,
      candidateID: blockchainCandidateId,
      timestamp: timestamp,
      issuerSignature: credentialData.credential.issuerSignature,
      burnerSignature: burnerSignature
    };

    console.log(`\n🗳️ Simple vote queued from user ${user.name} (${email}) for election ${normalizedElectionId} (blockchain: ${blockchainElectionId}), candidate ${normalizedCandidateId} (blockchain: ${blockchainCandidateId}) with Client Burner: ${burnerAddress}`);

    // ASENKRON KUYRUK YAKLAŞIMI: Oyu arka plan job kuyruğuna ekle
    voteJobQueue.add({
      userId: user.id,
      electionID: normalizedElectionId,
      candidateID: blockchainCandidateId,
      burnerAddress: burnerAddress,
      signature: JSON.stringify(completeVoteProof)
    });

    // Kullanıcıya hemen cevap dön ("Oyunuz havuza alındı")
    res.status(202).json({
      success: true,
      status: 'queued',
      message: 'Oyunuz havuza alındı, işleniyor. Lütfen bildirim bekleyin veya sayfayı yenileyin.'
    });

  } catch (error) {
    console.error('Error in simple vote pre-check:', error);
    res.status(500).json({
      message: error.message || 'Oy kuyruğa eklenemedi',
      error: error.toString()
    });
  }

  }

  async getVotes(req, res) {

  try {
    if (!state.useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const electionId = req.query?.electionId ? Number(req.query.electionId) : null;
    if (electionId !== null && Number.isNaN(electionId)) {
      return res.status(400).json({ message: 'Invalid electionId' });
    }

    const results = db.getVoteResultsByElection(electionId);
    res.json(results);
  } catch (error) {
    console.error('Get vote results error:', error);
    res.status(500).json({ message: 'Failed to fetch vote results' });
  }

  }

  async postVote(req, res) {

  try {
    const user = req.user;
    const { candidate, electionId = 1 } = req.body;
    const sessionId = req.headers['x-session-id'];

    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (!isVotingOpen()) return res.status(403).json({ message: 'Voting is closed' });
    if (!candidate) return res.status(400).json({ message: 'Candidate required' });
    if (!sessionId) return res.status(400).json({ message: 'No session found' });

    if (!state.useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const hasVoted = await db.hasUserVoted(user.id, electionId);
    if (hasVoted) {
      return res.status(400).json({ message: 'Daha önce oy kullandınız.' });
    }

    const sessionWallet = await db.getSessionWallet(sessionId);
    if (!sessionWallet || !sessionWallet.temp_wallet_address || !sessionWallet.temp_wallet_private_key_encrypted) {
      return res.status(400).json({
        message: 'No temporary wallet found. Please login again.'
      });
    }

    if (Number(sessionWallet.wallet_funded) !== 1) {
      return res.status(503).json({
        message: sessionWallet.wallet_funding_error
          ? `Temporary wallet funding failed: ${sessionWallet.wallet_funding_error}`
          : 'Temporary wallet is not funded yet. Please login again.'
      });
    }

    const candidates = await db.getCandidatesByElection(electionId);
    const candidateObj = candidates.find(c => c.name === candidate);
    if (!candidateObj) {
      return res.status(400).json({ message: 'Invalid candidate' });
    }
    const candidateIndex = Number(candidateObj.blockchain_candidate_id);

    const privateKey = decryptPrivateKey(sessionWallet.temp_wallet_private_key_encrypted);
    const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545');
    const wallet = new ethers.Wallet(privateKey, provider);
    const minVoteBalance = ethers.parseEther('0.0001');
    const walletBalance = await provider.getBalance(wallet.address);
    if (walletBalance < minVoteBalance) {
      return res.status(503).json({
        message: `Temporary wallet balance is too low (${ethers.formatEther(walletBalance)} ETH). Please login again.`
      });
    }

    const ssiContractAddress = process.env.VOTING_CONTRACT_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
    const legacyContractAddress = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';

    let tx, receipt;

    if (credentialIssuer) {

      console.log(`📝 Using SSI voting flow for user ${user.name}`);

      const userEmail = user.email || `${user.name}@internal.voting`;
      const result = await credentialIssuer.issueVoteCredential(
        userEmail,
        electionId,
        candidateIndex
      );
      const credential = result.credential;

      const contractABI = require('../../smart-contracts/artifacts/contracts/VotingSSI.sol/VotingSSI.json').abi;
      const contract = new ethers.Contract(ssiContractAddress, contractABI, wallet);

      const voteProof = {
        emailHash:   credential.emailHash,
        electionID:  credential.electionID,
        candidateID: credential.candidateID,
        timestamp:   credential.timestamp,
        signature:   credential.signature
      };

      console.log(`📤 Submitting SSI vote to blockchain (wallet: ${sessionWallet.temp_wallet_address})...`);
      tx = await contract.vote(voteProof);
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    } else {

      console.log(`📝 Using legacy voting flow for user ${user.name}`);

      const secret = ethers.hexlify(ethers.randomBytes(32));
      const electionIdHex = ethers.toBeHex(electionId, 32);
      const commitment = ethers.keccak256(ethers.concat([secret, electionIdHex]));
      const signature = await authService.signVoteAuth(commitment);

      const contractABI = require('../../smart-contracts/artifacts/contracts/VotingAnonymous.sol/VotingAnonymous.json').abi;
      const contract = new ethers.Contract(legacyContractAddress, contractABI, wallet);

      console.log(`📤 Submitting legacy vote to blockchain (wallet: ${sessionWallet.temp_wallet_address})...`);
      tx = await contract.vote(electionId, candidateIndex, commitment, signature);
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    }

    await db.recordVote(user.id, electionId, candidateIndex, receipt.hash, receipt.hash);

    res.json({
      message: 'Vote recorded successfully',
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      candidate
    });
  } catch (error) {
    console.error('Vote error:', error);

    const msg = error.reason || error.message || '';
    if (msg.includes('Nullifier already used') || msg.includes('Commitment already used')) {
      return res.status(400).json({ message: 'Daha önce oy kullandınız.' });
    }
    if (error.code === 'CALL_EXCEPTION') {
      return res.status(400).json({ message: 'İşlem reddedildi. Zaten oy kullanmış olabilirsiniz.' });
    }

    res.status(500).json({
      message: 'Oy gönderimi başarısız oldu. İşlem daha önce yapılmış olabilir.'
    });
  }

  }

  async getVotingHistory(req, res) {

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const history = await db.getUserVotingHistory(user.id);
    res.json(history);
  } catch (error) {
    console.error('Get voting history error:', error);
    res.status(500).json({ message: 'Failed to fetch voting history' });
  }

  }

  async getVotingPeriod(req, res) {

  res.json(votingPeriod);

  }

  async setVotingPeriod(req, res) {

  const user = req.user;
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Only admin can set voting period' });
  const { start, end } = req.body;
  votingPeriod.start = start ? new Date(start).toISOString() : null;
  votingPeriod.end = end ? new Date(end).toISOString() : null;
  res.json({ message: 'Voting period updated', votingPeriod });

  }

  async getAdminDatabase(req, res) {

  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ message: 'Admin girisi gerekli' });
    }

    const data = {
      users: [],
      sessions: [],
      elections: [],
      candidates: [],
      votes: [],
      vote_status: []
    };

    const users = db.db.prepare('SELECT id, name, role, created_at FROM users').all();
    data.users = users;

    const sessions = db.db.prepare('SELECT id, user_id, temp_wallet_address, created_at, expires_at FROM sessions').all();
    data.sessions = sessions;

    const elections = db.db.prepare('SELECT id, title, description, start_date, end_date, is_active FROM elections').all();
    data.elections = elections;

    const candidates = db.db.prepare('SELECT id, election_id, name, description, vote_count FROM candidates').all();
    data.candidates = candidates;

    const votes = db.db.prepare('SELECT id, election_id, candidate_id, commitment, transaction_hash, created_at FROM votes').all();
    data.votes = votes;

    const vote_status = db.db.prepare('SELECT id, user_id, election_id, has_voted, voted_at, transaction_hash, commitment FROM vote_status').all();
    data.vote_status = vote_status;

    res.json(data);
  } catch (error) {
    console.error('Admin database error:', error);
    res.status(500).json({ message: 'Failed to fetch database data' });
  }

  }

}

module.exports = {
  VoteController: new VoteController(),
  voteJobQueue
};







