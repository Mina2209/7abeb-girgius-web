import { describe, it, expect, vi, beforeEach } from 'vitest';

// Ensures every current token-issuance path embeds tokenVersion. The strict
// middleware check added in P1-B would otherwise reject tokens issued here.

const { mockPrisma, JWT_SECRET } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-token-issuance';
  return {
    mockPrisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    },
    JWT_SECRET: 'test-secret-token-issuance',
  };
});

vi.mock('../services/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue('hashed-password'),
  },
}));

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authService } from '../services/auth.service.js';

const loginUser = {
  id: 'u1',
  username: 'alice',
  email: 'alice@church.com',
  password: 'hashed-password',
  role: 'EDITOR',
  full_name: null,
  church_name: null,
  church_role: null,
  services: [],
  avatar_url: null,
  tokenVersion: 7,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('token issuance includes tokenVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bcrypt.hash.mockResolvedValue('hashed-password');
  });

  it('login signs the stored tokenVersion', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(loginUser);
    bcrypt.compare.mockResolvedValue(true);

    const { token } = await authService.login('alice', 'ValidPass1!');
    const decoded = jwt.verify(token, JWT_SECRET);

    expect(decoded.tokenVersion).toBe(7);
  });

  it('register signs the default tokenVersion (0)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'u2',
      username: 'newuser',
      email: null,
      role: 'VIEWER',
      full_name: null,
      church_name: null,
      church_role: null,
      services: [],
      avatar_url: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const { token } = await authService.register(
      'newuser', null, 'ValidPass1!', null, null, null, [],
    );
    const decoded = jwt.verify(token, JWT_SECRET);

    expect(decoded.tokenVersion).toBe(0);
  });
});
