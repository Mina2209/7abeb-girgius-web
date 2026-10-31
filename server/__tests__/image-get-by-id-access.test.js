import { describe, it, expect, vi, beforeEach } from 'vitest';

// Route-level tests for GET /api/images/:id access control. The image service
// and the Prisma user lookup are mocked; the real auth middleware, route and
// controller are exercised through supertest.
const { mockImageService, dbTokens, JWT_SECRET } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'image-access-test-secret';
  return {
    mockImageService: {
      getById: vi.fn(),
    },
    dbTokens: new Map(),
    JWT_SECRET: 'image-access-test-secret',
  };
});

vi.mock('../services/image.service.js', () => ({
  ImageService: mockImageService,
}));

vi.mock('../services/log.service.js', () => ({
  logService: {
    createLog: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../services/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(({ where: { id } }) => {
        const tokenVersion = dbTokens.get(id);
        return tokenVersion !== undefined
          ? Promise.resolve({ tokenVersion })
          : Promise.resolve(null);
      }),
    },
  },
}));

import jwt from 'jsonwebtoken';
import express from 'express';
import request from 'supertest';
import imageRoutes from '../routes/image.routes.js';

const IMAGES = new Map([
  ['published-1', { id: 'published-1', title: 'Published', published: true }],
  ['draft-1', { id: 'draft-1', title: 'Draft', published: false }],
]);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/images', imageRoutes);
  return app;
}

function tokenFor(id, role, tokenVersion = 0) {
  return jwt.sign({ id, username: id, role, tokenVersion }, JWT_SECRET);
}

function getImage(id, token) {
  let req = request(buildApp()).get(`/api/images/${id}`);
  if (token !== undefined) {
    req = req.set('Authorization', `Bearer ${token}`);
  }
  return req;
}

describe('GET /api/images/:id – published/unpublished access', () => {
  beforeEach(() => {
    dbTokens.clear();
    mockImageService.getById.mockReset();
    mockImageService.getById.mockImplementation(async (id) => IMAGES.get(id) ?? null);
  });

  it('serves a published image to a visitor', async () => {
    const res = await getImage('published-1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'published-1', published: true });
  });

  it('returns 404 for an unpublished image to a visitor', async () => {
    const res = await getImage('draft-1');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expect(mockImageService.getById).toHaveBeenCalledWith('draft-1');
  });

  it('returns 404 for an unpublished image to an authenticated VIEWER', async () => {
    dbTokens.set('viewer-1', 0);

    const res = await getImage('draft-1', tokenFor('viewer-1', 'VIEWER'));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
  });

  it('allows an authenticated ADMIN to read an unpublished image', async () => {
    dbTokens.set('admin-1', 0);

    const res = await getImage('draft-1', tokenFor('admin-1', 'ADMIN'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'draft-1', published: false });
  });

  it('allows an authenticated EDITOR to read an unpublished image', async () => {
    dbTokens.set('editor-1', 0);

    const res = await getImage('draft-1', tokenFor('editor-1', 'EDITOR'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'draft-1', published: false });
  });

  it('returns 404 for a nonexistent image', async () => {
    const res = await getImage('missing-1');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
  });

  it('does not grant access to an unpublished image with an invalid JWT', async () => {
    const res = await getImage('draft-1', 'not.a.valid.jwt');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
  });

  it('does not grant access to an unpublished image with a revoked ADMIN JWT', async () => {
    dbTokens.set('admin-1', 1);

    const res = await getImage('draft-1', tokenFor('admin-1', 'ADMIN', 0));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
  });

  it('still serves a published image when the JWT is invalid', async () => {
    const res = await getImage('published-1', 'not.a.valid.jwt');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'published-1', published: true });
  });
});
