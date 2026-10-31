import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import jwt from 'jsonwebtoken';

// ── Hoisted: set env before the controller, auth middleware and helper import ──
const {
  s3Mock,
  prismaMock,
  ensurePreviewPdfMock,
  ensureSlideImagesMock,
  isPreviewableKeyMock,
  JWT_SECRET,
} = vi.hoisted(() => {
  process.env.JWT_SECRET = 'upload-image-access-test-secret';
  process.env.S3_KEY_PREFIX = '';
  process.env.AWS_S3_PREFIX = '';
  process.env.S3_FOLDER_MAP = JSON.stringify({
    hymn: 'Hymns',
    image: 'Images',
    powerpoint: 'PowerPoints',
  });
  process.env.S3_ALLOWED_FOLDERS = 'Hymns,Images,PowerPoints';
  process.env.S3_LEGACY_IMAGE_PREFIXES = '';

  return {
    s3Mock: {
      getObjectForProxy: vi.fn(),
      getPresignedGetUrl: vi.fn(),
      objectExists: vi.fn(),
      getObjectBuffer: vi.fn(),
      putObjectBuffer: vi.fn(),
    },
    prismaMock: {
      user: { findUnique: vi.fn() },
      image: { findMany: vi.fn() },
      file: { findMany: vi.fn() },
    },
    ensurePreviewPdfMock: vi.fn(),
    ensureSlideImagesMock: vi.fn(),
    isPreviewableKeyMock: vi.fn((key) => /\.(ppsx|pptx|ppt)$/i.test(key || '')),
    JWT_SECRET: 'upload-image-access-test-secret',
  };
});

vi.mock('../services/s3.service.js', () => ({
  default: s3Mock,
}));

vi.mock('../services/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../services/ppsx-converter.js', () => ({
  generatePreviewForKey: vi.fn(),
  ensurePreviewPdf: ensurePreviewPdfMock,
  isPreviewableKey: isPreviewableKeyMock,
}));

vi.mock('../services/slide-images.js', () => ({
  ensureSlideImages: ensureSlideImagesMock,
}));

// ── Imports (real, after mocks) ──────────────────────────────────────────────
import express from 'express';
import request from 'supertest';
import uploadRouter from '../routes/upload.routes.js';
import { resolveImageAccessTarget } from '../services/image-access.js';
import {
  ownedPreviewKeyForSource,
  ownedSlideImagePrefixForSource,
} from '../services/preview-cache-key.js';

const IMAGE_KEY = 'Images/photo.jpg';
const THUMB_KEY = `thumbnails/400/${IMAGE_KEY}`;
const STORED_IMAGE_URL = `https://api.example.test/api/uploads/url?key=${encodeURIComponent(IMAGE_KEY)}`;
const PREVIEW_SOURCE_KEY = 'Images/deck.pptx';
const PREVIEW_HASH = createHash('sha256').update(PREVIEW_SOURCE_KEY).digest('hex').slice(0, 32);
const PREVIEW_PDF_KEY = ownedPreviewKeyForSource(PREVIEW_SOURCE_KEY, { kind: 'image' });
const PREVIEW_SLIDE_KEY = `${ownedSlideImagePrefixForSource(PREVIEW_SOURCE_KEY, { kind: 'image' })}1.webp`;
const THUMB_PREVIEW_SLIDE_KEY = `thumbnails/400/${PREVIEW_SLIDE_KEY}`;
const DERIVED_PREVIEW_KEYS = [PREVIEW_PDF_KEY, PREVIEW_SLIDE_KEY, THUMB_PREVIEW_SLIDE_KEY];
const LEGACY_PREVIEW_PDF_KEY = `previews/v2/${PREVIEW_HASH}.pdf`;
const LEGACY_PREVIEW_SLIDE_KEY = `previews-img/${PREVIEW_HASH}/1.webp`;
const FILE_SOURCE_KEY = 'PowerPoints/sample.ppsx';
const FILE_HASH = createHash('sha256').update(FILE_SOURCE_KEY).digest('hex').slice(0, 32);
const FILE_PREVIEW_PDF_KEY = ownedPreviewKeyForSource(FILE_SOURCE_KEY, { kind: 'file' });
const FILE_PREVIEW_SLIDE_KEY = `${ownedSlideImagePrefixForSource(FILE_SOURCE_KEY, { kind: 'file' })}1.webp`;
const LEGACY_FILE_PREVIEW_PDF_KEY = `previews/v2/${FILE_HASH}.pdf`;
const LEGACY_FILE_PREVIEW_SLIDE_KEY = `previews-img/${FILE_HASH}/1.webp`;

