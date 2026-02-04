const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const VoteAuthService = require('./services/authService');
const db = require('./config/database-sqlite'); // SQLite version
require('dotenv').config();

const app = express();

// Initialize services
let authService;
let useDatabase = false;

async function initializeServices() {
  // Initialize Vote Authorization Service
  try {
    authService = new VoteAuthService();
    console.log('✅ Vote Authorization Service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize authService:', error.message);
    console.log('⚠️  Anonymous voting will not be available');
  }

  // Initialize Database
  try {
    useDatabase = await db.connect();
    if (!useDatabase) {
      console.log('⚠️  Using in-memory storage (database not available)');
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.log('⚠️  Falling back to in-memory storage');
    useDatabase = false;
  }
}

// Call initialization
initializeServices();

app.use(cors());
app.use(express.json());

// Voting period (default: always open)
let votingPeriod = {
  start: null, // Date string or null
  end: null    // Date string or null
};

function isVotingOpen() {
  const now = new Date();
  if (votingPeriod.start && now < new Date(votingPeriod.start)) return false;
  if (votingPeriod.end && now > new Date(votingPeriod.end)) return false;
  return true;
}

// Session ile kullanıcıyı doğrulama helper
async function getUserFromSession(req) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || !useDatabase) return null;

  const session = await db.getSession(sessionId);
  if (!session) return null;
  
  return {
    id: session.user_id,
    name: session.name,
    role: session.role
  };
}



// Root endpoint
app.get('/', (req, res) => {
  res.send('Blockchain-Based Online Voting System API');
});

// Register endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { name, password, studentId } = req.body;
    if (!name || !password) {
      return res.status(400).json({ message: 'Name and password are required' });
    }

    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const existingUser = await db.findUserByName(name);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    await db.createUser(name, hashedPassword, 'user', studentId);
    res.json({ message: 'Registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const user = await db.findUserByName(name);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create session
    const sessionId = Math.random().toString(36).substring(2);
    const expiresAt = new Date(Date.now() + parseInt(process.env.SESSION_TIMEOUT || 3600000));
    await db.createSession(sessionId, user.id, expiresAt);

    res.json({ sessionId, user: { name: user.name, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});



// Admin: Aday ekleme (currently returns static data - TODO: implement database)
app.post('/api/candidates', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Only admin can add candidates' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Aday ismi gerekli' });
  // TODO: Implement database candidate creation
  res.json({ message: 'Feature not yet implemented - candidates are pre-loaded from database' });
});

app.get('/api/candidates', async (req, res) => {
  try {
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }
    const candidates = await db.getAllCandidates();
    res.json(candidates.map(c => c.name));
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ message: 'Failed to fetch candidates' });
  }
});

// GET /api/votes - Tüm oyları getir (currently empty - votes stored on blockchain)
app.get('/api/votes', async (req, res) => {
  // TODO: Fetch vote counts from blockchain or database
  res.json([]);
});

// POST /api/votes - Simplified voting (blockchain integration pending)
app.post('/api/votes', async (req, res) => {
  const user = await getUserFromSession(req);
  const { candidate } = req.body;
  
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  if (!isVotingOpen()) return res.status(403).json({ message: 'Voting is closed' });
  if (!candidate) return res.status(400).json({ message: 'Candidate required' });
  
  // TODO: Check if user already voted in database
  // TODO: Record vote on blockchain
  // TODO: Store vote status in database
  
  res.json({ 
    message: 'Vote recorded (demo mode)',
    candidate,
    timestamp: new Date()
  });
});

// ========== BLOCKCHAIN ANONYMOUS VOTING ==========

/**
 * POST /api/vote/authorize
 * Authorize a user to vote by signing their commitment
 * 
 * Request body:
 * - commitment: bytes32 hex string (keccak256(userSecret + electionId))
 * 
 * Response:
 * - signature: Admin's signature for the commitment
 * - adminAddress: Admin's Ethereum address (for verification)
 */
app.post('/api/vote/authorize', async (req, res) => {
  try {
    const user = await getUserFromSession(req);
    const { commitment, electionId } = req.body;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized - please login first' });
    }

    if (!commitment || typeof commitment !== 'string') {
      return res.status(400).json({ message: 'Commitment is required' });
    }

    if (!commitment.startsWith('0x') || commitment.length !== 66) {
      return res.status(400).json({ 
        message: 'Invalid commitment format - must be 32-byte hex string (0x...)' 
      });
    }

    if (!authService) {
      return res.status(503).json({ 
        message: 'Vote authorization service unavailable - check ADMIN_PRIVATE_KEY in .env' 
      });
    }

    const currentElectionId = electionId || 1; // Default to election 1

    // Check if user already voted
    const hasVoted = useDatabase ? await db.hasUserVoted(user.id, currentElectionId) : false;
    if (!hasVoted && useDatabase) {
      // Check if authorization already exists
      const existingAuth = await db.getVoteAuthorization(user.id, currentElectionId);
      if (existingAuth) {
        return res.status(403).json({ 
          message: 'You have already been authorized to vote in this election'
        });
      }
    }

    if (hasVoted) {
      return res.status(403).json({ 
        message: 'You have already been authorized to vote in this election'
      });
    }

    if (user.role !== 'user') {
      return res.status(403).json({ message: 'Only registered users can vote' });
    }

    console.log(`📝 Authorizing vote for user: ${user.name}`);
    console.log(`   Commitment: ${commitment}`);
    
    const signature = await authService.signVoteAuth(commitment);

    // Save authorization to database
    if (useDatabase) {
      await db.createVoteAuthorization(user.id, currentElectionId, commitment, signature);
      console.log(`💾 Authorization saved to database`);
    }

    res.json({
      success: true,
      signature: signature,
      adminAddress: authService.getAdminAddress(),
      contractAddress: process.env.VOTING_CONTRACT_ADDRESS,
      electionId: currentElectionId,
      message: 'Vote authorized - submit to blockchain with this signature'
    });

    console.log(`✅ Vote authorized for ${user.name}`);

  } catch (error) {
    console.error('❌ Vote authorization error:', error);
    res.status(500).json({ 
      message: 'Failed to authorize vote',
      error: error.message 
    });
  }
});

/**
 * GET /api/blockchain/info
 * Get blockchain connection information
 */
app.get('/api/blockchain/info', (req, res) => {
  res.json({
    contractAddress: process.env.VOTING_CONTRACT_ADDRESS,
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL,
    chainId: parseInt(process.env.CHAIN_ID || '31337'),
    adminAddress: authService ? authService.getAdminAddress() : null,
    isAvailable: !!authService
  });
});

// ========== END BLOCKCHAIN ENDPOINTS ==========

// Get voting history for logged-in user
app.get('/api/voting-history', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  // TODO: Fetch user's voting history from database
  res.json([]);
});

// Voting period endpoints
app.get('/api/voting-period', (req, res) => {
  res.json(votingPeriod);
});

app.post('/api/voting-period', async (req, res) => {
  const user = await getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Only admin can set voting period' });
  const { start, end } = req.body;
  votingPeriod.start = start ? new Date(start).toISOString() : null;
  votingPeriod.end = end ? new Date(end).toISOString() : null;
  res.json({ message: 'Voting period updated', votingPeriod });
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
