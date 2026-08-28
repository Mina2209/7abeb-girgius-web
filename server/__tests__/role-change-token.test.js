import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted: available inside vi.mock factories ─────────────────────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(3),
    },
  },
}));

vi.mock('../services/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
  },
}));

// ── Import AFTER mocks ──────────────────────────────────────────────────
import { authService } from '../services/auth.service.js';

describe('Role Change Token Invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should increment tokenVersion when role changes', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', tokenVersion: 0 });
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', username: 'test', role: 'EDITOR', updatedAt: new Date() });

    await authService.updateUser('user-1', { role: 'EDITOR' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: 'EDITOR', tokenVersion: { increment: 1 } },
      select: { id: true, username: true, role: true, updatedAt: true },
    });
  });

  it('should NOT increment tokenVersion when role is unchanged', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'EDITOR', tokenVersion: 0 });
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', username: 'test', role: 'EDITOR', updatedAt: new Date() });

    await authService.updateUser('user-1', { role: 'EDITOR' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: 'EDITOR' },
      select: { id: true, username: true, role: true, updatedAt: true },
    });
  });

  it('should increment tokenVersion when both password and role change', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', tokenVersion: 0 });
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', username: 'test', role: 'EDITOR', updatedAt: new Date() });

    await authService.updateUser('user-1', { password: 'newpassword', role: 'EDITOR' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        password: 'hashed-password',
        role: 'EDITOR',
        tokenVersion: { increment: 1 },
      },
      select: { id: true, username: true, role: true, updatedAt: true },
    });
  });

  it('should handle ADMIN -> EDITOR demotion correctly', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', tokenVersion: 2 });
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', username: 'admin', role: 'EDITOR', updatedAt: new Date() });

    await authService.updateUser('user-1', { role: 'EDITOR' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: 'EDITOR', tokenVersion: { increment: 1 } },
      select: { id: true, username: true, role: true, updatedAt: true },
    });
  });

  it('should handle EDITOR -> VIEWER demotion correctly', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'EDITOR', tokenVersion: 1 });
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', username: 'editor', role: 'VIEWER', updatedAt: new Date() });

    await authService.updateUser('user-1', { role: 'VIEWER' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: 'VIEWER', tokenVersion: { increment: 1 } },
      select: { id: true, username: true, role: true, updatedAt: true },
    });
  });

  it('should handle VIEWER -> ADMIN promotion correctly', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'VIEWER', tokenVersion: 0 });
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', username: 'viewer', role: 'ADMIN', updatedAt: new Date() });

    await authService.updateUser('user-1', { role: 'ADMIN' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: 'ADMIN', tokenVersion: { increment: 1 } },
      select: { id: true, username: true, role: true, updatedAt: true },
    });
  });
});
