const db = require('../config/db');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  // Skeleton Auth Logic
  if (username === 'admin' && password === 'admin') {
    return res.json({
        token: 'mock-jwt-token-admin',
        user: { id: 1, username: 'admin', role: 'admin' }
    });
  }

  if (username === 'user' && password === 'user') {
    return res.json({
        token: 'mock-jwt-token-user',
        user: { id: 2, username: 'user', role: 'voter' }
    });
  }

  // In a real app, check DB
  // const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);

  res.status(401).json({ message: 'Invalid credentials' });
};

exports.register = async (req, res) => {
    // Placeholder
    res.json({ message: 'Registration not implemented in skeleton' });
};
