const jwt = require('jsonwebtoken');
const db = require('../config/database-sqlite');

async function authenticateJWT(req, res, next) {
  let token = req.cookies?.jwt_token || req.cookies?.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    let plainSessionId = req.headers['x-session-id'];
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
        } catch (e) {}
    }
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_2026');
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
