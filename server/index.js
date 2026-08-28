import 'dotenv/config';
import express from 'express';
import cors from "cors";
import compression from 'compression';
import { prisma } from './services/prisma.js';

// Lightweight request logger — logs method, URL, status, and response time (ms).
// Skips health checks to reduce noise from load balancer probes.
function requestLogger(req, res, next) {
  if (req.path === '/health') return next();
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(`[${level}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
}

// Per-request timeout: if a handler hasn't finished within the deadline, send 504 and
// close the connection. Skips streaming endpoints (/zip) where long durations are normal.
// Prevents hanging DB queries or network calls from holding connections indefinitely.
const REQUEST_TIMEOUT_MS = 30 * 1000;
function requestTimeout(req, res, next) {
  if (req.path === '/zip') return next();
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Gateway timeout' });
    }
    req.destroy();
  }, REQUEST_TIMEOUT_MS);
  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));
  next();
}

import hymnRoutes from './routes/hymn.routes.js';
import tagRoutes from './routes/tag.routes.js';
import tagSectionRoutes from './routes/tagSection.routes.js';
import sayingRoutes from './routes/saying.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import settingsRoutes from './routes/settings.routes.js';

import lyricRoutes from './routes/lyric.routes.js';
import backupRoutes from './routes/backup.routes.js';
import imageRoutes from './routes/image.routes.js';
import fatherRoutes from './routes/father.routes.js';
import favoriteRoutes from './routes/favorite.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import adminActivityRoutes from './routes/adminActivity.routes.js';
import analyticsExportRoutes from './routes/analyticsExport.routes.js';
import { BackupScheduler } from './services/backup.scheduler.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import rateLimit from 'express-rate-limit';

// Fail fast: never run in production without a real JWT secret (tokens would be forgeable).
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start in production.');
  process.exit(1);
}

// Validate JWT secret strength in production
if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET) {
  const secret = process.env.JWT_SECRET;
  const issues = [];

  // Minimum length check
  if (secret.length < 32) {
    issues.push('must be at least 32 characters');
  }

  // Check for common weak patterns
  const weakPatterns = [
    /^(secret|password|key|jwt)/i,
    /change[_-]?me/i,
    /your[_-]?secret/i,
    /test[_-]?secret/i,
    /dev[_-]?secret/i,
    /\d{4,}$/, // ends with only numbers
    /^[a-z]+$/i, // only letters
    /^[0-9]+$/i, // only numbers
  ];

  for (const pattern of weakPatterns) {
    if (pattern.test(secret)) {
      issues.push('contains a common weak pattern');
      break;
    }
  }

  // Check for low entropy (too many repeated characters)
  const uniqueChars = new Set(secret).size;
  if (uniqueChars < 10) {
    issues.push('has too few unique characters (low entropy)');
  }

  if (issues.length > 0) {
    console.error('FATAL: JWT_SECRET is too weak:');
    issues.forEach(issue => console.error(`  - ${issue}`));
    console.error('Please use a cryptographically random secret of at least 32 characters.');
    console.error('Example: openssl rand -base64 48');
    process.exit(1);
  }
}

// Fix #3: Disable auth bypass is only allowed in non-production environments.
if (process.env.NODE_ENV === 'production' && process.env.DISABLE_AUTH === 'true') {
  console.error('FATAL: DISABLE_AUTH is not allowed in production. Refusing to start.');
  process.exit(1);
}

// Security headers middleware - adds standard security headers to all responses
function securityHeaders(req, res, next) {
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Disable browser features we don't need
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  // HSTS - enforce HTTPS for 1 year
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

const app = express();

// Behind nginx / a load balancer, trust the first proxy hop so req.ip (used by the
// login rate limiter) reflects the real client IP rather than the proxy's address.
app.set('trust proxy', 1);

// Apply security headers to all responses
app.use(securityHeaders);

// Gzip-compress responses. Large JSON payloads (e.g. the full hymns list) shrink
// ~85% on the wire. Responds to the client's Accept-Encoding; small bodies are skipped.
app.use(compression());
app.use(requestLogger);
app.use(requestTimeout);

// Allowed browser origins for CORS.
// Production: set CORS_ORIGIN_PROD to a comma-separated list, e.g.
//   CORS_ORIGIN_PROD="https://your-frontend.com,http://localhost:5173"
// Development: defaults to the Vite dev server.
const allowedOrigins = (
  process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGIN_PROD || '')
    : 'http://localhost:5173'
)
  .split(',')
  // An Origin is scheme://host:port with no path — strip any trailing slash so
  // "https://site.com/" in config still matches the browser's "https://site.com".
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.warn('[CORS] CORS_ORIGIN_PROD is not set — browser requests from other origins will be blocked.');
}

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (curl, health checks, same-origin, server-to-server) is always allowed.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Disallowed origin: omit CORS headers so the browser blocks it, but don't error the request.
      return callback(null, false);
    },
    credentials: true,
  })
);

console.log('[CORS] Allowed origins:', allowedOrigins.length ? allowedOrigins.join(', ') : '(none)');

// Image create/update can send base64 in JSON; default 100kb limit causes 413 (often shown as CORS in the browser).
// Fix #1: In production, always cap at 16mb regardless of env var. In dev, respect JSON_BODY_LIMIT for flexibility.
const envJsonLimit = process.env.JSON_BODY_LIMIT || '16mb';
const jsonLimit = process.env.NODE_ENV === 'production' ? '16mb' : envJsonLimit;
app.use(express.json({ limit: jsonLimit }));

import passwordRoutes from './routes/password.routes.js';

// Fix #7: Global rate limiter for all authenticated API routes.
// Skips routes that have their own purpose-built limiters:
//   - /auth/login and /auth/register have their own brute-force limiters
//   - /analytics/events and /admin/activity/events have their own 120/min public write limiters
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,                  // per IP, per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path === '/auth/login'
    || req.path === '/auth/register'
    || req.path === '/analytics/events'
    || req.path === '/admin/activity/events',
  message: { error: 'Too many requests. Please try again later.' },
});

// Apply global rate limiter to all API routes.
app.use('/api', globalApiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/auth', passwordRoutes);
app.use('/api/auth/profile', profileRoutes);
app.use('/api/auth/settings', settingsRoutes);

app.use('/api/hymns', hymnRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/tag-sections', tagSectionRoutes);

app.use('/api/sayings', sayingRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/lyrics', lyricRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/fathers', fatherRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin/activity', adminActivityRoutes);
app.use('/api/admin/analytics/export', analyticsExportRoutes);
// note: uploads are served from S3 via presigned URLs; no local static serving

// Lightweight health endpoint for Elastic Beanstalk / load balancer
// Fix #4: Verify database connectivity instead of returning a static response.
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    console.error('[Health] DB check failed:', err.message);
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// 404 for unmatched routes (must come after all real routes).
app.use(notFoundHandler);

// Centralized error handler (must be the last middleware registered).
app.use(errorHandler);

const PORT = process.env.PORT || 8080;

async function main() {
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Database connected.');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      
      // Start automatic backup scheduler (every 24 hours, keep 7 backups).
      // Enabled in production or when ENABLE_BACKUP_SCHEDULER=true in any environment.
      // Wrapped in try/catch so a scheduler failure never crashes the main process.
      try {
        if (process.env.NODE_ENV === 'production' || process.env.ENABLE_BACKUP_SCHEDULER === 'true') {
          BackupScheduler.start(24, 7);
        }
      } catch (e) {
        console.error('Failed to start backup scheduler:', e.message);
      }
    });
  } catch (err) {
    console.error('Failed to start server due to database connection error:', err);
    process.exit(1);
  }
}

main();

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down...');
  try {
    BackupScheduler.stop();
  } catch (e) {
    // ignore — scheduler may not have been started
  }
  try {
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error disconnecting prisma:', e);
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Catch unhandled promise rejections and uncaught exceptions.
// Log the error and shut down gracefully (disconnect Prisma) rather than
// leaving the process in an undefined state or hanging silently.
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
  shutdown().then(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  shutdown().then(() => process.exit(1));
});
