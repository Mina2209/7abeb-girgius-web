import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────
const { authServiceMock, logServiceMock } = vi.hoisted(() => ({
  authServiceMock: { updateUser: vi.fn().mockResolvedValue({ id: 'u1', username: 'alice', role: 'ADMIN' }) },
  logServiceMock: { createLog: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../services/log.service.js', () => ({ logService: logServiceMock }));
vi.mock('../services/auth.service.js', () => ({ authService: authServiceMock }));

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
      { params: { id: 'u1' }, body: { username: 'alice', password: 'new', role: 'EDITOR' }, user: { id: 'admin' } },
      fakeRes(),
    );
    expect(authServiceMock.updateUser).toHaveBeenCalledWith('u1', {
      username: 'alice',
      password: 'new',
      role: 'EDITOR',
    });
  });

  it('rejects tokenVersion, id, createdAt, updatedAt – they never reach the service', async () => {
    await authController.updateUser(
      { params: { id: 'u1' }, body: { tokenVersion: 99, id: 'x', createdAt: 'y', updatedAt: 'z', role: 'EDITOR' }, user: { id: 'admin' } },
      fakeRes(),
    );
    expect(authServiceMock.updateUser).toHaveBeenCalledWith('u1', { role: 'EDITOR' });
  });

  it('allows partial updates (only username)', async () => {
    await authController.updateUser(
      { params: { id: 'u1' }, body: { username: 'bob' }, user: { id: 'admin' } },
      fakeRes(),
    );
    expect(authServiceMock.updateUser).toHaveBeenCalledWith('u1', { username: 'bob' });
  });

  it('allows role updates (admin role management)', async () => {
    await authController.updateUser(
      { params: { id: 'u1' }, body: { role: 'ADMIN' }, user: { id: 'admin' } },
      fakeRes(),
    );
    expect(authServiceMock.updateUser).toHaveBeenCalledWith('u1', { role: 'ADMIN' });
  });

  it('returns allowlisted fields even on empty body', async () => {
    await authController.updateUser(
      { params: { id: 'u1' }, body: {}, user: { id: 'admin' } },
      fakeRes(),
    );
    expect(authServiceMock.updateUser).toHaveBeenCalledWith('u1', {});
  });

  it('strips non-allowlisted fields even when injected through body spread', async () => {
    await authController.updateUser(
      {
        params: { id: 'u1' },
        body: { username: 'ok', tokenVersion: 0, id: 'other', full_name: 'hacker', password: 'safe' },
        user: { id: 'admin' },
      },
      fakeRes(),
    );
    expect(authServiceMock.updateUser).toHaveBeenCalledWith('u1', {
      username: 'ok',
      password: 'safe',
    });
  });
});
