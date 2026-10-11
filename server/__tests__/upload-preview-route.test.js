import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import jwt from 'jsonwebtoken';

// ── Hoisted: set env BEFORE the controller and auth middleware are imported ──
const { previewGenerateMock, ensurePreviewPdfMock, isPreviewableKeyMock, getObjectForProxyMock, prismaUserMock } =
  vi.hoisted(() => {
    process.env.JWT_SECRET = 'preview-route-test-secret';
    process.env.S3_FOLDER_MAP = JSON.stringify({ powerpoint: 'PowerPoints', hymn: 'Hymns' });
    return {
      previewGenerateMock: vi.fn(),
      ensurePreviewPdfMock: vi.fn(),
      isPreviewableKeyMock: vi.fn((key) => /\.(ppsx|pptx|ppt)$/i.test(key || '')),
      getObjectForProxyMock: vi.fn(),
      prismaUserMock: {
        findUnique: vi.fn(async ({ where: { id } }) =>
          id === 'editor-1' || id === 'viewer-1' ? { tokenVersion: 0 } : null,
        ),
      },
    };
  });

// ── Mocks ───────────────────────────────────────────────────────────────
vi.mock('../services/ppsx-converter.js', () => ({
  generatePreviewForKey: previewGenerateMock,
  ensurePreviewPdf: ensurePreviewPdfMock,
  isPreviewableKey: isPreviewableKeyMock,
}));
vi.mock('../services/s3.service.js', () => ({
  default: { getObjectForProxy: getObjectForProxyMock },
}));
vi.mock('../services/prisma.js', () => ({ prisma: { user: prismaUserMock } }));

// ── Imports (real, after mocks) ─────────────────────────────────────────
import express from 'express';
import request from 'supertest';
import uploadRouter from '../routes/upload.routes.js';
import { guardBodyStream } from '../controllers/upload.controller.js';

// ── App factory ─────────────────────────────────────────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/uploads', uploadRouter);
  return app;
}

const EDITOR_KEY = 'PowerPoints/sample.ppsx';

function tokenFor({ id, role }) {
  return jwt.sign({ id, username: 'user', role, tokenVersion: 0 }, process.env.JWT_SECRET);
}

function post(key, token) {
  let req = request(buildApp()).post('/api/uploads/preview');
  if (token) req = req.set('Authorization', `Bearer ${token}`);
  return key !== undefined ? req.send({ key }) : req.send({});
}

describe('POST /api/uploads/preview – route integration (auth → validation → generation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no auth token is provided', async () => {
    const res = await post(EDITOR_KEY);
    expect(res.status).toBe(401);
    expect(previewGenerateMock).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller is not an editor/admin', async () => {
    const viewer = tokenFor({ id: 'viewer-1', role: 'VIEWER' });
    const res = await post(EDITOR_KEY, viewer);
    expect(res.status).toBe(403);
    expect(previewGenerateMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the key is missing', async () => {
    const editor = tokenFor({ id: 'editor-1', role: 'EDITOR' });
    const res = await post(undefined, editor);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('key required');
    expect(previewGenerateMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the generator rejects with UNSUPPORTED_TYPE', async () => {
    previewGenerateMock.mockRejectedValueOnce(Object.assign(new Error('unsupported'), { code: 'UNSUPPORTED_TYPE' }));
    const editor = tokenFor({ id: 'editor-1', role: 'EDITOR' });

    const res = await post('PowerPoints/sample.pdf', editor);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unsupported file type for preview');
    expect(previewGenerateMock).toHaveBeenCalledWith('PowerPoints/sample.pdf');
  });

  it('returns 200 with the preview object for a supported key', async () => {
    const result = {
      previewKey: 'previews/abcdef0123456789abcdef0123456789.pdf',
      previewUrl: '/api/uploads/url?key=previews%2Fabcdef0123456789abcdef0123456789.pdf',
      slideCount: 7,
    };
    previewGenerateMock.mockResolvedValueOnce(result);
    const editor = tokenFor({ id: 'editor-1', role: 'EDITOR' });

    const res = await post(EDITOR_KEY, editor);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(result);
    expect(previewGenerateMock).toHaveBeenCalledWith(EDITOR_KEY);
  });

  it('returns 502 when preview generation fails with a generic error', async () => {
    previewGenerateMock.mockRejectedValueOnce(new Error('soffice crashed'));
    const editor = tokenFor({ id: 'editor-1', role: 'EDITOR' });

    const res = await post(EDITOR_KEY, editor);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('preview generation failed');
    expect(previewGenerateMock).toHaveBeenCalledWith(EDITOR_KEY);
  });

  it('returns 503 when the generator reports the converter is unavailable', async () => {
    previewGenerateMock.mockRejectedValueOnce(
      Object.assign(new Error('no converter'), { code: 'CONVERTER_UNAVAILABLE' }),
    );
    const editor = tokenFor({ id: 'editor-1', role: 'EDITOR' });

    const res = await post(EDITOR_KEY, editor);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('preview converter unavailable');
  });

  // The per-slide WebP template rides along on this same response. If the
  // controller ever strips it again, a freshly uploaded deck would silently keep
  // rendering as the PDF — the client cannot ask for it anywhere else.
  it('passes a per-slide image template through to the client when one exists', async () => {
    const template = '/api/uploads/url?key=previews-img%2Fabcdef0123456789abcdef0123456789%2F{n}.webp';
    previewGenerateMock.mockResolvedValueOnce({
      previewKey: 'previews/abcdef0123456789abcdef0123456789.pdf',
      previewUrl: '/api/uploads/url?key=previews%2Fabcdef0123456789abcdef0123456789.pdf',
      slideCount: 7,
      previewImageBaseUrl: template,
    });
    const editor = tokenFor({ id: 'editor-1', role: 'EDITOR' });

    const res = await post(EDITOR_KEY, editor);

    expect(res.status).toBe(200);
    expect(res.body.previewImageBaseUrl).toBe(template);
    expect(res.body.previewImageBaseUrl).toContain('{n}');
  });
});

