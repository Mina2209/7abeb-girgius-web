import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma.js';

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

    // Fix #9: Verify tokenVersion matches the one stored in the database.
    // If the user changed their password (which bumps tokenVersion), old tokens are rejected.
    prisma.user.findUnique({
      where: { id: decoded.id },
      select: { tokenVersion: true },
    }).then((user) => {
      if (!user || (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion)) {
        return res.status(401).json({ error: 'Unauthorized - Token revoked' });
      }
      req.user = decoded;
      next();
    }).catch(() => {
      return res.status(401).json({ error: 'Unauthorized - Token verification failed' });
    });
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
}

// Like authenticate, but never rejects: attaches req.user if a valid, current token is
// present, otherwise just continues. Used on public endpoints that show extra data to
// editors. Revoked tokens (after password change) are silently ignored — the request
// proceeds anonymously rather than failing, preserving public-route semantics.
export function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
      // Verify tokenVersion against DB so revoked tokens (post-password-change) don't
      // attach stale identity. On failure, continue anonymously — never reject.
      prisma.user.findUnique({
        where: { id: decoded.id },
        select: { tokenVersion: true },
      }).then((user) => {
        if (user && (decoded.tokenVersion === undefined || decoded.tokenVersion === user.tokenVersion)) {
          req.user = decoded;
        }
        next();
      }).catch(() => {
        // DB error — continue without attaching user.
        next();
      });
      return; // next() is called inside the promise chain, not here
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

