import { describe, it, expect, vi, beforeEach } from 'vitest';

// Credential normalization tests (case-insensitive username/email).
// Uses the repository's standard mocked-Prisma Vitest pattern.

const { mockPrisma, mockLogService } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
  mockLogService: {
    createLog: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../services/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../services/log.service.js', () => ({ logService: mockLogService }));
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

import { authService, normalizeUsername, normalizeEmail } from '../services/auth.service.js';
import { authController } from '../controllers/auth.controller.js';

function fakeRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

const baseUser = {
  id: 'u1',
  username: 'nadia',
  email: 'nadia@church.com',
  password: 'hashed-password',
  role: 'VIEWER',
  tokenVersion: 0,
};

describe('normalizeUsername / normalizeEmail helpers', () => {
  it('trims, strips the local part before @, and lowercases', () => {
    expect(normalizeUsername('  Nadia@Church.com  ')).toBe('nadia');
    expect(normalizeUsername('Nadia')).toBe('nadia');
  });

  it('normalizeUsername("@x") returns empty string', () => {
    expect(normalizeUsername('@x')).toBe('');
  });

  it('normalizeUsername handles non-strings safely', () => {
    expect(normalizeUsername(undefined)).toBe('');
    expect(normalizeUsername(null)).toBe('');
    expect(normalizeUsername(123)).toBe('');
  });

  it('normalizeEmail trims, lowercases and returns null for empty', () => {
    expect(normalizeEmail('  Nadia@Church.Com  ')).toBe('nadia@church.com');
    expect(normalizeEmail('   ')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe('auth.service – register normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'u1', username: data.username, email: data.email, role: 'VIEWER' }),
    );
  });

  it('stores mixed-case email/username as lowercase values', async () => {
    await authService.register('Nadia@Church.com', '  Nadia@Church.Com ', 'Passw0rd!', null, null, null, []);

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: 'nadia',
          email: 'nadia@church.com',
        }),
      }),
    );
  });

  it('checks for duplicate email using the normalized lowercase email', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // username check
      .mockResolvedValueOnce({ id: 'existing' }); // email check hits a duplicate

    await expect(
      authService.register('Nadia@Church.com', 'Nadia@Church.Com', 'Passw0rd!', null, null, null, []),
    ).rejects.toThrow('البريد الإلكتروني مستخدم بالفعل');

    expect(mockPrisma.user.findUnique).toHaveBeenNthCalledWith(2, { where: { email: 'nadia@church.com' } });
  });
});

describe('auth.service – login normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);
  });

  it('login with uppercase email looks up the lowercase local-part username', async () => {
    const bcrypt = await import('bcryptjs');
    bcrypt.default.compare.mockResolvedValue(true);

    await authService.login('NADIA@CHURCH.COM', 'pw');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: 'nadia' } }),
    );
  });

  it('login with lowercase username looks up the same normalized username', async () => {
    const bcrypt = await import('bcryptjs');
    bcrypt.default.compare.mockResolvedValue(true);

    await authService.login('nadia', 'pw');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: 'nadia' } }),
    );
  });

  it('login with mixed-case username reaches the same account', async () => {
    const bcrypt = await import('bcryptjs');
    bcrypt.default.compare.mockResolvedValue(true);

    await authService.login('NaDiA', 'pw');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: 'nadia' } }),
    );
  });
});

describe('auth.service – admin createUser normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'u2', username: data.username, role: data.role, createdAt: new Date() }),
    );
  });

  it('normalizes the admin-created username (local part, lowercase)', async () => {
    const user = await authService.createUser('  Maria@Church.com  ', 'Passw0rd!', 'EDITOR');

    expect(user.username).toBe('maria');
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ username: 'maria' }),
      }),
    );
  });
});

describe('auth.service – updateUser username normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'u1', username: data.username, role: 'EDITOR', updatedAt: new Date() }),
    );
  });

  it('normalizes a username being changed by an admin', async () => {
    await authService.updateUser('u1', { username: '  ALICE  ' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ username: 'alice' }),
      }),
    );
  });
});

describe('auth.service – requestPasswordReset normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    mockPrisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'u1', username: 'nadia', role: 'VIEWER', updatedAt: new Date() }),
    );
  });

  it('normalizes the identifier and keeps mode:insensitive on both branches', async () => {
    await authService.requestPasswordReset('  NADIA@CHURCH.COM  ');

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { username: { equals: 'nadia', mode: 'insensitive' } },
            { email: { equals: 'nadia@church.com', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('resets to a temporary password and invalidates sessions', async () => {
    const result = await authService.requestPasswordReset('nadia');

    expect(result.temporaryPassword).toEqual(expect.any(String));
    expect(result.temporaryPassword.length).toBeGreaterThan(0);
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });
});

describe('auth.controller – forgotPassword compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    mockPrisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'u1', username: 'nadia', role: 'VIEWER', updatedAt: new Date() }),
    );
  });

  it('accepts a mixed-case email identifier and returns a temporary password', async () => {
    const req = { body: { identifier: '  NADIA@CHURCH.COM  ' } };
    const res = fakeRes();

    await authController.forgotPassword(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, temporaryPassword: expect.any(String) }),
    );
    expect(mockLogService.createLog).toHaveBeenCalled();
  });
});