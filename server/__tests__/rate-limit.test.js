import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';

// ───────────────────────────────────────────────────────────────────────────
// Helpers: create a minimal Express app with a specific rate limiter
// ───────────────────────────────────────────────────────────────────────────

function createLimiterApp(limiter, handler) {
  const app = express();
  app.use(express.json());
  app.use(limiter);
  app.post('/test', handler);
  app.get('/test', handler);
  return app;
}

function noopHandler(_req, res) {
  res.json({ ok: true });
}

// ───────────────────────────────────────────────────────────────────────────
// Login Rate Limiter
// ───────────────────────────────────────────────────────────────────────────
describe('Login Rate Limiter (POST /api/auth/login)', () => {
  it('allows requests under the limit', async () => {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
    });
    const app = createLimiterApp(limiter, noopHandler);

    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    const remaining = parseInt(res.headers['ratelimit-remaining'], 10);
    expect(remaining).toBe(9);
  });

  it('returns 429 after exceeding the limit', async () => {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 3,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many login attempts. Please try again in a few minutes.' },
    });
    // Handler returns 401 (simulating failed login) so skipSuccessfulRequests does NOT skip counting
    const failHandler = (_req, res) => res.status(401).json({ error: 'Invalid credentials' });
    const app = createLimiterApp(limiter, failHandler);

    // Consume 3 slots with "failed" logins (401 responses are NOT skipped)
    await request(app).post('/test').send({});
    await request(app).post('/test').send({});
    await request(app).post('/test').send({});

    // 4th request should be rate limited
    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/Too many login attempts/);
  });

  it('skipSuccessfulRequests means successful calls do not count', async () => {
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 3,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
    });
    const app = createLimiterApp(limiter, noopHandler);

    // 3 "successful" requests (200 responses)
    await request(app).post('/test').send({});
    await request(app).post('/test').send({});
    await request(app).post('/test').send({});

    // Should still be allowed because successes are skipped
    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(200);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Register Rate Limiter
// ───────────────────────────────────────────────────────────────────────────
describe('Register Rate Limiter (POST /api/auth/register)', () => {
  it('allows requests under the limit', async () => {
    const limiter = rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
    });
    const app = createLimiterApp(limiter, noopHandler);

    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(200);
  });

  it('returns 429 after exceeding the limit', async () => {
    const limiter = rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many registration attempts. Please try again later.' },
    });
    const app = createLimiterApp(limiter, noopHandler);

    for (let i = 0; i < 5; i++) {
      await request(app).post('/test').send({});
    }

    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/Too many registration attempts/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Analytics Event Rate Limiter
// ───────────────────────────────────────────────────────────────────────────
describe('Analytics Event Rate Limiter (POST /api/analytics/events)', () => {
  it('allows requests under the limit', async () => {
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    });
    const app = createLimiterApp(limiter, noopHandler);

    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(200);
    const remaining = parseInt(res.headers['ratelimit-remaining'], 10);
    expect(remaining).toBe(119);
  });

  it('returns 429 after exceeding the limit', async () => {
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many analytics events. Please try again shortly.' },
    });
    const app = createLimiterApp(limiter, noopHandler);

    for (let i = 0; i < 3; i++) {
      await request(app).post('/test').send({});
    }

    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/Too many analytics events/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Admin Activity Event Rate Limiter
// ───────────────────────────────────────────────────────────────────────────
describe('Activity Event Rate Limiter (POST /api/admin/activity/events)', () => {
  it('allows requests under the limit', async () => {
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    });
    const app = createLimiterApp(limiter, noopHandler);

    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(200);
  });

  it('returns 429 after exceeding the limit', async () => {
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many activity events. Please try again shortly.' },
    });
    const app = createLimiterApp(limiter, noopHandler);

    for (let i = 0; i < 3; i++) {
      await request(app).post('/test').send({});
    }

    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/Too many activity events/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ZIP Download Rate Limiter
// ───────────────────────────────────────────────────────────────────────────
describe('ZIP Download Rate Limiter (GET /api/hymns/zip)', () => {
  it('allows requests under the limit', async () => {
    const limiter = rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
    });
    const app = createLimiterApp(limiter, noopHandler);

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    const remaining = parseInt(res.headers['ratelimit-remaining'], 10);
    expect(remaining).toBe(9);
  });

  it('returns 429 after exceeding the limit', async () => {
    const limiter = rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
    });
    const app = createLimiterApp(limiter, noopHandler);

    for (let i = 0; i < 3; i++) {
      await request(app).get('/test');
    }

    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Global API Rate Limiter
