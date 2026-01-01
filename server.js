const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();

app.use(cors());
app.use(express.json());

// In-memory demo users, candidates, votes, and sessions
const users = [
  { name: 'admin', password: bcrypt.hashSync('admin123', 10), role: 'admin' }
];
let candidates = ['Aday 1', 'Aday 2'];
let votes = [];
let sessions = {};
let feedbacks = []; // Feedbacks: { candidate: string, user: string, comment: string, timestamp: Date }

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
function getUserFromSession(req) {
  const sessionId = req.headers['x-session-id'];
  return sessions[sessionId];
}

// Simple polling mechanism for real-time candidate updates
let candidateListeners = [];
app.get('/api/candidates/subscribe', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  candidateListeners.push(res);
  req.on('close', () => {
    candidateListeners = candidateListeners.filter(r => r !== res);
  });
});

function broadcastCandidates() {
  candidateListeners.forEach(res => {
    res.write(`data: ${JSON.stringify(candidates)}\n\n`);
  });
}

// Root endpoint
app.get('/', (req, res) => {
  res.send('Online Voting System API (Demo/In-Memory)');
});

// Register endpoint
app.post('/api/register', (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ message: 'Name and password are required' });
  }
  if (users.find(u => u.name === name)) {
    return res.status(400).json({ message: 'User already exists' });
  }
  // Only allow registration as user
  const hashedPassword = bcrypt.hashSync(password, 10);
  const user = { name, password: hashedPassword, role: 'user' };
  users.push(user);
  res.json({ message: 'Registered successfully' });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { name, password } = req.body;
  const user = users.find(u => u.name === name);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  // Check password hash
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  // Create session
  const sessionId = Math.random().toString(36).substring(2);
  sessions[sessionId] = user;
  res.json({ sessionId, user: { name: user.name, role: user.role } });
});

// Kullanıcı listesi endpoint
app.get('/api/users', (req, res) => {
  res.json(users.map(u => ({ id: u.id, name: u.name, role: u.role })));
});

// Admin: Aday ekleme
app.post('/api/candidates', (req, res) => {
  const user = getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Only admin can add candidates' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Aday ismi gerekli' });
  if (candidates.includes(name)) return res.status(400).json({ message: 'Aday zaten var' });
  candidates.push(name);
  broadcastCandidates();
  res.json({ message: 'Aday eklendi', candidates });
});

app.get('/api/candidates', (req, res) => {
  res.json(candidates);
});

// GET /api/votes - Tüm oyları getir
app.get('/api/votes', (req, res) => {
  res.json(votes.slice().sort((a, b) => b.timestamp - a.timestamp));
});

// POST /api/votes - Yeni oy ekle (login required)
app.post('/api/votes', (req, res) => {
  const user = getUserFromSession(req);
  const { candidate } = req.body;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  if (user.role !== 'user') return res.status(403).json({ message: 'Only users can vote' });
  if (!isVotingOpen()) return res.status(403).json({ message: 'Voting is closed' });
  if (!candidate) return res.status(400).json({ message: 'Candidate required' });
  if (!candidates.includes(candidate)) return res.status(400).json({ message: 'Invalid candidate' });
  // Kullanıcı daha önce herhangi bir adaya oy verdiyse tekrar oy veremez
  if (votes.find(v => v.voterId === user.name)) {
    return res.status(400).json({ message: 'You have already voted' });
  }
  const vote = {
    id: votes.length + 1,
    voterId: user.name,
    candidate,
    timestamp: new Date()
  };
  votes.push(vote);
  res.json(vote);
});

// Get voting history for logged-in user
app.get('/api/voting-history', (req, res) => {
  const user = getUserFromSession(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  const userVotes = votes.filter(v => v.voterId === user.name);
  res.json(userVotes);
});

// Voting period endpoints
app.get('/api/voting-period', (req, res) => {
  res.json(votingPeriod);
});

app.post('/api/voting-period', (req, res) => {
  const user = getUserFromSession(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Only admin can set voting period' });
  const { start, end } = req.body;
  votingPeriod.start = start ? new Date(start).toISOString() : null;
  votingPeriod.end = end ? new Date(end).toISOString() : null;
  res.json({ message: 'Voting period updated', votingPeriod });
});

// Add feedback for a candidate
app.post('/api/feedback', (req, res) => {
  const user = getUserFromSession(req);
  const { candidate, comment } = req.body;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  if (!candidate || !comment) return res.status(400).json({ message: 'Candidate and comment required' });
  if (!candidates.includes(candidate)) return res.status(400).json({ message: 'Invalid candidate' });
  feedbacks.push({ candidate, user: user.name, comment, timestamp: new Date() });
  res.json({ message: 'Feedback submitted' });
});

// Get feedbacks for a candidate
app.get('/api/feedback/:candidate', (req, res) => {
  const { candidate } = req.params;
  const candidateFeedbacks = feedbacks.filter(f => f.candidate === candidate);
  res.json(candidateFeedbacks);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
