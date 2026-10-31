import { describe, it, expect, vi, beforeEach } from 'vitest';

// Verifies that the ONLY remaining path for resetting a user's password is the
// existing admin-only endpoint: PUT /api/auth/users/:id (authenticate + requireAdmin).
//
// Note: the service-level behaviour of updateUser (bcrypt hashing + tokenVersion
// increment) is covered by auth-service-security.test.js. This file focuses on
// route protection and dispatch.

const { mockAuthService, mockLogService, dbTokens, JWT_SECRET } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-key-for-admin-reset';
  return {
    // The controller imports authService and uses normalizeUsername/normalizeEmail.
    mockAuthService: {
      updateUser: vi.fn(),
    },
    mockLogService: {
      createLog: vi.fn().mockResolvedValue({}),
    },
    dbTokens: new Map(),
    JWT_SECRET: 'test-secret-key-for-admin-reset',
  };
});

vi.mock('../services/auth.service.js', () => ({
  authService: mockAuthService,
  normalizeUsername: (v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''),
  normalizeEmail: (v) => (typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : null),
}));

vi.mock('../services/log.service.js', () => ({ logService: mockLogService }));

vi.mock('../services/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(({ where: { id } }) => {
        const tokenVersion = dbTokens.get(id);
        return tokenVersion !== undefined ? Promise.resolve({ tokenVersion }) : Promise.resolve(null);
      }),
    },
  },
}));

import jwt from 'jsonwebtoken';
import express from 'express';
import request from 'supertest';
import authRoutes from '../routes/auth.routes.js';
import { errorHandler } from '../middleware/errorHandler.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
}

function tokenFor(id, role) {
  return jwt.sign({ id, username: id, role, tokenVersion: 0 }, JWT_SECRET);
}

describe('admin-initiated password reset (existing admin route)', () => {
  beforeEach(() => {
    dbTokens.clear();
    mockAuthService.updateUser.mockReset();
    mockAuthService.updateUser.mockResolvedValue({ id: 'u1', username: 'nadia', role: 'VIEWER' });
    mockLogService.createLog.mockClear();
  });

  it('allows an ADMIN to reset a user password via PUT /api/auth/users/:id', async () => {
    dbTokens.set('admin', 0);

    const res = await request(buildApp())
      .put('/api/auth/users/u1')
      .set('Authorization', `Bearer ${tokenFor('admin', 'ADMIN')}`)
      .send({ password: 'NewPass1!' });

    expect(res.status).toBe(200);
    expect(mockAuthService.updateUser).toHaveBeenCalledWith(
      'u1',
      { password: 'NewPass1!' },
      { requestingUserId: 'admin' },
    );
    expect(mockLogService.createLog).toHaveBeenCalled();
  });

  it('rejects anonymous requests (401)', async () => {
    const res = await request(buildApp())
      .put('/api/auth/users/u1')
      .send({ password: 'NewPass1!' });

    expect(res.status).toBe(401);
    expect(mockAuthService.updateUser).not.toHaveBeenCalled();
  });

  it('rejects non-admin roles (403)', async () => {
    dbTokens.set('viewer', 0);

    const res = await request(buildApp())
      .put('/api/auth/users/u1')
      .set('Authorization', `Bearer ${tokenFor('viewer', 'VIEWER')}`)
      .send({ password: 'NewPass1!' });

    expect(res.status).toBe(403);
    expect(mockAuthService.updateUser).not.toHaveBeenCalled();
  });

  it('rejects editors as well (403) — only ADMIN may reset passwords', async () => {
    dbTokens.set('editor', 0);

    const res = await request(buildApp())
      .put('/api/auth/users/u1')
      .set('Authorization', `Bearer ${tokenFor('editor', 'EDITOR')}`)
      .send({ password: 'NewPass1!' });

    expect(res.status).toBe(403);
    expect(mockAuthService.updateUser).not.toHaveBeenCalled();
  });
});
