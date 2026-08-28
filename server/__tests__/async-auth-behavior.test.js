import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// ── Hoisted: available inside vi.mock factories ─────────────────────────
const { dbTokens, JWT_SECRET } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-key';
  return { dbTokens: new Map(), JWT_SECRET: 'test-secret-key' };
});

// ── Mock prisma.user.findUnique ─────────────────────────────────────────
vi.mock('../services/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(({ where: { id } }) => {
        const tv = dbTokens.get(id);
        return tv !== undefined ? Promise.resolve({ tokenVersion: tv }) : Promise.resolve(null);
      }),
    },
  },
}));

// ── Import AFTER mocks ──────────────────────────────────────────────────
import { authenticate } from '../middleware/auth.js';

// ── Helpers ─────────────────────────────────────────────────────────────
function fakeReq(token) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} };
}
function fakeRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}
function sign(overrides = {}) {
  return jwt.sign({ id: 'u1', username: 'alice', role: 'VIEWER', tokenVersion: 0, ...overrides }, JWT_SECRET);
}
const flush = () => new Promise((r) => setTimeout(r, 100));

// ── Tests ───────────────────────────────────────────────────────────────
describe('authenticate – async middleware behavior', () => {
  beforeEach(() => dbTokens.clear());

  it('calls next() and attaches user when token is valid and user exists', async () => {
    dbTokens.set('u1', 0);
    const token = sign({ tokenVersion: 0 });
    const req = fakeReq(token);
    const res = fakeRes();
    const next = vi.fn();
    authenticate(req, res, next);
    await flush();
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('u1');
  });

  it('returns 401 when tokenVersion mismatches (revoked token)', async () => {
    dbTokens.set('u1', 1);
    const token = sign({ tokenVersion: 0 });
    const req = fakeReq(token);
    const res = fakeRes();
    const next = vi.fn();
    authenticate(req, res, next);
    await flush();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized - Token revoked' });
  });

  it('returns 401 when user not found in DB', async () => {
    const token = sign({ id: 'deleted-user' });
    const req = fakeReq(token);
    const res = fakeRes();
    const next = vi.fn();
    authenticate(req, res, next);
    await flush();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 on DB error', async () => {
    const { prisma } = await import('../services/prisma.js');
    const original = prisma.user.findUnique;
    prisma.user.findUnique = vi.fn().mockRejectedValue(new Error('DB connection lost'));

    const token = sign();
    const req = fakeReq(token);
    const res = fakeRes();
    const next = vi.fn();
    authenticate(req, res, next);
    await flush();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized - Token verification failed' });

    prisma.user.findUnique = original;
  });

  it('returns 401 on invalid token', async () => {
    const req = fakeReq('not.a.valid.jwt');
    const res = fakeRes();
    const next = vi.fn();
    authenticate(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when no token provided', async () => {
    const req = fakeReq(null);
    const res = fakeRes();
    const next = vi.fn();
    authenticate(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts legacy tokens without tokenVersion field', async () => {
    dbTokens.set('u1', 0);
    const token = jwt.sign({ id: 'u1', username: 'alice', role: 'VIEWER' }, JWT_SECRET);
    const req = fakeReq(token);
    const res = fakeRes();
    const next = vi.fn();
    authenticate(req, res, next);
    await flush();
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
  });

  it('does not bypass auth when DB is slow', async () => {
    dbTokens.set('u1', 0);
    const token = sign({ tokenVersion: 0 });
    const req = fakeReq(token);
    const res = fakeRes();
    const next = vi.fn();
    authenticate(req, res, next);
    // Before flush, next should NOT have been called yet
    // because the DB query is async
    await flush();
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
