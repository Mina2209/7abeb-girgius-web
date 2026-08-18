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
import { optionalAuthenticate } from '../middleware/auth.js';

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
// optionalAuthenticate fires an async prisma.findUnique().then() chain internally.
// The middleware function itself returns before the promise settles, so tests need
// to yield to the microtask queue before asserting on req.user.
const flush = () => new Promise((r) => setTimeout(r, 100));

// ── Tests ───────────────────────────────────────────────────────────────
describe('optionalAuthenticate – tokenVersion enforcement', () => {
  beforeEach(() => dbTokens.clear());

  it('proceeds anonymously when no Authorization header', async () => {
    const req = fakeReq(null);
    const next = vi.fn();
    await optionalAuthenticate(req, fakeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('attaches user when tokenVersion matches DB', async () => {
    dbTokens.set('u1', 0);
    const token = sign({ tokenVersion: 0 });
    const req = fakeReq(token);
    const next = vi.fn();
    await optionalAuthenticate(req, fakeRes(), next);
    await flush();
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('u1');
  });

  it('proceeds anonymously when tokenVersion mismatches (revoked token)', async () => {
    dbTokens.set('u1', 1);
    const token = sign({ tokenVersion: 0 });
    const req = fakeReq(token);
    const next = vi.fn();
    await optionalAuthenticate(req, fakeRes(), next);
    await flush();
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('proceeds anonymously when user not found in DB', async () => {
    const token = jwt.sign({ id: 'deleted-user', role: 'VIEWER', tokenVersion: 0 }, JWT_SECRET);
    const req = fakeReq(token);
    const next = vi.fn();
    await optionalAuthenticate(req, fakeRes(), next);
    await flush();
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('proceeds anonymously on DB error (never rejects)', async () => {
    const { prisma } = await import('../services/prisma.js');
    const original = prisma.user.findUnique;
    prisma.user.findUnique = vi.fn().mockRejectedValue(new Error('DB connection lost'));

    const token = sign();
    const req = fakeReq(token);
    const next = vi.fn();
    await optionalAuthenticate(req, fakeRes(), next);
    await flush();
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();

    prisma.user.findUnique = original;
  });

  it('proceeds anonymously on invalid/expired token', async () => {
    const req = fakeReq('not.a.valid.jwt');
    const next = vi.fn();
    await optionalAuthenticate(req, fakeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('proceeds anonymously when legacy token has no tokenVersion field', async () => {
    dbTokens.set('u1', 0);
    const token = jwt.sign({ id: 'u1', username: 'alice', role: 'VIEWER' }, JWT_SECRET);
    const req = fakeReq(token);
    const next = vi.fn();
    await optionalAuthenticate(req, fakeRes(), next);
    await flush();
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
  });
});
