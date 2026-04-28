function attachQueueMethods(DatabaseService) {
  DatabaseService.prototype.checkAndIncrementRelayerLimit = function(identifier, maxLimit, resetHours) {
    const row = this.db.prepare('SELECT count, last_reset FROM relayer_limits WHERE identifier = ?').get(identifier);
    const now = new Date();

    if (row) {
      const lastReset = new Date(row.last_reset);
      const hoursSinceReset = Math.abs(now - lastReset) / 36e5;

      if (hoursSinceReset >= resetHours) {
        this.db.prepare('UPDATE relayer_limits SET count = 1, last_reset = CURRENT_TIMESTAMP WHERE identifier = ?').run(identifier);
        return true;
      }

      if (row.count >= maxLimit) {
        return false;
      }

      this.db.prepare('UPDATE relayer_limits SET count = count + 1 WHERE identifier = ?').run(identifier);
      return true;
    }

    this.db.prepare('INSERT INTO relayer_limits (identifier, count) VALUES (?, 1)').run(identifier);
    return true;
  };

  DatabaseService.prototype.addVoteToQueue = function(jobData) {
    // Race condition guard: ayni user/election icin pending/processing job varsa hata fırlat.
    // Partial unique index zaten engelliyor; mesaj kullanıcı dostu olsun diye önce sorgulayalım.
    const existing = this.db.prepare(
      `SELECT id, status FROM vote_queue
       WHERE user_id = ? AND election_id = ? AND status IN ('pending', 'processing')
       LIMIT 1`
    ).get(jobData.userId, jobData.electionID);
    if (existing) {
      const err = new Error('Bu seçim için zaten bekleyen bir oyunuz var. Lütfen sonucu bekleyin.');
      err.code = 'DUPLICATE_PENDING_VOTE';
      throw err;
    }
    const info = this.db.prepare(
      'INSERT INTO vote_queue (user_id, candidate_id, election_id, signature, burner_address) VALUES (?, ?, ?, ?, ?)'
    ).run(jobData.userId, jobData.candidateID, jobData.electionID, jobData.signature, jobData.burnerAddress);
    return info.lastInsertRowid;
  };

  DatabaseService.prototype.hasCompletedVote = function(userId, electionId) {
    const row = this.db.prepare(
      `SELECT id FROM vote_queue
       WHERE user_id = ? AND election_id = ? AND status = 'completed'
       LIMIT 1`
    ).get(userId, electionId);
    return !!row;
  };

  DatabaseService.prototype.getNextPendingVote = function() {
    return this.db.prepare("SELECT * FROM vote_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1").get();
  };

  DatabaseService.prototype.getAllQueueJobs = function() {
    return this.db.prepare(
      `SELECT vq.*, u.name as user_name, e.title as election_title, c.name as candidate_name
       FROM vote_queue vq
       LEFT JOIN users u ON vq.user_id = u.id
       LEFT JOIN elections e ON vq.election_id = e.id
       LEFT JOIN candidates c ON vq.candidate_id = c.id
       ORDER BY vq.created_at DESC`
    ).all();
  };

  DatabaseService.prototype.retryQueueJob = function(id) {
    this.db.prepare("UPDATE vote_queue SET status = 'pending', tx_hash = NULL, error_message = NULL WHERE id = ?").run(id);
  };

  DatabaseService.prototype.updateVoteStatus = function(id, status, txHash = null, errorMsg = null) {
    this.db.prepare(
      'UPDATE vote_queue SET status = ?, tx_hash = COALESCE(?, tx_hash), error_message = COALESCE(?, error_message) WHERE id = ?'
    ).run(status, txHash, errorMsg, id);
  };
}

module.exports = { attachQueueMethods };
