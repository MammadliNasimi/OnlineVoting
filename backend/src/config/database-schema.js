function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      first_name TEXT,
      last_name TEXT,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      student_id TEXT UNIQUE,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    db.exec('ALTER TABLE users ADD COLUMN first_name TEXT;');
    db.exec('ALTER TABLE users ADD COLUMN last_name TEXT;');
  } catch (_) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try { db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch (_) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS elections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      is_active INTEGER DEFAULT 1,
      results_emailed INTEGER DEFAULT 0,
      blockchain_election_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try { db.exec('ALTER TABLE elections ADD COLUMN results_emailed INTEGER DEFAULT 0'); } catch (_) {}

  db.exec(`
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

  db.exec(`
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

  db.exec(`
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

  db.exec(`
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      temp_wallet_address TEXT,
      temp_wallet_private_key_encrypted TEXT,
      wallet_funded INTEGER DEFAULT 0,
      wallet_funding_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  try { db.exec('ALTER TABLE sessions ADD COLUMN wallet_funded INTEGER DEFAULT 0'); } catch (_) {}
  try { db.exec('ALTER TABLE sessions ADD COLUMN wallet_funding_error TEXT'); } catch (_) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_face_profiles (
      user_id INTEGER PRIMARY KEY,
      descriptor_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS allowed_email_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      added_by TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS election_domain_restrictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      election_id INTEGER NOT NULL,
      domain TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(election_id, domain),
      FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS vote_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      candidate_id INTEGER NOT NULL,
      election_id INTEGER NOT NULL,
      signature TEXT NOT NULL,
      burner_address TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      tx_hash TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS relayer_limits (
      identifier TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0,
      last_reset DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
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

  const adminExists = db.prepare('SELECT id FROM users WHERE name = ?').get('admin');
  if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (name, password, role, student_id) VALUES (?, ?, ?, ?)').run('admin', hashedPassword, 'admin', 'ADMIN001');
    console.log('   ✅ Default admin user created (admin/admin123)');
  }

  const electionCount = db.prepare('SELECT COUNT(*) as c FROM elections').get();
  if (electionCount.c === 0) {
    const electionInfo = db.prepare(
      `INSERT INTO elections (title, description, start_date, end_date, blockchain_election_id)
       VALUES (?, ?, datetime('now'), datetime('now', '+30 days'), ?)`
    ).run('2026 Öğrenci Başkanı Seçimi', 'Blockchain tabanlı anonim oylama', 1);

    const sampleElectionId = electionInfo.lastInsertRowid;
    db.prepare('INSERT INTO candidates (election_id, name, description, blockchain_candidate_id) VALUES (?, ?, ?, ?)').run(sampleElectionId, 'Ali Yılmaz', 'Deneyimli lider', 0);
    db.prepare('INSERT INTO candidates (election_id, name, description, blockchain_candidate_id) VALUES (?, ?, ?, ?)').run(sampleElectionId, 'Ayşe Demir', 'Yenilikçi düşünür', 1);
    db.prepare('INSERT INTO candidates (election_id, name, description, blockchain_candidate_id) VALUES (?, ?, ?, ?)').run(sampleElectionId, 'Mehmet Kaya', 'Topluluk organizatörü', 2);
    console.log('   ✅ Sample election and candidates created');
  }
}

module.exports = { initializeSchema };