// Every slide image is fetched by an anonymous visitor through the plain object
// URL endpoint, so its prefix has to be publicly readable. It is a sibling of
// 'previews/', not a child: prefix matching is segment-based, so 'previews/' alone
// would have 403'd every WebP and the viewer would have fallen back to the PDF for
// every single slide.
describe('GET /api/uploads/url – per-slide image readability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function streamable(body) {
    return Readable.from([Buffer.from(body)]);
  }

  it('serves a previews-img object to an unauthenticated visitor', async () => {
    getObjectForProxyMock.mockResolvedValue({
      contentLength: 4,
      body: streamable('WEBP'),
    });

    const res = await request(buildApp())
      .get('/api/uploads/url')
      .query({ key: 'previews-img/abcdef0123456789abcdef0123456789/1.webp' });

    expect(res.status).toBe(200);
    expect(getObjectForProxyMock.mock.calls[0][0]).toBe(
      'previews-img/abcdef0123456789abcdef0123456789/1.webp',
    );
  });

  it('still refuses keys outside the readable prefixes', async () => {
    const res = await request(buildApp()).get('/api/uploads/url').query({ key: 'Private/secret.pdf' });

    expect(res.status).toBe(403);
    expect(getObjectForProxyMock).not.toHaveBeenCalled();
  });
});

