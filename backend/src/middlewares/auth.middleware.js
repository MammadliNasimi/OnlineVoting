const jwt = require('jsonwebtoken');
const db = require('../config/database-sqlite');

// Cookie'yi sifirla — JWT gecerli olsa bile session DB'de yoksa cookie zombi durumda kalmasin.
function clearAuthCookie(res) {
  try {
    res.clearCookie('jwt_token');
    res.clearCookie('token');
  } catch (_) {
    // ignore
  }
}

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
      req.authError = 'session_not_found';
      return next();
    } catch (e) {
      req.user = null;
      req.authError = 'session_lookup_failed';
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
      req.authError = 'jwt_secret_missing';
      return next();
    }
    const decoded = jwt.verify(token, jwtSecret);
    const session = await db.getSession(decoded.sessionId);
    if (!session) {
      // JWT gecerli ama backend'de oturum kaydi yok / suresi dolmus. Cookie'yi temizle ki
      // istemci yeniden giris yapsin; aksi halde sonsuz "200 ama anonim" donecek.
      clearAuthCookie(res);
      req.user = null;
      req.authError = 'session_expired';
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
    // Gecersiz / suresi dolmus JWT — cookie'yi temizle.
    clearAuthCookie(res);
    req.user = null;
    req.authError = 'invalid_token';
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    const reason = req.authError ? ` (${req.authError})` : '';
    return res.status(401).json({ message: `Unauthorized${reason}` });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
  next();
}

module.exports = { authenticateJWT, requireAuth, requireAdmin };
