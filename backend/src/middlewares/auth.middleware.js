const jwt = require('jsonwebtoken');
const db = require('../config/database-sqlite');

async function authenticateJWT(req, res, next) {
  const plainSessionId = req.headers['x-session-id'];

  // Prefer explicit session header so different tabs can keep independent sessions.
  if (plainSessionId) {
    try {
      const session = await db.getSession(plainSessionId);
      if (session) {
        req.user = {
          id: session.user_id,
          name: session.name,
          role: session.role,
          sessionId: plainSessionId
        };
        return next();
      }
      req.user = null;
      return next();
    } catch (e) {
      req.user = null;
      return next();
    }
  }

  let token = req.cookies?.jwt_token || req.cookies?.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      req.user = null;
      return next();
    }
    const decoded = jwt.verify(token, jwtSecret);
    const session = await db.getSession(decoded.sessionId);
    if (!session) {
      req.user = null;
      return next();
    }

    req.user = {
      id: session.user_id,
      name: session.name,
      role: session.role,
      sessionId: decoded.sessionId
    };
    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
  next();
}

module.exports = { authenticateJWT, requireAuth, requireAdmin };
