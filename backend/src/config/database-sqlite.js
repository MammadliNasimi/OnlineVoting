const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { initializeSchema } = require('./database-schema');
const { attachQueueMethods } = require('./database-queue-methods');

function resolveDbPath() {
  if (process.env.DB_PATH) {
    return path.isAbsolute(process.env.DB_PATH)
      ? process.env.DB_PATH
      : path.resolve(process.cwd(), process.env.DB_PATH);
  }
  const projectRootDb = path.join(__dirname, '..', '..', '..', 'db', 'database.db');
  if (fs.existsSync(projectRootDb)) return projectRootDb;
  return path.join(__dirname, '..', '..', 'db', 'database.db');
}

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async connect() {
    try {
      const dbPath = resolveDbPath();
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
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
    // GUVENLIK: password / face descriptor ASLA bu sorgudan donmemeli.
    // Yeni kolonlar eklendiginde bu listeyi guncelleyin; SELECT * kullanmayin.
    return this.db.prepare(
      'SELECT id, name, first_name, last_name, role, student_id, email, created_at FROM users'
    ).all();
  }

  // Hassas alanlari (password) sıyıran sanitizer — controller'larin direkt user nesnesi
  // dondurdugu yerlerde kullanin.
  sanitizeUser(user) {
    if (!user || typeof user !== 'object') return user;
    const { password, ...safe } = user;
    return safe;
  }

  // ============== ACCOUNT LOCK (MANUEL) ==============

  lockUser(userId, lockedUntil, reason = '') {
    this.db.prepare(
      'UPDATE users SET locked_until = ?, lock_reason = ? WHERE id = ?'
    ).run(lockedUntil, reason || null, userId);
    return this.db.prepare(
      'SELECT id, name, role, locked_until, lock_reason FROM users WHERE id = ?'
    ).get(userId);
  }

  unlockUser(userId) {
    this.db.prepare(
      "UPDATE users SET locked_until = NULL, lock_reason = NULL WHERE id = ?"
    ).run(userId);
    return this.db.prepare(
      'SELECT id, name, role, locked_until, lock_reason FROM users WHERE id = ?'
    ).get(userId);
  }

  // Sadece kilit durumunu döner — auth.service.js login kontrolü için hafif sorgu.
  getUserLockStatus(userId) {
    return this.db.prepare(
      'SELECT locked_until, lock_reason FROM users WHERE id = ?'
    ).get(userId);
  }

  // ============== AUTH ATTEMPTS ADMIN VIEW ==============

  // Tüm auth_attempts kayıtları, kullanıcı adı/e-posta ile eşleştirilmiş.
  getAllAuthAttempts() {
    // auth_attempts.identifier kullanıcı adı veya e-posta (lowercase) olabilir.
    // users tablosundaki name veya email ile LEFT JOIN deneyelim.
    return this.db.prepare(`
      SELECT
        a.id,
        a.identifier,
        a.kind,
        a.attempt_count,
        a.locked_until,
        a.last_attempt_at,
        COALESCE(u_name.id, u_email.id) AS user_id,
        COALESCE(u_name.name, u_email.name) AS user_name,
        COALESCE(u_name.email, u_email.email) AS user_email
      FROM auth_attempts a
      LEFT JOIN users u_name ON LOWER(u_name.name) = a.identifier
      LEFT JOIN users u_email ON LOWER(u_email.email) = a.identifier
      ORDER BY a.last_attempt_at DESC
    `).all();
  }

  resetAuthAttemptsByIdentifier(identifier) {
    this.db.prepare(
      'DELETE FROM auth_attempts WHERE identifier = ?'
    ).run(identifier);
  }

  resetAllAuthAttemptsForUser(userId) {
    const user = this.db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId);
    if (!user) return;
    if (user.name) {
      this.db.prepare('DELETE FROM auth_attempts WHERE identifier = ?').run(user.name.toLowerCase());
    }
    if (user.email) {
      this.db.prepare('DELETE FROM auth_attempts WHERE identifier = ?').run(user.email.toLowerCase());
    }
  }

  setUserRole(userId, role) {
    const ALLOWED = ['user', 'admin', 'moderator'];
    if (!ALLOWED.includes(role)) {
      throw new Error(`Geçersiz rol: "${role}". İzin verilenler: ${ALLOWED.join(', ')}`);
    }
    this.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
    return this.db.prepare(
      'SELECT id, name, first_name, last_name, role, student_id, email, created_at FROM users WHERE id = ?'
    ).get(userId);
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
    const { encryptDescriptor } = require('../utils/walletUtils');
    const descriptorEncrypted = encryptDescriptor(descriptorArray);
    // descriptor_json artik kullanilmiyor (placeholder) — KVKK gerekcesiyle plaintext degil.
    this.db.prepare(
      `INSERT INTO user_face_profiles (user_id, descriptor_json, descriptor_encrypted, created_at, updated_at)
       VALUES (?, '', ?, datetime('now'), datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
       descriptor_json = '',
       descriptor_encrypted = excluded.descriptor_encrypted,
       updated_at = datetime('now')`
    ).run(userId, descriptorEncrypted);
  }

  getUserFaceProfile(userId) {
    const row = this.db.prepare(
      'SELECT user_id, descriptor_json, descriptor_encrypted, created_at, updated_at FROM user_face_profiles WHERE user_id = ?'
    ).get(userId);
    if (!row) return null;

    const { decryptDescriptor } = require('../utils/walletUtils');
    let descriptor = null;

    if (row.descriptor_encrypted) {
      try {
        descriptor = decryptDescriptor(row.descriptor_encrypted);
      } catch (e) {
        console.error('[FaceProfile] Decryption failed:', e.message);
        return null;
      }
    } else if (row.descriptor_json) {
      // Geri uyumluluk: eski plaintext kayitlari okurken anında şifrele.
      try {
        descriptor = JSON.parse(row.descriptor_json);
        const { encryptDescriptor } = require('../utils/walletUtils');
        const migrated = encryptDescriptor(descriptor);
        this.db.prepare(
          'UPDATE user_face_profiles SET descriptor_encrypted = ?, descriptor_json = \'\' WHERE user_id = ?'
        ).run(migrated, userId);
        console.log(`[FaceProfile] Migrated plaintext descriptor for user ${userId}`);
      } catch {
        return null;
      }
    }

    if (!descriptor) return null;
    return { user_id: row.user_id, descriptor, created_at: row.created_at, updated_at: row.updated_at };
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

  // Aktif (used=0, expires_at > now) son OTP kaydini doner — yanlis denemeyi takip etmek icin.
  getActiveEmailVerification(email) {
    return this.db.prepare(
      `SELECT * FROM email_verifications
       WHERE email = ? AND used = 0
       AND datetime(expires_at) > datetime('now')
       ORDER BY created_at DESC LIMIT 1`
    ).get(email.toLowerCase());
  }

  incrementEmailVerificationAttempts(id) {
    this.db.prepare(
      'UPDATE email_verifications SET attempts = COALESCE(attempts, 0) + 1 WHERE id = ?'
    ).run(id);
  }

  invalidateEmailVerification(id) {
    this.db.prepare('UPDATE email_verifications SET used = 1 WHERE id = ?').run(id);
  }

  markEmailVerificationUsed(id) {
    this.db.prepare('UPDATE email_verifications SET used = 1 WHERE id = ?').run(id);
  }

  cleanupOldOtpRecords() {
    // 24 saatten eski / kullanilmis kayitlari sil — tablo şişmesin.
    const a = this.db.prepare(
      "DELETE FROM email_verifications WHERE datetime(expires_at) <= datetime('now', '-1 day')"
    ).run();
    const b = this.db.prepare(
      "DELETE FROM password_resets WHERE datetime(expires_at) <= datetime('now', '-1 day')"
    ).run();
    return { emailVerifications: a.changes, passwordResets: b.changes };
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

  // ============== AUTH ATTEMPTS (BRUTE FORCE GUARD) ==============

  // Kayitli kullanici bulamadigimizda bile kullanim sayilarini ayni anahtar uzerinden
  // takip edebilmek icin identifier olarak normalize edilmis e-posta / kullanici adi kullaniyoruz.
  getAuthAttempt(identifier, kind) {
    return this.db.prepare(
      'SELECT * FROM auth_attempts WHERE identifier = ? AND kind = ?'
    ).get(identifier, kind);
  }

  recordAuthFailure(identifier, kind, maxAttempts = 5, lockMinutes = 15) {
    const row = this.getAuthAttempt(identifier, kind);
    if (!row) {
      this.db.prepare(
        `INSERT INTO auth_attempts (identifier, kind, attempt_count, last_attempt_at)
         VALUES (?, ?, 1, datetime('now'))`
      ).run(identifier, kind);
      return { count: 1, lockedUntil: null };
    }

    const newCount = (row.attempt_count || 0) + 1;
    let lockedUntil = null;
    if (newCount >= maxAttempts) {
      lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000).toISOString();
    }
    this.db.prepare(
      `UPDATE auth_attempts SET attempt_count = ?, last_attempt_at = datetime('now'), locked_until = ?
       WHERE identifier = ? AND kind = ?`
    ).run(newCount, lockedUntil, identifier, kind);
    return { count: newCount, lockedUntil };
  }

  resetAuthAttempts(identifier, kind) {
    this.db.prepare(
      'DELETE FROM auth_attempts WHERE identifier = ? AND kind = ?'
    ).run(identifier, kind);
  }

  isAuthLocked(identifier, kind) {
    const row = this.getAuthAttempt(identifier, kind);
    if (!row || !row.locked_until) return { locked: false };
    const lockedUntil = new Date(row.locked_until);
    if (Number.isNaN(lockedUntil.getTime()) || lockedUntil <= new Date()) {
      // Lockout suresi gecmis — sayaclari sifirla.
      this.resetAuthAttempts(identifier, kind);
      return { locked: false };
    }
    return { locked: true, until: row.locked_until, retryAfterMs: lockedUntil.getTime() - Date.now() };
  }

  // ============== USER DETAIL ==============

  // Tek kullanıcının tüm detaylarını tek sorguda toplar (admin paneli için).
  getUserDetail(userId) {
    const user = this.db.prepare(
      'SELECT id, name, first_name, last_name, role, student_id, email, created_at, locked_until, lock_reason FROM users WHERE id = ?'
    ).get(userId);
    if (!user) return null;

    // Son session = "son login zamanı"
    const lastSession = this.db.prepare(
      `SELECT created_at, expires_at FROM sessions
       WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 1`
    ).get(userId);

    // Aktif session sayısı
    const activeSessionCount = this.db.prepare(
      `SELECT COUNT(*) AS c FROM sessions
       WHERE user_id = ? AND datetime(expires_at) > datetime('now')`
    ).get(userId)?.c || 0;

    // Face profil durumu
    const faceProfile = this.db.prepare(
      'SELECT created_at, updated_at FROM user_face_profiles WHERE user_id = ?'
    ).get(userId);

    // Brute force kayıtları (tüm kind'lar)
    const authAttempts = this.db.prepare(
      `SELECT kind, attempt_count, locked_until, last_attempt_at
       FROM auth_attempts WHERE identifier = ? OR identifier = ?`
    ).all(
      (user.name || '').toLowerCase(),
      (user.email || '').toLowerCase()
    );

    // Oy geçmişi (son 20) — hangi seçimlere katıldığı
    const voteHistory = this.db.prepare(
      `SELECT
         vs.election_id,
         vs.voted_at,
         vs.transaction_hash,
         e.title AS election_title,
         c.name AS candidate_name
       FROM vote_status vs
       LEFT JOIN elections e ON e.id = vs.election_id
       LEFT JOIN votes v ON v.election_id = vs.election_id AND v.transaction_hash = vs.transaction_hash
       LEFT JOIN candidates c ON c.id = v.candidate_id
       WHERE vs.user_id = ?
       ORDER BY vs.voted_at DESC
       LIMIT 20`
    ).all(userId);

    // Katılım özeti
    const voteCount = this.db.prepare(
      'SELECT COUNT(*) AS c FROM vote_status WHERE user_id = ?'
    ).get(userId)?.c || 0;

    return {
      user,
      lastSession,
      activeSessionCount,
      faceProfile,
      authAttempts,
      voteHistory,
      voteCount
    };
  }

  // ============== USER LOOKUP (CASE-INSENSITIVE) ==============

  findUserByEmailCaseInsensitive(email) {
    if (!email) return null;
    return this.db.prepare(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1'
    ).get(email);
  }

  // ============== ELECTION CANDIDATE LOCKING ==============

  lockElectionCandidates(id) {
    this.db.prepare('UPDATE elections SET candidates_locked = 1 WHERE id = ?').run(id);
  }

  markElectionEndedPermanently(id) {
    this.db.prepare(
      'UPDATE elections SET ended_permanently = 1, is_active = 0 WHERE id = ?'
    ).run(id);
  }

  getElectionRow(id) {
    return this.db.prepare('SELECT * FROM elections WHERE id = ?').get(id);
  }

  // ============== PASSWORD RESET (RATE LIMITED) ==============

  // ============== ANALYTICS ==============

  // Son N saat icindeki oylari saatlik bucket'lara grupla.
  // electionId verilirse sadece o secim, verilmezse tum oylar.
  getHourlyVoteDistribution(hours = 24, electionId = null) {
    const params = [`-${hours} hours`];
    let where = "datetime(v.created_at) >= datetime('now', ?)";
    if (electionId) {
      where += ' AND v.election_id = ?';
      params.push(electionId);
    }
    const rows = this.db.prepare(`
      SELECT
        strftime('%Y-%m-%dT%H:00:00', v.created_at) AS hour_bucket,
        COUNT(*) AS vote_count
      FROM votes v
      WHERE ${where}
      GROUP BY hour_bucket
      ORDER BY hour_bucket ASC
    `).all(...params);
    return rows;
  }

  // Domain bazli katilim: hangi domainden kac kullanici oy attı.
  getDomainParticipation(electionId = null) {
    const params = [];
    let where = '';
    if (electionId) {
      where = 'WHERE vs.election_id = ?';
      params.push(electionId);
    }
    return this.db.prepare(`
      SELECT
        COALESCE(LOWER(SUBSTR(u.email, INSTR(u.email, '@') + 1)), 'unknown') AS domain,
        COUNT(DISTINCT vs.user_id) AS voter_count
      FROM vote_status vs
      LEFT JOIN users u ON u.id = vs.user_id
      ${where}
      GROUP BY domain
      ORDER BY voter_count DESC
    `).all(...params);
  }

  // Toplam katilim: kayitli kullanici, oy atan, oran.
  getTurnoutStats(electionId = null) {
    const totalUsersRow = this.db.prepare(
      "SELECT COUNT(*) AS c FROM users WHERE role = 'user'"
    ).get();

    if (electionId) {
      // Bu secim icin uygun (domain'e gore) seçmen sayisi.
      const electionDomains = this.db.prepare(
        'SELECT domain FROM election_domain_restrictions WHERE election_id = ?'
      ).all(electionId);

      let eligibleVoters;
      if (electionDomains.length === 0) {
        // Domain kisitlamasi yok: tum kayitli kullanicilar uygun.
        eligibleVoters = totalUsersRow.c;
      } else {
        const placeholders = electionDomains.map(() => '?').join(',');
        const params = electionDomains.map(d => d.domain.toLowerCase());
        const eligibleRow = this.db.prepare(`
          SELECT COUNT(*) AS c FROM users
          WHERE role = 'user'
          AND email IS NOT NULL
          AND LOWER(SUBSTR(email, INSTR(email, '@') + 1)) IN (${placeholders})
        `).get(...params);
        eligibleVoters = eligibleRow.c;
      }

      const votedRow = this.db.prepare(
        'SELECT COUNT(DISTINCT user_id) AS c FROM vote_status WHERE election_id = ?'
      ).get(electionId);

      const total = eligibleVoters || 0;
      const voted = votedRow.c || 0;
      return {
        eligibleVoters: total,
        votedCount: voted,
        turnoutPct: total > 0 ? Number(((voted / total) * 100).toFixed(2)) : 0,
        scope: 'election',
        electionId
      };
    }

    // Genel istatistik: tüm seçimler için birleşik.
    const distinctVotersRow = this.db.prepare(
      'SELECT COUNT(DISTINCT user_id) AS c FROM vote_status'
    ).get();
    const totalVotesRow = this.db.prepare('SELECT COUNT(*) AS c FROM votes').get();
    const activeElectionsRow = this.db.prepare(
      "SELECT COUNT(*) AS c FROM elections WHERE is_active = 1 AND datetime('now') BETWEEN start_date AND end_date"
    ).get();

    const total = totalUsersRow.c || 0;
    const voters = distinctVotersRow.c || 0;
    return {
      totalRegistered: total,
      uniqueVoters: voters,
      totalVotes: totalVotesRow.c || 0,
      activeElections: activeElectionsRow.c || 0,
      turnoutPct: total > 0 ? Number(((voters / total) * 100).toFixed(2)) : 0,
      scope: 'global'
    };
  }

  // Aday bazli sonuclar (canli/bittikten sonra gosterim icin).
  getElectionResults(electionId) {
    return this.db.prepare(`
      SELECT
        c.id AS candidate_id,
        c.blockchain_candidate_id,
        c.name AS candidate_name,
        c.description AS candidate_description,
        COALESCE(c.vote_count, 0) AS vote_count
      FROM candidates c
      WHERE c.election_id = ?
      ORDER BY c.blockchain_candidate_id ASC, c.id ASC
    `).all(electionId);
  }

  countRecentPasswordResets(email, windowMinutes = 15) {
    const row = this.db.prepare(
      `SELECT COUNT(*) as c FROM password_resets
       WHERE LOWER(email) = LOWER(?)
       AND datetime(created_at) > datetime('now', ?)`
    ).get(email, `-${windowMinutes} minutes`);
    return row?.c || 0;
  }

  invalidateOldPasswordResets(email) {
    this.db.prepare(
      "UPDATE password_resets SET used = 1 WHERE LOWER(email) = LOWER(?) AND used = 0"
    ).run(email);
  }
}

attachQueueMethods(DatabaseService);

const db = new DatabaseService();
module.exports = db;
