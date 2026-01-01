const { Pool } = require('pg');
require('dotenv').config();

// Stub connection config - normally from env vars
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'voting_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Since we can't run real Postgres, we might want to mock query for tests or just let it fail gracefully if used.
// For the skeleton purpose, this is the correct setup.

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
