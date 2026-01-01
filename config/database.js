/**
 * PostgreSQL Database Configuration
 * 
 * TODO: Implement PostgreSQL connection pool
 * This is a skeleton implementation for future database integration
 */

const { Pool } = require('pg');

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'voting_system',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool (currently not used)
let pool = null;

/**
 * Initialize database connection pool
 * @returns {Promise<Pool>}
 */
async function initializeDatabase() {
  try {
    // TODO: Uncomment when PostgreSQL is set up
    // pool = new Pool(dbConfig);
    // await pool.query('SELECT NOW()');
    // console.log('✅ PostgreSQL database connected successfully');
    // return pool;
    
    console.log('⚠️  Database not configured - using in-memory storage');
    return null;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    throw error;
  }
}

/**
 * Get database connection pool
 * @returns {Pool|null}
 */
function getPool() {
  return pool;
}

/**
 * Execute a database query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>}
 */
async function query(text, params) {
  // TODO: Implement when database is set up
  // const start = Date.now();
  // const res = await pool.query(text, params);
  // const duration = Date.now() - start;
  // console.log('Executed query', { text, duration, rows: res.rowCount });
  // return res;
  
  throw new Error('Database not implemented yet - using in-memory storage');
}

/**
 * Close database connection pool
 * @returns {Promise<void>}
 */
async function closeDatabase() {
  if (pool) {
    await pool.end();
    console.log('Database connection pool closed');
  }
}

module.exports = {
  initializeDatabase,
  getPool,
  query,
  closeDatabase,
  dbConfig
};
