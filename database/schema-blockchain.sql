/**
 * PostgreSQL Database Schema - Extended for Blockchain Voting
 * Adds support for anonymous voting with off-chain authorization
 */

-- Drop existing tables (if any)
DROP TABLE IF EXISTS vote_authorizations CASCADE;
DROP TABLE IF EXISTS vote_status CASCADE;
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS elections CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- bcrypt hashed
    role VARCHAR(50) DEFAULT 'user', -- 'admin' or 'user'
    email VARCHAR(255),
    student_id VARCHAR(100) UNIQUE, -- University student ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Elections table
CREATE TABLE elections (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    blockchain_election_id INTEGER, -- ID in smart contract
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidates table
CREATE TABLE candidates (
    id SERIAL PRIMARY KEY,
    election_id INTEGER REFERENCES elections(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    photo_url VARCHAR(500),
    blockchain_candidate_id INTEGER, -- ID in smart contract
    vote_count INTEGER DEFAULT 0, -- Cached from blockchain
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vote authorizations table (tracks off-chain authorizations)
-- This is the audit trail showing who was authorized to vote
CREATE TABLE vote_authorizations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    election_id INTEGER REFERENCES elections(id) ON DELETE CASCADE,
    commitment VARCHAR(66) NOT NULL, -- 0x + 64 hex chars (bytes32)
    signature TEXT NOT NULL, -- Admin's ECDSA signature
    authorized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used BOOLEAN DEFAULT false, -- Whether this authorization was used on blockchain
    transaction_hash VARCHAR(66), -- Blockchain tx hash when vote is cast
    UNIQUE(user_id, election_id), -- One authorization per user per election
    UNIQUE(commitment) -- Each commitment is unique
);

-- Vote status table (quick lookup for "has user voted?")
CREATE TABLE vote_status (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    election_id INTEGER REFERENCES elections(id) ON DELETE CASCADE,
    has_voted BOOLEAN DEFAULT false,
    voted_at TIMESTAMP,
    transaction_hash VARCHAR(66), -- Blockchain transaction hash
    commitment VARCHAR(66), -- The commitment used (for verification)
    UNIQUE(user_id, election_id)
);

-- Votes table (anonymous blockchain vote records)
-- Note: This table does NOT contain user_id to preserve anonymity
CREATE TABLE votes (
    id SERIAL PRIMARY KEY,
    election_id INTEGER REFERENCES elections(id) ON DELETE CASCADE,
    candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
    commitment VARCHAR(66) UNIQUE NOT NULL, -- Commitment from blockchain event
    transaction_hash VARCHAR(66) NOT NULL, -- Blockchain transaction hash
    block_number BIGINT, -- Blockchain block number
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table (for backend session management)
CREATE TABLE sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_users_student_id ON users(student_id);
CREATE INDEX idx_elections_active ON elections(is_active);
CREATE INDEX idx_elections_dates ON elections(start_date, end_date);
CREATE INDEX idx_elections_blockchain_id ON elections(blockchain_election_id);
CREATE INDEX idx_vote_authorizations_user ON vote_authorizations(user_id);
CREATE INDEX idx_vote_authorizations_election ON vote_authorizations(election_id);
CREATE INDEX idx_vote_authorizations_commitment ON vote_authorizations(commitment);
CREATE INDEX idx_vote_status_user ON vote_status(user_id);
CREATE INDEX idx_vote_status_election ON vote_status(election_id);
CREATE INDEX idx_votes_election ON votes(election_id);
CREATE INDEX idx_votes_candidate ON votes(candidate_id);
CREATE INDEX idx_votes_commitment ON votes(commitment);
CREATE INDEX idx_votes_tx_hash ON votes(transaction_hash);
CREATE INDEX idx_candidates_election ON candidates(election_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Insert default admin user
-- Password: admin123 (bcrypt hashed)
INSERT INTO users (name, password, role, student_id) 
VALUES ('admin', '$2a$10$XqWK9z9uZ0Gk7KJZ1dZJ.OK7F8jXxXxXxXxXxXxXxXxXxXx', 'admin', 'ADMIN001');

-- Sample election (synced with blockchain)
INSERT INTO elections (title, description, start_date, end_date, blockchain_election_id, created_by)
VALUES (
    '2026 Öğrenci Başkanı Seçimi',
    'Blockchain tabanlı anonim oylama',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    1, -- Matches smart contract election ID
    1
);

-- Sample candidates (synced with blockchain)
INSERT INTO candidates (election_id, name, description, blockchain_candidate_id) VALUES
(1, 'Ali Yılmaz', 'Deneyimli lider', 0),
(1, 'Ayşe Demir', 'Yenilikçi düşünür', 1),
(1, 'Mehmet Kaya', 'Topluluk organizatörü', 2);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_elections_updated_at BEFORE UPDATE ON elections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check if voting period is active
CREATE OR REPLACE FUNCTION is_election_active(election_id_param INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    election_record RECORD;
BEGIN
    SELECT * INTO election_record 
    FROM elections 
    WHERE id = election_id_param;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    RETURN election_record.is_active 
        AND CURRENT_TIMESTAMP >= election_record.start_date 
        AND CURRENT_TIMESTAMP <= election_record.end_date;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Display created tables
\dt

-- Table comments
COMMENT ON TABLE users IS 'Registered voters and administrators';
COMMENT ON TABLE elections IS 'Voting elections synced with blockchain';
COMMENT ON TABLE candidates IS 'Election candidates synced with blockchain';
COMMENT ON TABLE vote_authorizations IS 'Off-chain authorization records (audit trail)';
COMMENT ON TABLE vote_status IS 'Quick lookup for user voting status';
COMMENT ON TABLE votes IS 'Anonymous vote records from blockchain events';
COMMENT ON TABLE sessions IS 'Backend session management';

SELECT 'Database schema created successfully!' AS status;
SELECT 'Total tables: ' || COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