const ENDPOINTS = [
  { name: 'url', path: '/api/uploads/url' },
  { name: 'thumb', path: '/api/uploads/thumb' },
  { name: 'preview', path: '/api/uploads/preview' },
  { name: 'proxy', path: '/api/uploads/proxy' },
  { name: 'office', path: '/api/uploads/office/photo.pptx' },
];

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/uploads', uploadRouter);
  return app;
}

function send(path, query, token) {
  let req = request(buildApp()).get(path);
  if (token) req = req.set('Authorization', `Bearer ${token}`);
  return req.query(query);
}

function tokenFor(id, role) {
  return jwt.sign({ id, username: 'user', role, tokenVersion: 0 }, JWT_SECRET);
}

function imageRow(overrides = {}) {
  return {
    id: 'image-1',
    imageUrl: STORED_IMAGE_URL,
    published: true,
    ...overrides,
  };
}

function streamable(value = 'image-bytes') {
  return Readable.from([Buffer.from(value)]);
}

function asUploadUrl(value) {
  if (!value) return value;
  return value.includes('/api/uploads/url?')
    ? value
    : `/api/uploads/url?key=${encodeURIComponent(value)}`;
}

function filePreviewRow(sourceKey, previewUrl, previewImageBaseUrl = null) {
  return {
    fileUrl: `/api/uploads/url?key=${encodeURIComponent(sourceKey)}`,
    previewUrl: asUploadUrl(previewUrl),
    previewImageBaseUrl: asUploadUrl(previewImageBaseUrl),
  };
}

function expectNoS3() {
  expect(s3Mock.getObjectForProxy).not.toHaveBeenCalled();
  expect(s3Mock.getPresignedGetUrl).not.toHaveBeenCalled();
  expect(s3Mock.objectExists).not.toHaveBeenCalled();
  expect(s3Mock.getObjectBuffer).not.toHaveBeenCalled();
  expect(s3Mock.putObjectBuffer).not.toHaveBeenCalled();
}

