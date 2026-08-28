import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted: available inside vi.mock factories ─────────────────────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../services/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue('hashed-password'),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock-jwt-token'),
    verify: vi.fn(),
  },
}));

// ── Import AFTER mocks ──────────────────────────────────────────────────
import { authService } from '../services/auth.service.js';

describe('Brute-Force Protection', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('should apply progressive delay after multiple failed attempts', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      password: 'hashed-password',
      role: 'VIEWER',
      tokenVersion: 0,
    });

    const bcrypt = await import('bcryptjs');
    bcrypt.default.compare.mockResolvedValue(false);

    const delays = [];
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = vi.fn((fn, delay) => {
      delays.push(delay);
      return originalSetTimeout(fn, 0);
    });

    for (let i = 0; i < 3; i++) {
      try {
        await authService.login('testuser', 'wrongpassword');
      } catch (e) {
        // Expected to fail
      }
    }

    global.setTimeout = originalSetTimeout;

    // Should have applied 1 delay for attempt 3 (attempt 1 and 2 have 0 delay)
    expect(delays.length).toBe(1);
    expect(delays[0]).toBeGreaterThan(0);
  });

  it('should clear failures on successful login', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      password: 'hashed-password',
      role: 'VIEWER',
      tokenVersion: 0,
    });

    const bcrypt = await import('bcryptjs');

    // First, make a failed attempt
    bcrypt.default.compare.mockResolvedValue(false);
    try {
      await authService.login('testuser', 'wrongpassword');
    } catch (e) {
      // Expected
    }

    // Now make a successful attempt
    bcrypt.default.compare.mockResolvedValue(true);
    const result = await authService.login('testuser', 'correctpassword');

    expect(result.token).toBe('mock-jwt-token');
  });

  it('should apply same delay for non-existent users to prevent enumeration', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const delays = [];
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = vi.fn((fn, delay) => {
      delays.push(delay);
      return originalSetTimeout(fn, 0);
    });

    for (let i = 0; i < 3; i++) {
      try {
        await authService.login('nonexistentuser', 'password');
      } catch (e) {
        // Expected
      }
    }

    global.setTimeout = originalSetTimeout;

    // Should have applied 1 delay for attempt 3 (attempt 1 and 2 have 0 delay)
    expect(delays.length).toBe(1);
  });
});
