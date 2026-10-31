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

describe('auth.service – requestPasswordReset safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1' });
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

  it('does not change the password or return a secret for an existing account', async () => {
    const result = await authService.requestPasswordReset('nadia');

    expect(result).toEqual({ userId: 'u1' });
    expect(result).not.toHaveProperty('temporaryPassword');
    expect(result).not.toHaveProperty('token');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('returns a null userId for an unknown identifier without throwing', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(authService.requestPasswordReset('ghost')).resolves.toEqual({ userId: null });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe('auth.controller – forgotPassword safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1' });
  });

  it('returns a generic response with no password or token', async () => {
    const req = { body: { identifier: '  NADIA@CHURCH.COM  ' } };
    const res = fakeRes();
    const next = vi.fn();

    await authController.forgotPassword(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload).toMatchObject({ ok: true });
    expect(payload).not.toHaveProperty('temporaryPassword');
    expect(payload).not.toHaveProperty('token');
    expect(payload).not.toHaveProperty('password');
    expect(payload).not.toHaveProperty('userId');
    expect(next).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockLogService.createLog).toHaveBeenCalled();
  });

  it('returns the exact same response for unknown accounts (no enumeration)', async () => {
    const knownRes = fakeRes();
    const unknownRes = fakeRes();

    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'u1' });
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    await authController.forgotPassword({ body: { identifier: 'nadia' } }, knownRes, vi.fn());
    await authController.forgotPassword({ body: { identifier: 'ghost' } }, unknownRes, vi.fn());

    expect(knownRes.status).not.toHaveBeenCalled();
    expect(unknownRes.status).not.toHaveBeenCalled();
    expect(unknownRes.json.mock.calls[0][0]).toEqual(knownRes.json.mock.calls[0][0]);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('does not leak database details when the lookup fails', async () => {
    const { errorHandler } = await import('../middleware/errorHandler.js');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = {
      body: { identifier: 'nadia' },
      method: 'POST',
      originalUrl: '/api/auth/forgot-password',
    };
    const res = fakeRes();
    const next = (err) => errorHandler(err, req, res, () => {});

    mockPrisma.user.findFirst.mockRejectedValue(new Error('relation "User" does not exist'));

    await authController.forgotPassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('relation');
    errorSpy.mockRestore();
  });
});