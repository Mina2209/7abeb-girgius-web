import { describe, it, expect, vi } from 'vitest';

// ── Mocks (must come before router import) ───────────────────────────────
vi.mock('../controllers/hymn.controller.js', () => ({
  HymnController: {
    getAll: vi.fn((_, res) => res.json([])),
    getById: vi.fn((_, res) => res.json({})),
    downloadZip: vi.fn((_, res) => {
      res.setHeader('Content-Type', 'application/zip');
      res.end(Buffer.from('fake-zip'));
    }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../middleware/auth.js', () => ({
  authenticate: vi.fn((_, __, next) => next()),
  requireEditor: vi.fn((_, __, next) => next()),
}));

vi.mock('../middleware/validate.js', () => ({
  validate: vi.fn(() => (_, __, next) => next()),
}));

vi.mock('../services/prisma.js', () => ({ prisma: {} }));

// ── Imports ─────────────────────────────────────────────────────────────
import express from 'express';
import request from 'supertest';
import hymnRouter from '../routes/hymn.routes.js';

function buildApp() {
  const app = express();
  app.use('/api/hymns', hymnRouter);
  return app;
}

// ── Tests ───────────────────────────────────────────────────────────────
describe('ZIP download rate limiter – /api/hymns/zip', () => {
  it('allows requests within the limit (10 per hour)', async () => {
    const app = buildApp();
    for (let i = 0; i < 10; i++) {
      const res = await request(app).get('/api/hymns/zip');
      expect(res.status).toBe(200);
    }
  });

  it('blocks the 11th request with 429', async () => {
    const app = buildApp();
    for (let i = 0; i < 10; i++) {
      await request(app).get('/api/hymns/zip');
    }
    const blocked = await request(app).get('/api/hymns/zip');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many/i);
  });

  it('returns standard rate-limit headers', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/hymns/zip');
    // express-rate-limit with standardHeaders: true sends RateLimit-* headers
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });

  it('does not rate-limit other hymn routes (GET /)', async () => {
    const app = buildApp();
    for (let i = 0; i < 15; i++) {
      const res = await request(app).get('/api/hymns');
      expect(res.status).toBe(200);
    }
  });
});
