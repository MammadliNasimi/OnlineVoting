/**
 * PostgreSQL Database Schema
 * Initialize database tables for the voting system
 * 
 * Run this file to create all necessary tables
 * Usage: psql -U postgres -d voting_system -f database/schema.sql
 */

-- Create database (run separately if needed)
-- CREATE DATABASE voting_system;

-- Connect to database
\c voting_system;

-- Drop existing tables (if any)
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vote status table (tracks who voted)
CREATE TABLE vote_status (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    election_id INTEGER REFERENCES elections(id) ON DELETE CASCADE,
    has_voted BOOLEAN DEFAULT false,
    voted_at TIMESTAMP,
    transaction_hash VARCHAR(255), -- Blockchain transaction hash
    UNIQUE(user_id, election_id)
);

-- Votes table (anonymous vote records)
CREATE TABLE votes (
    id SERIAL PRIMARY KEY,
    election_id INTEGER REFERENCES elections(id) ON DELETE CASCADE,
    candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
    vote_hash VARCHAR(255), -- Hash for anonymity
    transaction_hash VARCHAR(255), -- Blockchain transaction hash
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_elections_active ON elections(is_active);
CREATE INDEX idx_elections_dates ON elections(start_date, end_date);
CREATE INDEX idx_vote_status_user ON vote_status(user_id);
CREATE INDEX idx_vote_status_election ON vote_status(election_id);
CREATE INDEX idx_votes_election ON votes(election_id);
CREATE INDEX idx_votes_candidate ON votes(candidate_id);
CREATE INDEX idx_candidates_election ON candidates(election_id);

-- Insert default admin user
-- Password: admin123 (bcrypt hashed)
INSERT INTO users (name, password, role) 
VALUES ('admin', '$2a$10$XqWK9z9uZ0Gk7KJZ1dZJ.OK7F8jXxXxXxXxXxXxXxXxXxXx', 'admin');

-- Sample election
INSERT INTO elections (title, description, start_date, end_date, created_by)
VALUES (
    'University Student Council Election 2026',
    'Annual election for student council representatives',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    1
);

-- Sample candidates
INSERT INTO candidates (election_id, name, description) VALUES
(1, 'Candidate A', 'Experienced leader with vision for change'),
(1, 'Candidate B', 'Innovative thinker focused on student welfare'),
(1, 'Candidate C', 'Community organizer with proven track record');

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

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO voting_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO voting_user;

-- Display created tables
\dt

COMMENT ON TABLE users IS 'Registered voters and administrators';
COMMENT ON TABLE elections IS 'Voting elections/periods';
COMMENT ON TABLE candidates IS 'Election candidates';
COMMENT ON TABLE vote_status IS 'Tracks which users have voted';
COMMENT ON TABLE votes IS 'Anonymous vote records';

SELECT 'Database schema created successfully!' AS status;
