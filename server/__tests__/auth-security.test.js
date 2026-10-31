import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────
const { authServiceMock, logServiceMock } = vi.hoisted(() => ({
  authServiceMock: { updateUser: vi.fn().mockResolvedValue({ id: 'u1', username: 'alice', role: 'ADMIN' }) },
  logServiceMock: { createLog: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../services/log.service.js', () => ({ logService: logServiceMock }));
vi.mock('../services/auth.service.js', () => ({
  authService: authServiceMock,
  normalizeUsername: (v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''),
  normalizeEmail: (v) => (typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : null),
}));

// ── Imports ─────────────────────────────────────────────────────────────
import { authController } from '../controllers/auth.controller.js';

// ── Helpers ─────────────────────────────────────────────────────────────
function fakeRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

// ── Tests ───────────────────────────────────────────────────────────────
describe('auth.controller – updateUser allowlist', () => {
  beforeEach(() => authServiceMock.updateUser.mockClear());

  it('passes only allowlisted fields (username, password, role) to the service', async () => {
    await authController.updateUser(
      { params: { id: 'u1' }, body: { username: 'alice', password: 'NewPass1!', role: 'EDITOR' }, user: { id: 'admin' } },
      fakeRes(),
    );
    expect(authServiceMock.updateUser).toHaveBeenCalledWith('u1', {
      username: 'alice',
      password: 'NewPass1!',
      role: 'EDITOR',
    }, { requestingUserId: 'admin' });
  });

  it('rejects tokenVersion, id, createdAt, updatedAt – they never reach the service', async () => {
    await authController.updateUser(
      { params: { id: 'u1' }, body: { tokenVersion: 99, id: 'x', createdAt: 'y', updatedAt: 'z', role: 'EDITOR' }, user: { id: 'admin' } },
      fakeRes(),
    );
    expect(authServiceMock.updateUser).toHaveBeenCalledWith('u1', { role: 'EDITOR' }, { requestingUserId: 'admin' });
  });

  it('allows partial updates (only username)', async () => {
    await authController.updateUser(
      { params: { id: 'u1' }, body: { username: 'bob' }, user: { id: 'admin' } },
      fakeRes(),
    );
    expect(authServiceMock.updateUser).toHaveBeenCalledWith('u1', { username: 'bob' }, { requestingUserId: 'admin' });
  });

  it('allows role updates (admin role management)', async () => {
    await authController.updateUser(
      { params: { id: 'u1' }, body: { role: 'ADMIN' }, user: { id: 'admin' } },
      fakeRes(),
    );
    expect(authServiceMock.updateUser).toHaveBeenCalledWith('u1', { role: 'ADMIN' }, { requestingUserId: 'admin' });
  });

  it('returns allowlisted fields even on empty body', async () => {
    await authController.updateUser(
      { params: { id: 'u1' }, body: {}, user: { id: 'admin' } },
      fakeRes(),
    );
    expect(authServiceMock.updateUser).toHaveBeenCalledWith('u1', {}, { requestingUserId: 'admin' });
  });

  it('strips non-allowlisted fields even when injected through body spread', async () => {
    await authController.updateUser(
      {
        params: { id: 'u1' },
        body: { username: 'ok', tokenVersion: 0, id: 'other', full_name: 'hacker', password: 'NewPass1!' },
        user: { id: 'admin' },
      },
      fakeRes(),
    );
    expect(authServiceMock.updateUser).toHaveBeenCalledWith('u1', {
      username: 'ok',
      password: 'NewPass1!',
    }, { requestingUserId: 'admin' });
  });
});

describe('auth.controller – updateUser password validation', () => {
  beforeEach(() => authServiceMock.updateUser.mockClear());

  it('rejects an empty password before calling the service', async () => {
    const res = fakeRes();
    await authController.updateUser(
      { params: { id: 'u1' }, body: { password: '' }, user: { id: 'admin' } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Password must be between 8 and 128 characters',
    });
    expect(authServiceMock.updateUser).not.toHaveBeenCalled();
  });

  it('rejects a weak password before calling the service', async () => {
    const res = fakeRes();
    await authController.updateUser(
      { params: { id: 'u1' }, body: { password: 'weakpass' }, user: { id: 'admin' } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Password must contain at least one uppercase letter',
    });
    expect(authServiceMock.updateUser).not.toHaveBeenCalled();
  });

  it('rejects a non-string password before calling the service', async () => {
    const res = fakeRes();
    await authController.updateUser(
      { params: { id: 'u1' }, body: { password: 12345678 }, user: { id: 'admin' } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Password must be a string',
    });
    expect(authServiceMock.updateUser).not.toHaveBeenCalled();
  });

  it('accepts a policy-compliant password and forwards it to the service', async () => {
    const res = fakeRes();
    await authController.updateUser(
      { params: { id: 'u1' }, body: { password: 'NewPass1!' }, user: { id: 'admin' } },
      res,
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(authServiceMock.updateUser).toHaveBeenCalledWith(
      'u1',
      { password: 'NewPass1!' },
      { requestingUserId: 'admin' },
    );
  });

  it('allows username/role updates without a password field', async () => {
    const res = fakeRes();
    await authController.updateUser(
      { params: { id: 'u1' }, body: { username: 'alice2', role: 'EDITOR' }, user: { id: 'admin' } },
      res,
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(authServiceMock.updateUser).toHaveBeenCalledWith(
      'u1',
      { username: 'alice2', role: 'EDITOR' },
      { requestingUserId: 'admin' },
    );
  });
});
