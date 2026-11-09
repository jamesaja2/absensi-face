const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
  }
}

function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    // super_admin always has access
    if (req.user.role === 'super_admin' || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: Requires one of [${roles.join(', ')}] role. Current role: ${req.user.role || 'none'}`
    });
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET,
};
