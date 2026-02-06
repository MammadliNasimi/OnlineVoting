const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ethers } = require('ethers');
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

// Wallet utility functions
const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || 'default-32-char-encryption-key!!!'; // Should be 32 chars
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

function createWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
}

function encryptPrivateKey(privateKey) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

function decryptPrivateKey(encryptedData) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

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
    
    // Create wallet automatically for user
    const wallet = createWallet();
    const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey);
    
    console.log(`🦊 Created wallet for user ${name}: ${wallet.address}`);
    
    await db.createUser(name, hashedPassword, 'user', studentId, wallet.address, encryptedPrivateKey);
    res.json({ 
      message: 'Registered successfully',
      walletAddress: wallet.address
    });
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

    // Create temporary session wallet for this login
    const tempWallet = createWallet();
    console.log(`🔑 Temporary wallet created for ${name}: ${tempWallet.address}`);
    
    // Fund the temporary wallet from Hardhat's first test account
    try {
      const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545');
      const funderPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Hardhat test account #0
      const funderWallet = new ethers.Wallet(funderPrivateKey, provider);
      
      // Send 1 ETH to the temporary wallet
      const tx = await funderWallet.sendTransaction({
        to: tempWallet.address,
        value: ethers.parseEther('1.0')
      });
      await tx.wait();
      console.log(`💰 Funded temp wallet with 1 ETH: ${tx.hash}`);
    } catch (fundError) {
      console.error('⚠️  Failed to fund temp wallet:', fundError.message);
      // Continue anyway - wallet created but not funded
    }
    
    // Create session
    const sessionId = Math.random().toString(36).substring(2);
    const expiresAt = new Date(Date.now() + parseInt(process.env.SESSION_TIMEOUT || 3600000));
    await db.createSession(sessionId, user.id, expiresAt);
    
    // Store temporary wallet in session (in-memory, will be cleared on logout)
    await db.updateSessionWallet(sessionId, tempWallet.address, encryptPrivateKey(tempWallet.privateKey));

    res.json({ 
      sessionId, 
      user: { name: user.name, role: user.role },
      tempWalletAddress: tempWallet.address
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// POST /api/logout - Logout ve session'ı sil
app.post('/api/logout', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      return res.status(400).json({ message: 'No session found' });
    }
    
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }
    
    await db.deleteSession(sessionId);
    console.log(`🚪 Session deleted: ${sessionId}`);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
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

// POST /api/votes - Vote using backend wallet (for users without MetaMask)
app.post('/api/votes', async (req, res) => {
  try {
    const user = await getUserFromSession(req);
    const { candidate, electionId = 1 } = req.body;
    const sessionId = req.headers['x-session-id'];
    
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (!isVotingOpen()) return res.status(403).json({ message: 'Voting is closed' });
    if (!candidate) return res.status(400).json({ message: 'Candidate required' });
    if (!sessionId) return res.status(400).json({ message: 'No session found' });
    
    if (!useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }
    
    // Check if user already voted
    const hasVoted = await db.hasUserVoted(user.id, electionId);
    if (hasVoted) {
      return res.status(400).json({ message: 'You have already voted in this election' });
    }
    
    // Get session wallet
    const sessionWallet = await db.getSessionWallet(sessionId);
    if (!sessionWallet || !sessionWallet.temp_wallet_address || !sessionWallet.temp_wallet_private_key_encrypted) {
      return res.status(400).json({ 
        message: 'No temporary wallet found. Please login again.' 
      });
    }
    
    // Get candidate ID
    const candidates = await db.getCandidatesByElection(electionId);
    const candidateObj = candidates.find(c => c.name === candidate);
    if (!candidateObj) {
      return res.status(400).json({ message: 'Invalid candidate' });
    }
    
    // Generate secret and commitment (anonymous voting)
    const secret = ethers.hexlify(ethers.randomBytes(32));
    const electionIdHex = ethers.toBeHex(electionId, 32);
    const commitment = ethers.keccak256(ethers.concat([secret, electionIdHex]));
    
    // Get signature from authorization service
    const signature = await authService.signVoteAuth(commitment);
    
    // Decrypt session's temporary private key and create wallet
    const privateKey = decryptPrivateKey(sessionWallet.temp_wallet_private_key_encrypted);
    const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545');
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Load contract
    const contractAddress = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const contractABI = require('./smart-contracts/artifacts/contracts/VotingAnonymous.sol/VotingAnonymous.json').abi;
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);
    
    // Send transaction to blockchain
    console.log(`📤 Sending vote to blockchain for user ${user.name} using temp wallet ${sessionWallet.temp_wallet_address}...`);
    const tx = await contract.vote(electionId, candidateObj.id - 1, commitment, signature);
    console.log(`⏳ Transaction sent: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Record vote in database
    await db.recordVote(user.id, electionId, candidateObj.id, commitment, receipt.hash);
    
    res.json({ 
      message: 'Vote recorded successfully',
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      candidate,
      secret // Send secret to frontend for user to store
    });
  } catch (error) {
    console.error('Vote error:', error);
    
    if (error.code === 'CALL_EXCEPTION') {
      return res.status(400).json({ message: 'Smart contract rejected the vote. You may have already voted.' });
    }
    
    res.status(500).json({ 
      message: error.reason || error.message || 'Vote submission failed'
    });
  }
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
