const jwt = require('jsonwebtoken');
const db = require('../config/database-sqlite');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

/**
 * Middleware: Verify JWT from HttpOnly Cookie
 */
const authenticateJWT = (req, res, next) => {
    const token = req.cookies.jwt_token;

    if (!token) {
        // Fallback to Header for legacy tests although cookie is preferred
        const authHeader = req.headers.authorization;
        const fallbackToken = authHeader && authHeader.split(' ')[1];
        if (!fallbackToken) {
            return res.status(401).json({ message: 'Authentication required. No token provided.' });
        }
        
        try {
            const decoded = jwt.verify(fallbackToken, JWT_SECRET);
            req.user = decoded;
            return next();
        } catch (error) {
            return res.status(403).json({ message: 'Invalid or expired token.' });
        }
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // decoded should contain { id, role, sessionId, email }
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

/**
 * Middleware: Strict Role-Based Access Control
 * Ensure user has exact required role(s)
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: 'Unauthorized. Role information missing.' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: `Forbidden. Requires one of roles: ${allowedRoles.join(', ')}` });
        }

        next();
    };
};

/**
 * Middleware: Quick alias for requireRole('admin')
 */
const requireAdmin = requireRole('admin');

module.exports = {
    authenticateJWT,
    requireRole,
    requireAdmin
};