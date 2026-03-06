/**
 * @file database.js - SQLite Version
 * @description SQLite database connection (no installation required!)
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async connect() {
    try {
      const dbPath = path.join(__dirname, '..', 'database.db');
      this.db = new Database(dbPath);
      
      console.log('✅ SQLite connected successfully');
      console.log(`   Database: ${dbPath}`);
      
      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');
      
      // Create tables
      this.createTables();
      
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  createTables() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        student_id TEXT UNIQUE,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add email column if it doesn't exist (migration for existing DBs)
    try { this.db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch (_) {}

    // Elections table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS elections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        is_active INTEGER DEFAULT 1,
        blockchain_election_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Candidates table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        election_id INTEGER,
        name TEXT NOT NULL,
        description TEXT,
        blockchain_candidate_id INTEGER,
        vote_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
      )
    `);

    // Vote authorizations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vote_authorizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        election_id INTEGER,
        commitment TEXT NOT NULL UNIQUE,
        signature TEXT NOT NULL,
        authorized_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        used INTEGER DEFAULT 0,
        transaction_hash TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
        UNIQUE(user_id, election_id)
      )
    `);

    // Vote status table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vote_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        election_id INTEGER,
        has_voted INTEGER DEFAULT 0,
        voted_at DATETIME,
        transaction_hash TEXT,
        commitment TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
        UNIQUE(user_id, election_id)
      )
    `);

    // Votes table (anonymous)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        election_id INTEGER,
        candidate_id INTEGER,
        commitment TEXT UNIQUE NOT NULL,
        transaction_hash TEXT NOT NULL,
        block_number INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
      )
    `);

    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        temp_wallet_address TEXT,
        temp_wallet_private_key_encrypted TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // ZK-Email: Whitelist of allowed email domains (managed by admin)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS allowed_email_domains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT UNIQUE NOT NULL,
        added_by TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Election domain restrictions (which domains can vote for which election)
    // Empty = all whitelisted domains allowed
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS election_domain_restrictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        election_id INTEGER NOT NULL,
        domain TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(election_id, domain),
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
      )
    `);

    // ZK-Email: OTP verification records
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        email_hash TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default admin if not exists
    const adminExists = this.db.prepare('SELECT id FROM users WHERE name = ?').get('admin');
    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      this.db.prepare(
        'INSERT INTO users (name, password, role, student_id) VALUES (?, ?, ?, ?)'
      ).run('admin', hashedPassword, 'admin', 'ADMIN001');
      
      console.log('   ✅ Default admin user created (admin/admin123)');
    }

    // Insert sample election if not exists
    const electionExists = this.db.prepare('SELECT id FROM elections WHERE id = 1').get();
    if (!electionExists) {
      this.db.prepare(
        `INSERT INTO elections (title, description, start_date, end_date, blockchain_election_id)
         VALUES (?, ?, datetime('now'), datetime('now', '+30 days'), ?)`
      ).run('2026 Öğrenci Başkanı Seçimi', 'Blockchain tabanlı anonim oylama', 1);

      // Insert candidates
      this.db.prepare(
        'INSERT INTO candidates (election_id, name, description, blockchain_candidate_id) VALUES (?, ?, ?, ?)'
      ).run(1, 'Ali Yılmaz', 'Deneyimli lider', 0);
      
      this.db.prepare(
        'INSERT INTO candidates (election_id, name, description, blockchain_candidate_id) VALUES (?, ?, ?, ?)'
      ).run(1, 'Ayşe Demir', 'Yenilikçi düşünür', 1);
      
      this.db.prepare(
        'INSERT INTO candidates (election_id, name, description, blockchain_candidate_id) VALUES (?, ?, ?, ?)'
      ).run(1, 'Mehmet Kaya', 'Topluluk organizatörü', 2);

      console.log('   ✅ Sample election and candidates created');
    }
  }

  async close() {
    if (this.db) {
      this.db.close();
      console.log('🔒 Database connection closed');
    }
  }

  // ========== USER QUERIES ==========

  async findUserByName(name) {
    return this.db.prepare('SELECT * FROM users WHERE name = ?').get(name);
  }

  async createUser(name, hashedPassword, role = 'user', studentId = null, email = null) {
    const info = this.db.prepare(
      'INSERT INTO users (name, password, role, student_id, email) VALUES (?, ?, ?, ?, ?)'
    ).run(name, hashedPassword, role, studentId, email);
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
    // Also delete their sessions and vote_status
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

  // ========== ELECTION QUERIES ==========

  async getActiveElections() {
    return this.db.prepare(
      `SELECT * FROM elections WHERE is_active = 1 
       AND datetime('now') >= start_date AND datetime('now') <= end_date`
    ).all();
  }

  async getElectionById(id) {
    return this.db.prepare('SELECT * FROM elections WHERE id = ?').get(id);
  }

  // ========== CANDIDATE QUERIES ==========

  async getCandidatesByElection(electionId) {
    return this.db.prepare('SELECT * FROM candidates WHERE election_id = ? ORDER BY id').all(electionId);
  }

  async getAllCandidates() {
    return this.db.prepare('SELECT * FROM candidates ORDER BY election_id, id').all();
  }

  // ========== VOTE AUTHORIZATION ==========

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

  // ========== VOTE STATUS ==========

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

  async recordVote(userId, electionId, candidateId, commitment, txHash) {
    // Mark user as voted in vote_status
    await this.markUserVoted(userId, electionId, txHash, commitment);
    
    // Record anonymous vote in votes table
    this.db.prepare(
      `INSERT INTO votes (election_id, candidate_id, commitment, transaction_hash)
       VALUES (?, ?, ?, ?)`
    ).run(electionId, candidateId, commitment, txHash);
    
    // Increment candidate vote count
    this.db.prepare(
      `UPDATE candidates SET vote_count = vote_count + 1 WHERE id = ?`
    ).run(candidateId);
    
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

  // ========== SESSIONS ==========

  async createSession(sessionId, userId, expiresAt) {
    this.db.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).run(sessionId, userId, expiresAt.toISOString());
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
      'SELECT temp_wallet_address, temp_wallet_private_key_encrypted FROM sessions WHERE id = ?'
    ).get(sessionId);
    return result;
  }

  // ========== ZK-EMAIL: ALLOWED DOMAINS ==========

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
    // If no domains configured, deny all
    const count = this.db.prepare('SELECT COUNT(*) as c FROM allowed_email_domains').get();
    if (count.c === 0) return false;
    const found = this.db.prepare(
      'SELECT id FROM allowed_email_domains WHERE domain = ?'
    ).get(domain);
    return !!found;
  }

  // ========== ZK-EMAIL: OTP VERIFICATION ==========

  createEmailVerification(email, emailHash, otpHash, expiresAt) {
    // Invalidate previous unused verifications for this email
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

  // ========== ELECTION MANAGEMENT (ADMIN) ==========

  getAllElections() {
    const elections = this.db.prepare('SELECT * FROM elections ORDER BY id DESC').all();
    return elections.map(e => ({
      ...e,
      candidates: this.db.prepare('SELECT * FROM candidates WHERE election_id = ? ORDER BY id').all(e.id),
      allowedDomains: this.db.prepare('SELECT * FROM election_domain_restrictions WHERE election_id = ? ORDER BY domain').all(e.id)
    }));
  }

  createElection(title, description, startDate, endDate) {
    const info = this.db.prepare(
      `INSERT INTO elections (title, description, start_date, end_date, is_active, blockchain_election_id)
       VALUES (?, ?, ?, ?, 1, ?)`
    ).run(title, description || '', startDate, endDate,
      // Use next available blockchain_election_id
      (this.db.prepare('SELECT COALESCE(MAX(blockchain_election_id), 0) + 1 as next FROM elections').get().next)
    );
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

  addCandidateToElection(electionId, name, description) {
    const nextBlockchainId = this.db.prepare(
      'SELECT COALESCE(MAX(blockchain_candidate_id), -1) + 1 as next FROM candidates WHERE election_id = ?'
    ).get(electionId).next;
    const info = this.db.prepare(
      'INSERT INTO candidates (election_id, name, description, blockchain_candidate_id) VALUES (?, ?, ?, ?)'
    ).run(electionId, name, description || '', nextBlockchainId);
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

  // Check if an email's domain is allowed for a specific election.
  // If the election has no domain restrictions → falls back to global whitelist.
  // If it has restrictions → email domain must be in those restrictions (AND global whitelist).
  isEmailAllowedForElection(email, electionId) {
    if (!this.isEmailDomainAllowed(email)) return false; // must always be in global whitelist
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    const count = this.db.prepare(
      'SELECT COUNT(*) as c FROM election_domain_restrictions WHERE election_id = ?'
    ).get(electionId);
    if (count.c === 0) return true; // no restrictions = all whitelisted domains allowed
    const found = this.db.prepare(
      'SELECT id FROM election_domain_restrictions WHERE election_id = ? AND domain = ?'
    ).get(electionId, domain);
    return !!found;
  }
}

const db = new DatabaseService();
module.exports = db;