// The on-demand endpoint is what makes previews work for presentations that were
// uploaded before any preview metadata existed, so it must be reachable by plain
// visitors — not just editors.
describe('GET /api/uploads/preview/pdf – public on-demand preview', () => {
  const PREVIEW_KEY = 'previews/abcdef0123456789abcdef0123456789.pdf';

  function streamable(body) {
    return Readable.from([Buffer.from(body)]);
  }

  // supertest leaves res.text/res.body undefined for application/pdf, so collect
  // the raw bytes explicitly.
  function binaryParser(res, callback) {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  }

  function getPreviewPdf(key, headers = {}) {
    let req = request(buildApp()).get('/api/uploads/preview/pdf').parse(binaryParser);
    for (const [name, value] of Object.entries(headers)) req = req.set(name, value);
    return key === undefined ? req : req.query({ key });
  }

  // For the error paths the response is JSON, so don't run it through binaryParser.
  function getPreviewPdfJson(key) {
    const req = request(buildApp()).get('/api/uploads/preview/pdf');
    return key === undefined ? req : req.query({ key });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    isPreviewableKeyMock.mockImplementation((key) => /\.(ppsx|pptx|ppt)$/i.test(key || ''));
  });

  it('converts on first request and streams the PDF without authentication', async () => {
    ensurePreviewPdfMock.mockResolvedValueOnce({ previewKey: PREVIEW_KEY, created: true, slideCount: 3 });
    getObjectForProxyMock.mockResolvedValueOnce({
      contentType: 'application/pdf',
      contentLength: 8,
      contentRange: null,
      etag: '"abc123"',
      lastModified: new Date('2026-10-01T00:00:00Z'),
      body: streamable('%PDF-1.7'),
    });

    const res = await getPreviewPdf(EDITOR_KEY);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['accept-ranges']).toBe('bytes');
    // Mutable object: must revalidate instead of advertising `immutable`.
    expect(res.headers['cache-control']).toBe('public, max-age=0, must-revalidate');
    expect(res.headers['etag']).toBe('"abc123"');
    expect(res.headers['last-modified']).toBe('Thu, 01 Oct 2026 00:00:00 GMT');
    expect(res.body.toString()).toBe('%PDF-1.7');
    expect(ensurePreviewPdfMock).toHaveBeenCalledWith(EDITOR_KEY);
  });

  it('answers 304 (and streams no bytes) when the client already has the ETag', async () => {
    ensurePreviewPdfMock.mockResolvedValueOnce({ previewKey: PREVIEW_KEY, created: false, slideCount: 3 });
    getObjectForProxyMock.mockResolvedValueOnce({
      contentType: 'application/pdf',
      contentLength: 8,
      contentRange: null,
      etag: '"abc123"',
      lastModified: new Date('2026-10-01T00:00:00Z'),
      body: streamable('%PDF-1.7'),
    });

    const res = await getPreviewPdf(EDITOR_KEY, { 'If-None-Match': 'W/"abc123"' });

    expect(res.status).toBe(304);
    expect(res.headers['etag']).toBe('"abc123"');
    expect(res.body.length).toBe(0);
  });

  // A proxy or a hand-written client may drop the surrounding quotes (or the
  // weak prefix). Either way the entity-tag is the same, so the answer is 304,
  // not a full re-download of the PDF.
  it('answers 304 for quoted, unquoted, and "*" ETag matches alike', async () => {
    for (const value of ['"abc123"', 'abc123', '*']) {
      ensurePreviewPdfMock.mockResolvedValueOnce({ previewKey: PREVIEW_KEY, created: false, slideCount: 3 });
      getObjectForProxyMock.mockResolvedValueOnce({
        contentType: 'application/pdf',
        contentLength: 8,
        contentRange: null,
        etag: '"abc123"',
        lastModified: new Date('2026-10-01T00:00:00Z'),
        body: streamable('%PDF-1.7'),
      });

      const res = await getPreviewPdf(EDITOR_KEY, { 'If-None-Match': value });

      expect(res.status).toBe(304);
      expect(res.body.length).toBe(0);
    }
  });

  it('forwards a Range header as a 206 partial response', async () => {
    ensurePreviewPdfMock.mockResolvedValueOnce({ previewKey: PREVIEW_KEY, created: false, slideCount: 3 });
    getObjectForProxyMock.mockResolvedValueOnce({
      contentType: 'application/pdf',
      contentLength: 4,
      contentRange: 'bytes 0-3/8',
      body: streamable('%PDF'),
    });

    const res = await getPreviewPdf(EDITOR_KEY, { Range: 'bytes=0-3' });

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-3/8');
    expect(getObjectForProxyMock).toHaveBeenCalledWith(PREVIEW_KEY, 'bytes=0-3');
  });

  it('returns 400 when the key is missing', async () => {
    const res = await getPreviewPdfJson();
    expect(res.status).toBe(400);
    expect(ensurePreviewPdfMock).not.toHaveBeenCalled();
  });

  it('returns 403 for a key outside the public read prefixes', async () => {
    const res = await getPreviewPdfJson('backups/secret.ppsx');
    expect(res.status).toBe(403);
    expect(ensurePreviewPdfMock).not.toHaveBeenCalled();
  });

  it('returns 415 without converting when the key is not a presentation', async () => {
    const res = await getPreviewPdfJson('Hymns/song.mp3');
    expect(res.status).toBe(415);
    expect(ensurePreviewPdfMock).not.toHaveBeenCalled();
  });

  it('returns 502 when the conversion fails', async () => {
    ensurePreviewPdfMock.mockRejectedValueOnce(new Error('soffice crashed'));

    const res = await getPreviewPdfJson(EDITOR_KEY);

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('preview generation failed');
    expect(getObjectForProxyMock).not.toHaveBeenCalled();
  });

  it('returns 503 (not 502) when the server has no converter installed', async () => {
    ensurePreviewPdfMock.mockRejectedValueOnce(
      Object.assign(new Error('preview converter unavailable'), { code: 'CONVERTER_UNAVAILABLE' }),
    );

    const res = await getPreviewPdfJson(EDITOR_KEY);

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('preview converter unavailable');
    expect(getObjectForProxyMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the cached preview cannot be streamed', async () => {
    ensurePreviewPdfMock.mockResolvedValueOnce({ previewKey: PREVIEW_KEY, created: false, slideCount: 3 });
    getObjectForProxyMock.mockRejectedValueOnce(new Error('NoSuchKey'));

    const res = await getPreviewPdfJson(EDITOR_KEY);

    expect(res.status).toBe(404);
  });

  // Regression for the production ERR_HTTP_HEADERS_SENT ("Cannot set headers after
  // they are sent"): a cached preview whose S3 body fails *after* body.pipe() has
  // flushed the headers must never be answered a second time.
  describe('guardBodyStream (stream double-response guard)', () => {
    function fakeRes(headersSent) {
      return {
        headersSent,
        once: vi.fn(),
        status: vi.fn(function () { return this; }),
        json: vi.fn(function () { return this; }),
        destroy: vi.fn(),
      };
    }
    function fakeBody() {
      const body = new EventEmitter();
      body.pipe = vi.fn();
      body.destroy = vi.fn();
      return body;
    }

    it('answers 502 exactly once when the source errors before headers are sent', () => {
      const res = fakeRes(false);
      const body = fakeBody();
      guardBodyStream(res, body, () => {});

      body.emit('error', new Error('The specified key does not exist.'));

      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({ error: 'preview stream failed' });
      expect(res.destroy).not.toHaveBeenCalled();
    });

    it('destroys the connection (never a second response) once headers are sent', () => {
      const res = fakeRes(true);
      const body = fakeBody();
      guardBodyStream(res, body, () => {});

      body.emit('error', new Error('The specified key does not exist.'));

      expect(res.destroy).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
