-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Simplified for skeleton
    role VARCHAR(20) DEFAULT 'voter', -- 'admin' or 'voter'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Elections table
CREATE TABLE IF NOT EXISTS elections (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Votes table (to track local status/prevent double voting off-chain if needed, though blockchain is source of truth)
CREATE TABLE IF NOT EXISTS vote_status (
    user_id INTEGER REFERENCES users(id),
    election_id INTEGER REFERENCES elections(id),
    tx_hash VARCHAR(100), -- Store transaction hash
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, election_id)
);
