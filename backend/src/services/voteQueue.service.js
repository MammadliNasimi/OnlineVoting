const db = require('../config/database-sqlite');
const state = require('../config/state');
const { parseContractError } = require('../utils/voteHelpers');

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
            state.io.emit('voteUpdated', { success: true, electionId: jobData.election_id });
          }
        } catch(jobError) {
          console.error(`[VoteQueue] ❌ Job ${jobData.id} Failed:`, jobError.message);
          db.updateVoteStatus(jobData.id, 'failed', null, jobError.message);
           if (state.io) {
             state.io.to(`user_${jobData.user_id}`).emit('voteFailed', {
                 success: false,       
                 message: parseContractError(jobError),
                 electionId: jobData.election_id
             });
           }
        }
      }
    } catch (e) {
      console.error('[VoteQueue] Critical Error:', e);
    } finally {
      this.isProcessing = false;
    }
  }
}

const voteJobQueue = new VoteQueue();
module.exports = { VoteQueue, voteJobQueue };
