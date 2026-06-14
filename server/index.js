import 'dotenv/config';
import express from 'express';
import cors from "cors";
import { PrismaClient } from '@prisma/client';

import hymnRoutes from './routes/hymn.routes.js';
import tagRoutes from './routes/tag.routes.js';
import sayingRoutes from './routes/saying.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import authRoutes from './routes/auth.routes.js';
import lyricRoutes from './routes/lyric.routes.js';
import backupRoutes from './routes/backup.routes.js';
import imageRoutes from './routes/image.routes.js';
import { BackupScheduler } from './services/backup.scheduler.js';

const app = express();
const prisma = new PrismaClient();

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
  .map((origin) => origin.trim())
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
const jsonLimit = process.env.JSON_BODY_LIMIT || '32mb';
app.use(express.json({ limit: jsonLimit }));

app.use('/api/auth', authRoutes);
app.use('/api/hymns', hymnRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/sayings', sayingRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/lyrics', lyricRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/images', imageRoutes);

// note: uploads are served from S3 via presigned URLs; no local static serving

// Lightweight health endpoint for Elastic Beanstalk / load balancer
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 8080;

async function main() {
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Database connected.');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      
      // Start automatic backup scheduler (every 24 hours, keep 7 backups)
      // Only start in production or if ENABLE_BACKUP_SCHEDULER is set
      if (process.env.NODE_ENV === 'production' || process.env.ENABLE_BACKUP_SCHEDULER === 'true') {
        BackupScheduler.start(24, 7);
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
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error disconnecting prisma:', e);
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