describe('public image access authorization', () => {
  let errorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({ tokenVersion: 0 });
    prismaMock.image.findMany.mockResolvedValue([]);
    prismaMock.file.findMany.mockResolvedValue([]);
    s3Mock.objectExists.mockResolvedValue(true);
    s3Mock.getObjectBuffer.mockResolvedValue(Buffer.from('original'));
    s3Mock.putObjectBuffer.mockResolvedValue({});
    s3Mock.getPresignedGetUrl.mockResolvedValue('https://s3.example.test/presigned');
    s3Mock.getObjectForProxy.mockImplementation(async () => ({
      contentType: 'image/jpeg',
      contentLength: 11,
      body: streamable(),
    }));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it.each(ENDPOINTS)('serves a published image through $name', async ({ name, path }) => {
    prismaMock.image.findMany.mockResolvedValue([imageRow()]);

    const res = await send(path, { key: IMAGE_KEY });

    expect(res.status).toBe(200);
    expect(prismaMock.image.findMany).toHaveBeenCalled();

    if (name === 'thumb') {
      expect(s3Mock.objectExists).toHaveBeenCalledWith(THUMB_KEY);
      expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(THUMB_KEY);
    } else if (name === 'preview') {
      expect(s3Mock.getPresignedGetUrl).toHaveBeenCalledWith(
        IMAGE_KEY,
        3600,
        null,
        { forceDownload: false },
      );
      expect(res.body.url).toBe('https://s3.example.test/presigned');
    } else if (name === 'office') {
      expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(IMAGE_KEY);
    } else {
      expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(IMAGE_KEY, null);
    }
  });

  it.each(ENDPOINTS)('denies an unpublished image through $name', async ({ path }) => {
    prismaMock.image.findMany.mockResolvedValue([imageRow({ published: false })]);

    const res = await send(path, { key: IMAGE_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expectNoS3();
  });

  it.each(ENDPOINTS)('denies a key with no matching image through $name', async ({ path }) => {
    prismaMock.image.findMany.mockResolvedValue([]);

    const res = await send(path, { key: IMAGE_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expectNoS3();
  });

  it.each(ENDPOINTS)('fails closed on a database error through $name', async ({ path }) => {
    prismaMock.image.findMany.mockRejectedValue(new Error('database unavailable'));

    const res = await send(path, { key: IMAGE_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expectNoS3();
    expect(errorSpy).toHaveBeenCalledWith(
      'Image access database lookup failed:',
      'database unavailable',
    );
  });

  it('checks visibility before probing the thumbnail cache', async () => {
    prismaMock.image.findMany.mockResolvedValue([imageRow({ published: false })]);
    s3Mock.objectExists.mockResolvedValue(true);

    const res = await send('/api/uploads/thumb', { key: IMAGE_KEY });

    expect(res.status).toBe(404);
    expect(s3Mock.objectExists).not.toHaveBeenCalled();
    expectNoS3();
  });

  it('authorizes a direct thumbnail-cache URL against its source image', async () => {
    prismaMock.image.findMany.mockResolvedValue([imageRow({ published: false })]);

    const res = await send('/api/uploads/url', { key: THUMB_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expectNoS3();
  });

  it('serves a published direct thumbnail-cache URL', async () => {
    prismaMock.image.findMany.mockResolvedValue([imageRow()]);

    const res = await send('/api/uploads/url', { key: THUMB_KEY });

    expect(res.status).toBe(200);
    expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(THUMB_KEY, null);
  });

  it('does not authorize a row whose stored URL points to a different key', async () => {
    prismaMock.image.findMany.mockResolvedValue([
      imageRow({
        imageUrl: `https://api.example.test/api/uploads/url?key=${encodeURIComponent('Images/other.jpg')}`,
      }),
    ]);

    const res = await send('/api/uploads/url', { key: IMAGE_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expectNoS3();
  });

  it('matches a relative stored upload URL', async () => {
    prismaMock.image.findMany.mockResolvedValue([
      imageRow({ imageUrl: `/api/uploads/url?key=${encodeURIComponent(IMAGE_KEY)}` }),
    ]);

    const res = await send('/api/uploads/url', { key: IMAGE_KEY });

    expect(res.status).toBe(200);
    expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(IMAGE_KEY, null);
  });

  it('rejects duplicate image references instead of guessing ownership', async () => {
    prismaMock.image.findMany.mockResolvedValue([
      imageRow(),
      imageRow({ id: 'image-2' }),
    ]);

    const res = await send('/api/uploads/url', { key: IMAGE_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expectNoS3();
  });

  it.each([
    'Images/backups/db.sql',
    'Images/previews/photo.pdf',
    'Images/previews-img/photo.webp',
    'Images/previews-file/photo.pdf',
    'Images/previews-image/photo.pdf',
    'Images/thumbnails/photo.jpg',
    'Images/Thumbnails/photo.jpg',
    'Images/../backups/db.sql',
    'thumbnails/400/thumbnails/400/thumbnails/400/thumbnails/400/thumbnails/400/Images/photo.jpg',
  ])('rejects reserved or malformed image keys: %s', async (key) => {
    const res = await send('/api/uploads/url', { key });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expect(prismaMock.image.findMany).not.toHaveBeenCalled();
    expectNoS3();
  });

  it('keeps non-image uploads working without a database image lookup', async () => {
    const res = await send('/api/uploads/url', { key: 'Hymns/song.mp3' });

    expect(res.status).toBe(200);
    expect(prismaMock.image.findMany).not.toHaveBeenCalled();
    expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith('Hymns/song.mp3', null);
  });
});

describe('authenticated draft image access', () => {
  let errorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({ tokenVersion: 0 });
    prismaMock.image.findMany.mockResolvedValue([imageRow({ published: false })]);
    prismaMock.file.findMany.mockResolvedValue([]);
    s3Mock.objectExists.mockResolvedValue(true);
    s3Mock.getObjectForProxy.mockImplementation(async () => ({
      contentType: 'image/jpeg',
      contentLength: 11,
      body: streamable(),
    }));
    s3Mock.getPresignedGetUrl.mockResolvedValue('https://s3.example.test/presigned');
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('allows an EDITOR to read a draft and marks the response private', async () => {
    const res = await send(
      '/api/uploads/url',
      { key: IMAGE_KEY },
      tokenFor('editor-1', 'EDITOR'),
    );

    expect(res.status).toBe(200);
    expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(IMAGE_KEY, null);
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('allows an EDITOR to read a draft thumbnail and marks the response private', async () => {
    const res = await send(
      '/api/uploads/thumb',
      { key: IMAGE_KEY },
      tokenFor('editor-1', 'EDITOR'),
    );

    expect(res.status).toBe(200);
    expect(s3Mock.objectExists).toHaveBeenCalledWith(THUMB_KEY);
    expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(THUMB_KEY);
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('allows an ADMIN to obtain a short-lived draft preview URL privately', async () => {
    const res = await send(
      '/api/uploads/preview',
      { key: IMAGE_KEY },
      tokenFor('admin-1', 'ADMIN'),
    );

    expect(res.status).toBe(200);
    expect(s3Mock.getPresignedGetUrl).toHaveBeenCalledWith(
      IMAGE_KEY,
      60,
      null,
      { forceDownload: false },
    );
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('does not let a VIEWER read a draft', async () => {
    const res = await send(
      '/api/uploads/url',
      { key: IMAGE_KEY },
      tokenFor('viewer-1', 'VIEWER'),
    );

    expect(res.status).toBe(404);
    expectNoS3();
  });

  it('ignores an invalid token and keeps the draft hidden', async () => {
    const res = await send('/api/uploads/url', { key: IMAGE_KEY }, 'not-a-valid-token');

    expect(res.status).toBe(404);
    expectNoS3();
  });
});

describe('image-key candidate resolution', () => {
  const baseEnv = {
    S3_KEY_PREFIX: '',
    AWS_S3_PREFIX: '',
    S3_FOLDER_MAP: JSON.stringify({ image: 'Images' }),
    S3_LEGACY_IMAGE_PREFIXES: '',
  };

  it('recognizes the literal image folder even when the base prefix differs', () => {
    const target = resolveImageAccessTarget('Images/photo.jpg', {
      ...baseEnv,
      S3_KEY_PREFIX: 'Uploads/',
    });
    expect(target).toEqual({ applies: true, sourceKey: 'Images/photo.jpg' });
  });

  it('recognizes the legacy Uploads/Images layout', () => {
    const target = resolveImageAccessTarget('Uploads/Images/photo.jpg', baseEnv);
    expect(target).toEqual({ applies: true, sourceKey: 'Uploads/Images/photo.jpg' });
  });

  it('unwraps nested thumbnail cache keys to the source image', () => {
    const target = resolveImageAccessTarget(
      'thumbnails/400/thumbnails/800/Images/photo.jpg',
      baseEnv,
    );
    expect(target).toEqual({ applies: true, sourceKey: 'Images/photo.jpg' });
  });

  it('does not classify presentation or arbitrary public keys as images', () => {
    expect(resolveImageAccessTarget('Hymns/song.mp3', baseEnv)).toEqual({
      applies: false,
      sourceKey: null,
    });
    expect(resolveImageAccessTarget('ImagesEvil/photo.jpg', baseEnv)).toEqual({
      applies: false,
      sourceKey: null,
    });
  });

  it('marks reserved image-looking keys as image checks that must deny', () => {
    expect(resolveImageAccessTarget('Images/backups/db.sql', baseEnv)).toEqual({
      applies: true,
      sourceKey: null,
    });
  });
});

describe('derived presentation-preview cache authorization', () => {
  let errorSpy;

  function previewRow(published) {
    return imageRow({
      imageUrl: `https://api.example.test/api/uploads/url?key=${encodeURIComponent(PREVIEW_SOURCE_KEY)}`,
      published,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({ tokenVersion: 0 });
    prismaMock.image.findMany.mockResolvedValue([]);
    prismaMock.file.findMany.mockResolvedValue([]);
    s3Mock.getObjectForProxy.mockImplementation(async () => ({
      contentType: 'image/jpeg',
      contentLength: 11,
      body: streamable(),
    }));
    s3Mock.getPresignedGetUrl.mockResolvedValue('https://s3.example.test/presigned');
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it.each(DERIVED_PREVIEW_KEYS)(
    'denies an unpublished image-derived preview cache: %s',
    async (key) => {
      prismaMock.image.findMany.mockResolvedValue([previewRow(false)]);

      const res = await send('/api/uploads/url', { key });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Image not found' });
      expectNoS3();
    },
  );

  it.each(DERIVED_PREVIEW_KEYS)(
    'serves a published image-derived preview cache: %s',
    async (key) => {
      prismaMock.image.findMany.mockResolvedValue([previewRow(true)]);

      const res = await send('/api/uploads/url', { key });

      expect(res.status).toBe(200);
      expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(key, null);
    },
  );

  it('allows an editor to open a draft image-derived preview privately', async () => {
    prismaMock.image.findMany.mockResolvedValue([previewRow(false)]);

    const res = await send(
      '/api/uploads/url',
      { key: PREVIEW_SLIDE_KEY },
      tokenFor('editor-1', 'EDITOR'),
    );

    expect(res.status).toBe(200);
    expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(PREVIEW_SLIDE_KEY, null);
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('rejects ambiguous preview ownership', async () => {
    prismaMock.image.findMany.mockResolvedValue([previewRow(true), previewRow(true)]);

    const res = await send('/api/uploads/url', { key: PREVIEW_PDF_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expectNoS3();
  });

  it('denies an image-derived preview when its source row is gone', async () => {
    prismaMock.image.findMany.mockResolvedValue([]);

    const res = await send('/api/uploads/url', { key: PREVIEW_PDF_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expectNoS3();
  });

  it('denies a new image preview whose stored URL is noncanonical', async () => {
    prismaMock.image.findMany.mockResolvedValue([
      imageRow({ imageUrl: PREVIEW_SOURCE_KEY, published: true }),
    ]);

    const res = await send('/api/uploads/url', { key: PREVIEW_PDF_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expectNoS3();
  });

  it('denies a new image preview whose encoded source does not match its hash', async () => {
    const source = Buffer.from(PREVIEW_SOURCE_KEY).toString('base64url');
    const key = `previews-image/v2/${source}/abcdef0123456789abcdef0123456789.pdf`;

    const res = await send('/api/uploads/url', { key });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expect(prismaMock.image.findMany).not.toHaveBeenCalled();
    expectNoS3();
  });

  it('serves a new presentation preview without any database lookup', async () => {
    const res = await send('/api/uploads/url', { key: FILE_PREVIEW_PDF_KEY });

    expect(res.status).toBe(200);
    expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(FILE_PREVIEW_PDF_KEY, null);
    expect(prismaMock.image.findMany).not.toHaveBeenCalled();
    expect(prismaMock.file.findMany).not.toHaveBeenCalled();
  });

  it('serves a new presentation slide-cache object without any database lookup', async () => {
    const res = await send('/api/uploads/url', { key: FILE_PREVIEW_SLIDE_KEY });

    expect(res.status).toBe(200);
    expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(FILE_PREVIEW_SLIDE_KEY, null);
    expect(prismaMock.image.findMany).not.toHaveBeenCalled();
    expect(prismaMock.file.findMany).not.toHaveBeenCalled();
  });

  it('denies a legacy image-derived preview when no File row proves presentation ownership', async () => {
    // The image row still exists and is published. The old hash-only cache must
    // still be denied because it cannot prove which kind of source produced it.
    prismaMock.image.findMany.mockResolvedValue([previewRow(true)]);

    const res = await send('/api/uploads/url', { key: LEGACY_PREVIEW_PDF_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expect(prismaMock.image.findMany).not.toHaveBeenCalled();
    expect(prismaMock.file.findMany).toHaveBeenCalled();
    expectNoS3();
  });

  it('serves a legacy presentation preview when a File row and source hash prove ownership', async () => {
    prismaMock.file.findMany.mockResolvedValue([
      filePreviewRow(FILE_SOURCE_KEY, LEGACY_FILE_PREVIEW_PDF_KEY),
    ]);

    const res = await send('/api/uploads/url', { key: LEGACY_FILE_PREVIEW_PDF_KEY });

    expect(res.status).toBe(200);
    expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(LEGACY_FILE_PREVIEW_PDF_KEY, null);
    expect(prismaMock.image.findMany).not.toHaveBeenCalled();
  });

  it('serves a legacy presentation slide cache when a File template proves ownership', async () => {
    prismaMock.file.findMany.mockResolvedValue([
      filePreviewRow(
        FILE_SOURCE_KEY,
        null,
        `/api/uploads/url?key=${encodeURIComponent(`previews-img/${FILE_HASH}/{n}.webp`)}`,
      ),
    ]);

    const res = await send('/api/uploads/url', { key: LEGACY_FILE_PREVIEW_SLIDE_KEY });

    expect(res.status).toBe(200);
    expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(LEGACY_FILE_PREVIEW_SLIDE_KEY, null);
  });

  it('does not let a legacy File row whose source is an image prove presentation ownership', async () => {
    prismaMock.file.findMany.mockResolvedValue([
      filePreviewRow(PREVIEW_SOURCE_KEY, LEGACY_PREVIEW_PDF_KEY),
    ]);

    const res = await send('/api/uploads/url', { key: LEGACY_PREVIEW_PDF_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expectNoS3();
  });

  it('does not let a legacy File row with a different source hash claim the cache', async () => {
    prismaMock.file.findMany.mockResolvedValue([
      filePreviewRow('PowerPoints/other.ppsx', LEGACY_FILE_PREVIEW_PDF_KEY),
    ]);

    const res = await send('/api/uploads/url', { key: LEGACY_FILE_PREVIEW_PDF_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expectNoS3();
  });

  it('denies unknown or malformed preview namespaces', async () => {
    const keys = [
      'previews/not-a-hash.pdf',
      'previews-file/v2/not-a-hash.pdf',
      'previews-image/v2/not*base64*/abcdef0123456789abcdef0123456789.pdf',
      'previews-image-img/v2/not*base64*/1.webp',
      'thumbnails/400/thumbnails/800/thumbnails/1600/thumbnails/2000/thumbnails/2400/previews/v2/abcdef0123456789abcdef0123456789.pdf',
    ];

    for (const key of keys) {
      const res = await send('/api/uploads/url', { key });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Image not found' });
    }
    expectNoS3();
  });

  it('fails closed when the image preview-ownership lookup fails', async () => {
    prismaMock.image.findMany.mockRejectedValue(new Error('database unavailable'));

    const res = await send('/api/uploads/url', { key: PREVIEW_PDF_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expectNoS3();
    expect(errorSpy).toHaveBeenCalledWith(
      'Image preview cache database lookup failed:',
      'database unavailable',
    );
  });

  it('fails closed when the legacy File ownership lookup fails', async () => {
    prismaMock.file.findMany.mockRejectedValue(new Error('file database unavailable'));

    const res = await send('/api/uploads/url', { key: LEGACY_FILE_PREVIEW_PDF_KEY });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expectNoS3();
    expect(errorSpy).toHaveBeenCalledWith(
      'Image preview cache database lookup failed:',
      'file database unavailable',
    );
  });
});

describe('image keys on public conversion endpoints', () => {
  let errorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.image.findMany.mockResolvedValue([
      imageRow({
        imageUrl: `https://api.example.test/api/uploads/url?key=${encodeURIComponent('Images/deck.pptx')}`,
        published: false,
      }),
    ]);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('denies a draft presentation-image key before preview conversion', async () => {
    const res = await send('/api/uploads/preview/pdf', { key: 'Images/deck.pptx' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expect(ensurePreviewPdfMock).not.toHaveBeenCalled();
    expect(s3Mock.getObjectForProxy).not.toHaveBeenCalled();
  });

  it('denies a draft presentation-image key before slide rendering', async () => {
    const res = await send('/api/uploads/preview/images', { key: 'Images/deck.pptx' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
    expect(ensurePreviewPdfMock).not.toHaveBeenCalled();
    expect(ensureSlideImagesMock).not.toHaveBeenCalled();
  });

  it('uses the image ownership namespace for a published PDF preview', async () => {
    const imageKey = 'Images/deck.pptx';
    prismaMock.image.findMany.mockResolvedValue([
      imageRow({
        imageUrl: `/api/uploads/url?key=${encodeURIComponent(imageKey)}`,
        published: true,
      }),
    ]);
    ensurePreviewPdfMock.mockResolvedValueOnce({
      previewKey: 'previews-image/v2/source/hash.pdf',
      created: true,
    });
    s3Mock.getObjectForProxy.mockResolvedValueOnce({
      contentType: 'application/pdf',
      contentLength: 8,
      body: streamable('%PDF-1.7'),
    });

    const res = await send('/api/uploads/preview/pdf', { key: imageKey });

    expect(res.status).toBe(200);
    expect(ensurePreviewPdfMock).toHaveBeenCalledWith(imageKey, { kind: 'image' });
    expect(s3Mock.getObjectForProxy).toHaveBeenCalledWith(
      'previews-image/v2/source/hash.pdf',
      null,
    );
  });

  it('uses the image ownership namespace for published slide rendering', async () => {
    const imageKey = 'Images/deck.pptx';
    const template = '/api/uploads/url?key=previews-image-img%2Fv2%2Fsource%2F{n}.webp';
    prismaMock.image.findMany.mockResolvedValue([
      imageRow({
        imageUrl: `/api/uploads/url?key=${encodeURIComponent(imageKey)}`,
        published: true,
      }),
    ]);
    ensurePreviewPdfMock.mockResolvedValueOnce({
      previewKey: 'previews-image/v2/source/hash.pdf',
      created: false,
    });
    ensureSlideImagesMock.mockResolvedValueOnce({ template, pages: 2 });

    const res = await send('/api/uploads/preview/images', { key: imageKey });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ template, pages: 2 });
    expect(ensurePreviewPdfMock).toHaveBeenCalledWith(imageKey, { kind: 'image' });
    expect(ensureSlideImagesMock).toHaveBeenCalledWith(imageKey, { kind: 'image' });
  });
});