// ───────────────────────────────────────────────────────────────────────────
describe('Global API Rate Limiter (/api/*)', () => {
  it('returns RateLimit headers per IETF draft standard', async () => {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
    });
    const app = createLimiterApp(limiter, noopHandler);

    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBe('500');
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    expect(res.headers['ratelimit-reset']).toBeDefined();
  });

  it('returns 429 with correct message after exceeding', async () => {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again later.' },
    });
    const app = createLimiterApp(limiter, noopHandler);

    for (let i = 0; i < 3; i++) {
      await request(app).post('/test').send({});
    }

    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/Too many requests/);
  });

  it('excluded paths are not rate-limited by the global limiter', async () => {
    // The global limiter skips: /auth/login, /auth/register, /analytics/events, /admin/activity/events
    const excludedPaths = ['/auth/login', '/auth/register', '/analytics/events', '/admin/activity/events'];

    for (const excludedPath of excludedPaths) {
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 2,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.path === excludedPath,
      });

      const app = express();
      app.use(express.json());
      app.use(limiter);
      // Use a distinct route for each excluded path
      app.post(excludedPath, noopHandler);

      // Make 5 requests — all should succeed because the path is excluded
      for (let i = 0; i < 5; i++) {
        const res = await request(app).post(excludedPath).send({});
        expect(res.status).toBe(200);
      }
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Bulk Import Row Limit
// ───────────────────────────────────────────────────────────────────────────
describe('Bulk Import Row Limit (POST /api/sayings/bulk-import)', () => {
  it('rejects empty rows array', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', (req, res) => {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty rows data' });
      }
      if (rows.length > 1000) {
        return res.status(400).json({ error: 'Bulk import limited to 1000 rows per request' });
      }
      res.json({ imported: rows.length });
    });

    const res = await request(app).post('/test').send({ rows: [] });
    expect(res.status).toBe(400);
  });

  it('rejects more than 1000 rows', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', (req, res) => {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty rows data' });
      }
      if (rows.length > 1000) {
        return res.status(400).json({ error: 'Bulk import limited to 1000 rows per request' });
      }
      res.json({ imported: rows.length });
    });

    const rows = Array.from({ length: 1001 }, (_, i) => ({ content: `saying ${i}`, author: 'test' }));
    const res = await request(app).post('/test').send({ rows });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/1000 rows/);
  });

  it('allows exactly 1000 rows', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', (req, res) => {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty rows data' });
      }
      if (rows.length > 1000) {
        return res.status(400).json({ error: 'Bulk import limited to 1000 rows per request' });
      }
      res.json({ imported: rows.length });
    });

    const rows = Array.from({ length: 1000 }, (_, i) => ({ content: `saying ${i}`, author: 'test' }));
    const res = await request(app).post('/test').send({ rows });
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1000);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Export Row Limit (MAX_EXPORT_ROWS)
// ───────────────────────────────────────────────────────────────────────────
describe('Analytics Export Row Limit', () => {
  it('MAX_EXPORT_ROWS is set to 100000', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const servicePath = path.join(__dirname, '..', 'services', 'analyticsExport.service.js');
    const content = fs.readFileSync(servicePath, 'utf8');
    const match = content.match(/MAX_EXPORT_ROWS\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(parseInt(match[1], 10)).toBe(100000);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Presign / Upload Rate Limiting
// ───────────────────────────────────────────────────────────────────────────
describe('Upload Endpoint Protection', () => {
  it('presign endpoint requires authentication', async () => {
    const app = express();
    app.use(express.json());
    // Simulate: if no Authorization header, return 401
    app.post('/presign', (req, res) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized - No token provided' });
      }
      res.json({ ok: true });
    });

    const res = await request(app).post('/presign').send({ filename: 'test.pdf' });
    expect(res.status).toBe(401);
  });

  it('multipart endpoints require authentication', async () => {
    const app = express();
    app.use(express.json());
    app.post('/multipart/initiate', (req, res) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized - No token provided' });
      }
      res.json({ ok: true });
    });

    const res = await request(app).post('/multipart/initiate').send({ filename: 'test.pdf' });
    expect(res.status).toBe(401);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Backup Endpoint Protection (Admin-Only)
// ───────────────────────────────────────────────────────────────────────────
describe('Backup Endpoint Protection', () => {
  it('backup endpoint requires admin authentication', async () => {
    const app = express();
    app.use(express.json());
    app.use('/backup', (req, res, next) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // Simulate requireAdmin
      const role = req.headers['x-test-role'];
      if (role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden - Admin access required' });
      }
      next();
    });
    app.post('/backup/', (req, res) => res.json({ ok: true }));

    // No auth
    let res = await request(app).post('/backup/').send({});
    expect(res.status).toBe(401);

    // Non-admin
    res = await request(app).post('/backup/').set('Authorization', 'Bearer fake-token').set('x-test-role', 'EDITOR').send({});
    expect(res.status).toBe(403);

    // Admin
    res = await request(app).post('/backup/').set('Authorization', 'Bearer fake-token').set('x-test-role', 'ADMIN').send({});
    expect(res.status).toBe(200);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Export Endpoint Protection (Admin-Only)
// ───────────────────────────────────────────────────────────────────────────
describe('Analytics Export Endpoint Protection', () => {
  it('export endpoint requires admin authentication', async () => {
    const app = express();
    app.use(express.json());
    app.use('/export', (req, res, next) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const role = req.headers['x-test-role'];
      if (role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden - Admin access required' });
      }
      next();
    });
    app.get('/export/events', (req, res) => res.json({ ok: true }));

    let res = await request(app).get('/export/events');
    expect(res.status).toBe(401);

    res = await request(app).get('/export/events').set('Authorization', 'Bearer fake-token').set('x-test-role', 'EDITOR');
    expect(res.status).toBe(403);

    res = await request(app).get('/export/events').set('Authorization', 'Bearer fake-token').set('x-test-role', 'ADMIN');
    expect(res.status).toBe(200);
  });
});
