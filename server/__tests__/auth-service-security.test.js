import { describe, it, expect, vi, beforeEach } from 'vitest';

// Service-level tests for authService.updateUser.
// Uses vi.hoisted for the mock prisma so it's available inside vi.mock factories.

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      update: vi.fn(),
    },
  },
}));

vi.mock('../services/prisma.js', () => ({ prisma: mockPrisma }));

import { authService } from '../services/auth.service.js';

describe('auth.service – updateUser defensive strip', () => {
  beforeEach(() => {
    mockPrisma.user.update.mockReset();
    mockPrisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'u1', username: data.username ?? 'alice', role: data.role ?? 'EDITOR', updatedAt: new Date() }),
    );
  });

  it('strips tokenVersion, id, createdAt, updatedAt from input', async () => {
    await authService.updateUser('u1', {
      username: 'alice',
      tokenVersion: 99,
      id: 'WRONG',
      createdAt: '2020-01-01',
      updatedAt: '2020-01-01',
    });
    const passedData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(passedData).not.toHaveProperty('tokenVersion');
    expect(passedData).not.toHaveProperty('id');
    expect(passedData).not.toHaveProperty('createdAt');
    expect(passedData).not.toHaveProperty('updatedAt');
    expect(passedData.username).toBe('alice');
  });

  it('hashes password and increments tokenVersion when password is provided', async () => {
    await authService.updateUser('u1', { password: 'newpass' });
    const passedData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(passedData.password).not.toBe('newpass');
    expect(typeof passedData.password).toBe('string');
    expect(passedData.password.length).toBeGreaterThan(20);
    expect(passedData.tokenVersion).toEqual({ increment: 1 });
  });

  it('does NOT set tokenVersion when password is not provided', async () => {
    await authService.updateUser('u1', { username: 'bob' });
    const passedData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(passedData).not.toHaveProperty('tokenVersion');
    expect(passedData.username).toBe('bob');
  });
});
