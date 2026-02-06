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
        wallet_address TEXT UNIQUE,
        wallet_private_key_encrypted TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Migration: Add wallet columns if they don't exist
    try {
      this.db.exec(`ALTER TABLE users ADD COLUMN wallet_address TEXT UNIQUE`);
      console.log('   🔄 Added wallet_address column to users table');
    } catch (e) {
      // Column already exists
    }
    
    try {
      this.db.exec(`ALTER TABLE users ADD COLUMN wallet_private_key_encrypted TEXT`);
      console.log('   🔄 Added wallet_private_key_encrypted column to users table');
    } catch (e) {
      // Column already exists
    }

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

    // Insert default admin if not exists
    const adminExists = this.db.prepare('SELECT id FROM users WHERE name = ?').get('admin');
    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      const crypto = require('crypto');
      const { ethers } = require('ethers');
      
      // Create wallet for admin
      const wallet = ethers.Wallet.createRandom();
      const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || 'default-32-char-encryption-key!!!';
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(wallet.privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const encryptedPrivateKey = iv.toString('hex') + ':' + encrypted;
      
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      this.db.prepare(
        'INSERT INTO users (name, password, role, student_id, wallet_address, wallet_private_key_encrypted) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('admin', hashedPassword, 'admin', 'ADMIN001', wallet.address, encryptedPrivateKey);
      
      console.log('   ✅ Default admin user created (admin/admin123)');
      console.log(`   🦊 Admin wallet: ${wallet.address}`);
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

  query(sql, params = []) {
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return { rows: this.db.prepare(sql).all(...params) };
    } else {
      this.db.prepare(sql).run(...params);
      return { rows: [] };
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

  async createUser(name, hashedPassword, role = 'user', studentId = null, walletAddress = null, walletPrivateKeyEncrypted = null) {
    const info = this.db.prepare(
      'INSERT INTO users (name, password, role, student_id, wallet_address, wallet_private_key_encrypted) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, hashedPassword, role, studentId, walletAddress, walletPrivateKeyEncrypted);
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }

  async getAllUsers() {
    return this.db.prepare('SELECT id, name, role, student_id, created_at FROM users').all();
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
    
    return { success: true };
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
}

const db = new DatabaseService();
module.exports = db;
