import jwt from 'jsonwebtoken';

// No fallback: if JWT_SECRET is unset, signing/verifying fails loudly rather than
// silently using a guessable default. Production startup also refuses to boot without it.
const JWT_SECRET = process.env.JWT_SECRET;

// Auth middleware to verify JWT tokens
export function authenticate(req, res, next) {
  // Allow disabling auth for local/dev by setting DISABLE_AUTH=true in .env
  if (process.env.DISABLE_AUTH === 'true') return next();

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user info to request
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
}

// Like authenticate, but never rejects: attaches req.user if a valid token is present,
// otherwise just continues. Used on public endpoints that show extra data to editors.
export function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.substring(7), JWT_SECRET);
    } catch {
      // Invalid/expired token on a public route — ignore and continue unauthenticated.
    }
  }
  next();
}

// Middleware to check if user is an admin
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  next();
}

// Middleware to check if user is editor or admin
export function requireEditor(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'EDITOR') {
    return res.status(403).json({ error: 'Forbidden - Editor or Admin access required' });
  }

  next();
}

// Default export for backward compatibility
export default authenticate;
