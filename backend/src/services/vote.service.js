const db = require('../config/database-sqlite');
const state = require('../config/state');
const { voteJobQueue } = require('./voteQueue.service');
const { isDomainAllowed, parseContractError } = require('../utils/voteHelpers');
const { ethers } = require('ethers');

class VoteService {
  async addCandidate(user, name, electionId, description) {
    if (!user || user.role !== 'admin') throw new Error('Only admin can add candidates');
    if (!name) throw new Error('Aday ismi gerekli');
    if (!state.useDatabase) throw new Error('Database not available');
    const eid = electionId || 1;
    return db.addCandidateToElection(eid, name, description || "");
  }

  async getCandidates() {
    if (!state.useDatabase) throw new Error('Database not available');
    const candidates = await db.getAllCandidates();
    return candidates.map(c => c.name);
  }

  async getElections(user) {
    if (!state.useDatabase) throw new Error('Database not available');
    if (!user) throw new Error('Unauthorized');
    const userDetails = await db.findUserByName(user.name);
    const userEmail = userDetails?.email;
    const userDomain = userEmail ? userEmail.split('@')[1]?.toLowerCase() : null;
    const allElections = db.getAllElections();
    const activeElections = allElections.filter(e => e.is_active === 1);
    return activeElections.filter(election => isDomainAllowed(user.role, userDomain, election));
  }

  async getElectionCandidates(electionId) {
    if (!state.useDatabase) throw new Error('Database not available');
    if (isNaN(electionId)) throw new Error('Invalid election ID');
    const allElections = db.getAllElections();
    const election = allElections.find(e => e.id === electionId);
    if (!election) throw new Error('Election not found');
    return election.candidates || [];
  }

  async processSimpleVote(user, payload) {
    const { electionId, candidateId, burnerAddress, burnerSignature, timestamp } = payload;
    if (!burnerAddress || !burnerSignature || !timestamp) throw new Error('Invalid Client-Side Identity Proof');
    if (!state.useDatabase) throw new Error('Database not available');
    if (!state.credentialIssuer) throw new Error('Credential service unavailable');
    if (!state.relayerService) throw new Error('Relayer service unavailable');
    if (!user) throw new Error('Unauthorized');

    const userDetails = await db.findUserByName(user.name);
    if (!userDetails || !userDetails.email) throw new Error('Kullanıcı email adresi bulunamadı. Lütfen profilinizi güncelleyin.');
    const email = userDetails.email;

    const normalizedElectionId = Number(electionId);
    const allElections = db.getAllElections();
    const election = allElections.find(e => e.id === normalizedElectionId);

    if (!election) throw new Error('Seçim bulunamadı');
    if (!election.is_active) throw new Error('Bu seçim aktif değil');

    if (election.allowedDomains && election.allowedDomains.length > 0) {
      const userDomain = email.split('@')[1]?.toLowerCase();
      const isAllowed = election.allowedDomains.some(d => d.domain.toLowerCase() === userDomain);
      if (!isAllowed) throw new Error("Bu seçim için email domain'iniz yetkili değil");
    }

    const candidate = election.candidates.find(c => c.id === Number(candidateId));
    if (!candidate) throw new Error('Aday bulunamadı');

    const credentialData = await state.credentialIssuer.issueVoteCredential(email, election.blockchain_election_id, burnerAddress);

    const completeVoteProof = {
      emailHash: credentialData.credential.emailHash,
      burner: burnerAddress,
      electionID: election.blockchain_election_id,
      candidateID: candidate.blockchain_candidate_id,
      timestamp: timestamp,
      issuerSignature: credentialData.credential.issuerSignature,
      burnerSignature: burnerSignature
    };

    voteJobQueue.add({
      userId: user.id,
      electionID: normalizedElectionId,
      candidateID: candidate.blockchain_candidate_id,
      burnerAddress: burnerAddress,
      signature: JSON.stringify(completeVoteProof)
    });
  }

  async getVotingHistory(user) {
    if (!user) throw new Error('Unauthorized');
    return await db.getUserVotingHistory(user.id);
  }
}

module.exports = new VoteService();