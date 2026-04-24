const Database = require('better-sqlite3');
const path = require('path');
const { initializeSchema } = require('./database-schema');
const { attachQueueMethods } = require('./database-queue-methods');

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async connect() {
    try {
      const dbPath = path.join(__dirname, '..', '..', '..', 'db', 'database.db');
      this.db = new Database(dbPath);
      console.log('✅ SQLite connected successfully');
      console.log(`   Database: ${dbPath}`);

      this.db.pragma('foreign_keys = ON');
      this.createTables();

      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  createTables() {
    initializeSchema(this.db);
  }

  async close() {
    if (this.db) {
      this.db.close();
      console.log('🔒 Database connection closed');
    }
  }

  async findUserByName(name) {
    return this.db.prepare('SELECT * FROM users WHERE name = ?').get(name);
  }

async createUser(name, hashedPassword, role = 'user', studentId = null, email = null, firstName = null, lastName = null) {
      const info = this.db.prepare(
        'INSERT INTO users (name, password, role, student_id, email, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(name, hashedPassword, role, studentId, email, firstName, lastName);
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }

  async getAllUsers() {
    return this.db.prepare('SELECT id, name, role, student_id, email, created_at FROM users').all();
  }

  updateUser(id, fields) {
    const bcrypt = require('bcryptjs');
    if (fields.password) {
      this.db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(fields.password, 10), id);
    }
    if (fields.role) {
      this.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(fields.role, id);
    }
    if (fields.email !== undefined) {
      this.db.prepare('UPDATE users SET email = ? WHERE id = ?').run(fields.email, id);
    }
    return this.db.prepare('SELECT id, name, role, student_id, email, created_at FROM users WHERE id = ?').get(id);
  }

  deleteUser(id) {

    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    this.db.prepare('DELETE FROM vote_status WHERE user_id = ?').run(id);
    this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  deleteSession(id) {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  deleteVote(id) {
    this.db.prepare('DELETE FROM votes WHERE id = ?').run(id);
  }

  deleteVoteStatus(id) {
    this.db.prepare('DELETE FROM vote_status WHERE id = ?').run(id);
  }

  async getActiveElections() {
    return this.db.prepare(
      `SELECT * FROM elections WHERE is_active = 1
       AND datetime('now') >= start_date AND datetime('now') <= end_date`
    ).all();
  }

  async getElectionById(id) {
    return this.db.prepare('SELECT * FROM elections WHERE id = ?').get(id);
  }

  async getCandidatesByElection(electionId) {
    return this.db.prepare('SELECT * FROM candidates WHERE election_id = ? ORDER BY id').all(electionId);
  }

  async getAllCandidates() {
    return this.db.prepare('SELECT * FROM candidates ORDER BY election_id, id').all();
  }

  async createVoteAuthorization(userId, electionId, commitment, signature) {
    const info = this.db.prepare(
      `INSERT INTO vote_authorizations (user_id, election_id, commitment, signature)
       VALUES (?, ?, ?, ?)`
    ).run(userId, electionId, commitment, signature);
    return this.db.prepare('SELECT * FROM vote_authorizations WHERE id = ?').get(info.lastInsertRowid);
  }

  async getVoteAuthorization(userId, electionId) {
    return this.db.prepare(
      'SELECT * FROM vote_authorizations WHERE user_id = ? AND election_id = ?'
    ).get(userId, electionId);
  }

  async hasUserVoted(userId, electionId) {
    const result = this.db.prepare(
      'SELECT has_voted FROM vote_status WHERE user_id = ? AND election_id = ?'
    ).get(userId, electionId);
    return result?.has_voted === 1;
  }

  async markUserVoted(userId, electionId, txHash, commitment) {
    this.db.prepare(
      `INSERT INTO vote_status (user_id, election_id, has_voted, voted_at, transaction_hash, commitment)
       VALUES (?, ?, 1, datetime('now'), ?, ?)
       ON CONFLICT(user_id, election_id) DO UPDATE SET
       has_voted = 1, voted_at = datetime('now'), transaction_hash = ?, commitment = ?`
    ).run(userId, electionId, txHash, commitment, txHash, commitment);

    return this.db.prepare('SELECT * FROM vote_status WHERE user_id = ? AND election_id = ?')
      .get(userId, electionId);
  }

  async recordVote(userId, electionId, blockchainCandidateId, commitment, txHash) {

    const candidate = this.db.prepare(
      `SELECT id FROM candidates WHERE election_id = ? AND blockchain_candidate_id = ?`
    ).get(electionId, blockchainCandidateId);

    if (!candidate) {
      throw new Error(`Candidate not found: blockchain_candidate_id=${blockchainCandidateId} for election ${electionId}`);
    }

    const databaseCandidateId = candidate.id;

    await this.markUserVoted(userId, electionId, txHash, commitment);

    this.db.prepare(
      `INSERT INTO votes (election_id, candidate_id, commitment, transaction_hash)
       VALUES (?, ?, ?, ?)`
    ).run(electionId, databaseCandidateId, commitment, txHash);

    this.db.prepare(
      `UPDATE candidates SET vote_count = vote_count + 1 WHERE id = ?`
    ).run(databaseCandidateId);

    return { success: true };
  }

  async getUserVotingHistory(userId) {
    return this.db.prepare(
      `SELECT
        vs.voted_at,
        vs.transaction_hash,
        e.title as election_title,
        c.name as candidate_name
       FROM vote_status vs
       JOIN elections e ON vs.election_id = e.id
       JOIN votes v ON vs.election_id = v.election_id AND vs.transaction_hash = v.transaction_hash
       JOIN candidates c ON v.candidate_id = c.id
       WHERE vs.user_id = ?
       ORDER BY vs.voted_at DESC`
    ).all(userId);
  }

  getVoteResultsByElection(electionId = null) {
    const whereClause = electionId ? 'WHERE c.election_id = ?' : '';
    const stmt = this.db.prepare(
      `SELECT
         c.election_id,
         c.id AS candidate_id,
         c.blockchain_candidate_id,
         c.name AS candidate,
         COALESCE(c.vote_count, 0) AS vote_count,
         e.title AS election_title
       FROM candidates c
       JOIN elections e ON e.id = c.election_id
       ${whereClause}
       ORDER BY c.election_id ASC, c.blockchain_candidate_id ASC, c.id ASC`
    );
    return electionId ? stmt.all(electionId) : stmt.all();
  }

  async createSession(sessionId, userId, expiresAt, walletAddress = null, walletPrivateKeyEncrypted = null, walletFunded = false, walletFundingError = null) {
    this.db.prepare(
      `INSERT INTO sessions
       (id, user_id, temp_wallet_address, temp_wallet_private_key_encrypted, wallet_funded, wallet_funding_error, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      sessionId,
      userId,
      walletAddress,
      walletPrivateKeyEncrypted,
      walletFunded ? 1 : 0,
      walletFundingError,
      expiresAt.toISOString()
    );
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  }

  async getSession(sessionId) {
    return this.db.prepare(
      `SELECT s.*, u.id as user_id, u.name, u.role FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ? AND datetime(s.expires_at) > datetime('now')`
    ).get(sessionId);
  }

  async deleteSession(sessionId) {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }

  async updateSessionWallet(sessionId, walletAddress, walletPrivateKeyEncrypted) {
    this.db.prepare(
      'UPDATE sessions SET temp_wallet_address = ?, temp_wallet_private_key_encrypted = ? WHERE id = ?'
    ).run(walletAddress, walletPrivateKeyEncrypted, sessionId);
  }

  async getSessionWallet(sessionId) {
    const result = this.db.prepare(
      'SELECT temp_wallet_address, temp_wallet_private_key_encrypted, wallet_funded, wallet_funding_error FROM sessions WHERE id = ?'
    ).get(sessionId);
    return result;
  }

  cleanupExpiredSessions() {
    const info = this.db.prepare(
      "DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')"
    ).run();
    return info?.changes || 0;
  }

  setUserFaceProfile(userId, descriptorArray) {
    const descriptorJson = JSON.stringify(descriptorArray);
    this.db.prepare(
      `INSERT INTO user_face_profiles (user_id, descriptor_json, created_at, updated_at)
       VALUES (?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
       descriptor_json = excluded.descriptor_json,
       updated_at = datetime('now')`
    ).run(userId, descriptorJson);
  }

  getUserFaceProfile(userId) {
    const row = this.db.prepare(
      'SELECT user_id, descriptor_json, created_at, updated_at FROM user_face_profiles WHERE user_id = ?'
    ).get(userId);
    if (!row) return null;
    return {
      ...row,
      descriptor: JSON.parse(row.descriptor_json)
    };
  }
  hasUserFaceProfile(userId) {
    const row = this.db.prepare('SELECT user_id FROM user_face_profiles WHERE user_id = ?').get(userId);
    return !!row;
  }

  getAllowedEmailDomains() {
    return this.db.prepare('SELECT * FROM allowed_email_domains ORDER BY created_at DESC').all();
  }

  _cleanDomain(domain) {
    let clean = domain.trim().toLowerCase();
    if (clean.includes('@')) clean = clean.split('@').pop();
    clean = clean.replace(/^\./, '');
    return clean || null;
  }

  addEmailDomain(domain, addedBy = 'admin') {
    const clean = this._cleanDomain(domain);
    if (!clean) return null;
    this.db.prepare(
      'INSERT OR IGNORE INTO allowed_email_domains (domain, added_by) VALUES (?, ?)'
    ).run(clean, addedBy);
    return this.db.prepare('SELECT * FROM allowed_email_domains WHERE domain = ?').get(clean);
  }

  removeEmailDomain(id) {
    this.db.prepare('DELETE FROM allowed_email_domains WHERE id = ?').run(id);
  }

  isEmailDomainAllowed(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;

    const count = this.db.prepare('SELECT COUNT(*) as c FROM allowed_email_domains').get();
    if (count.c === 0) return false;
    const found = this.db.prepare(
      'SELECT id FROM allowed_email_domains WHERE domain = ?'
    ).get(domain);
    return !!found;
  }

  createEmailVerification(email, emailHash, otpHash, expiresAt) {

    this.db.prepare(
      "UPDATE email_verifications SET used = 1 WHERE email = ? AND used = 0"
    ).run(email.toLowerCase());
    const info = this.db.prepare(
      `INSERT INTO email_verifications (email, email_hash, otp_hash, expires_at)
       VALUES (?, ?, ?, ?)`
    ).run(email.toLowerCase(), emailHash, otpHash, expiresAt);
    return info.lastInsertRowid;
  }

  getEmailVerification(email, otpHash) {
    return this.db.prepare(
      `SELECT * FROM email_verifications
       WHERE email = ? AND otp_hash = ? AND used = 0
       AND datetime(expires_at) > datetime('now')
       ORDER BY created_at DESC LIMIT 1`
    ).get(email.toLowerCase(), otpHash);
  }

  markEmailVerificationUsed(id) {
    this.db.prepare('UPDATE email_verifications SET used = 1 WHERE id = ?').run(id);
  }

  getAllElections() {
    const elections = this.db.prepare('SELECT * FROM elections ORDER BY id DESC').all();
    return elections.map(e => ({
      ...e,
      candidates: this.db.prepare('SELECT * FROM candidates WHERE election_id = ? ORDER BY id').all(e.id),
      allowedDomains: this.db.prepare('SELECT * FROM election_domain_restrictions WHERE election_id = ? ORDER BY domain').all(e.id)
    }));
  }

  createElection(title, description, startDate, endDate, blockchainElectionId = null) {
    const blockchainId = blockchainElectionId ||
      (this.db.prepare('SELECT COALESCE(MAX(blockchain_election_id), 0) + 1 as next FROM elections').get().next);

    const info = this.db.prepare(
      `INSERT INTO elections (title, description, start_date, end_date, is_active, blockchain_election_id)
       VALUES (?, ?, ?, ?, 0, ?)`
    ).run(title, description || '', startDate, endDate, blockchainId);
    return this.db.prepare('SELECT * FROM elections WHERE id = ?').get(info.lastInsertRowid);
  }

  updateElection(id, title, description, startDate, endDate) {
    this.db.prepare(
      'UPDATE elections SET title = ?, description = ?, start_date = ?, end_date = ? WHERE id = ?'
    ).run(title, description || '', startDate, endDate, id);
    return this.db.prepare('SELECT * FROM elections WHERE id = ?').get(id);
  }

  deleteElection(id) {
    this.db.prepare('DELETE FROM elections WHERE id = ?').run(id);
  }

  toggleElectionActive(id) {
    this.db.prepare('UPDATE elections SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
    return this.db.prepare('SELECT * FROM elections WHERE id = ?').get(id);
  }

  addCandidateToElection(electionId, name, description, blockchainCandidateId = null) {
    const blockchainId = blockchainCandidateId !== null ? blockchainCandidateId :
      this.db.prepare(
        'SELECT COALESCE(MAX(blockchain_candidate_id), -1) + 1 as next FROM candidates WHERE election_id = ?'
      ).get(electionId).next;
    const info = this.db.prepare(
      'INSERT INTO candidates (election_id, name, description, blockchain_candidate_id) VALUES (?, ?, ?, ?)'
    ).run(electionId, name, description || '', blockchainId);
    return this.db.prepare('SELECT * FROM candidates WHERE id = ?').get(info.lastInsertRowid);
  }

  updateCandidate(id, name, description) {
    this.db.prepare('UPDATE candidates SET name = ?, description = ? WHERE id = ?').run(name, description || '', id);
    return this.db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
  }

  removeCandidateFromElection(candidateId) {
    this.db.prepare('DELETE FROM candidates WHERE id = ?').run(candidateId);
  }

  getElectionDomainRestrictions(electionId) {
    return this.db.prepare(
      'SELECT * FROM election_domain_restrictions WHERE election_id = ? ORDER BY domain'
    ).all(electionId);
  }

  addElectionDomainRestriction(electionId, domain) {
    const clean = this._cleanDomain(domain);
    if (!clean) return null;
    this.db.prepare(
      'INSERT OR IGNORE INTO election_domain_restrictions (election_id, domain) VALUES (?, ?)'
    ).run(electionId, clean);
    return this.db.prepare(
      'SELECT * FROM election_domain_restrictions WHERE election_id = ? AND domain = ?'
    ).get(electionId, clean);
  }

  removeElectionDomainRestriction(id) {
    this.db.prepare('DELETE FROM election_domain_restrictions WHERE id = ?').run(id);
  }

  isEmailAllowedForElection(email, electionId) {
    if (!this.isEmailDomainAllowed(email)) return false;
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    const count = this.db.prepare(
      'SELECT COUNT(*) as c FROM election_domain_restrictions WHERE election_id = ?'
    ).get(electionId);
    if (count.c === 0) return true;
    const found = this.db.prepare(
      'SELECT id FROM election_domain_restrictions WHERE election_id = ? AND domain = ?'
    ).get(electionId, domain);
    return !!found;
  }
}

attachQueueMethods(DatabaseService);

const db = new DatabaseService();
module.exports = db;
