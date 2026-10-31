import { describe, it, expect, vi, beforeEach } from 'vitest';

// Route-level tests for DELETE /api/images/:id. The image service is mocked so
// these verify that authentication/role checks were not changed; S3 scoping is
// covered by image-delete-s3-scope.test.js.
const { mockImageService, dbTokens, JWT_SECRET } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'image-delete-route-test-secret';
  return {
    mockImageService: {
      getById: vi.fn(),
      delete: vi.fn(),
    },
    dbTokens: new Map(),
    JWT_SECRET: 'image-delete-route-test-secret',
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

const IMAGE = { id: 'image-1', title: 'Image', published: true };

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/images', imageRoutes);
  return app;
}

function tokenFor(id, role, tokenVersion = 0) {
  return jwt.sign({ id, username: id, role, tokenVersion }, JWT_SECRET);
}

function deleteImage(token) {
  let req = request(buildApp()).delete('/api/images/image-1');
  if (token !== undefined) {
    req = req.set('Authorization', `Bearer ${token}`);
  }
  return req;
}

describe('DELETE /api/images/:id – existing role policy', () => {
  beforeEach(() => {
    dbTokens.clear();
    mockImageService.getById.mockReset().mockResolvedValue(IMAGE);
    mockImageService.delete.mockReset().mockResolvedValue(IMAGE);
  });

  it('rejects an anonymous request', async () => {
    const res = await deleteImage();

    expect(res.status).toBe(401);
    expect(mockImageService.delete).not.toHaveBeenCalled();
  });

  it('rejects a VIEWER', async () => {
    dbTokens.set('viewer-1', 0);

    const res = await deleteImage(tokenFor('viewer-1', 'VIEWER'));

    expect(res.status).toBe(403);
    expect(mockImageService.delete).not.toHaveBeenCalled();
  });

  it('allows an EDITOR', async () => {
    dbTokens.set('editor-1', 0);

    const res = await deleteImage(tokenFor('editor-1', 'EDITOR'));

    expect(res.status).toBe(204);
    expect(mockImageService.delete).toHaveBeenCalledWith('image-1');
  });

  it('allows an ADMIN', async () => {
    dbTokens.set('admin-1', 0);

    const res = await deleteImage(tokenFor('admin-1', 'ADMIN'));

    expect(res.status).toBe(204);
    expect(mockImageService.delete).toHaveBeenCalledWith('image-1');
  });
});
