import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted: available inside vi.mock factories ─────────────────────────
const { mockS3 } = vi.hoisted(() => ({
  mockS3: {
    getObjectForProxy: vi.fn(),
  },
}));

vi.mock('../services/s3.service.js', () => ({
  default: mockS3,
}));

// ── Import AFTER mocks ──────────────────────────────────────────────────
import { UploadController } from '../controllers/upload.controller.js';

// Only the thumbnails/ prefix is readable when S3_FOLDER_MAP isn't configured,
// which is the case under the test environment.
const READABLE_KEY = 'thumbnails/song.mp3';

function makeRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    setHeader: vi.fn((k, v) => {
      headers[k] = v;
      return res;
    }),
    status: vi.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    end: vi.fn(),
    send: vi.fn(),
    json: vi.fn(),
  };
  return Object.assign(res, { headers });
}

function makeReq(query = {}, range) {
  const req = { query, headers: {} };
  if (range) req.headers.range = range;
  return req;
}

describe('Range request support for media streaming (audio/video seeking)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards a byte range to S3 and serves a 206 Partial Content', async () => {
    mockS3.getObjectForProxy.mockResolvedValue({
      contentType: 'audio/mpeg',
      contentLength: 512,
      contentRange: 'bytes 1024-1535/4096',
      body: { pipe: vi.fn() },
    });

    const res = makeRes();
    const req = makeReq({ key: READABLE_KEY, name: 'song.mp3' }, 'bytes=1024-1535');

    await UploadController.url(req, res);

    expect(mockS3.getObjectForProxy).toHaveBeenCalledWith(
      READABLE_KEY,
      'bytes=1024-1535',
    );
    expect(res.statusCode).toBe(206);
    expect(res.headers['Accept-Ranges']).toBe('bytes');
    expect(res.headers['Content-Range']).toBe('bytes 1024-1535/4096');
    expect(res.headers['Content-Length']).toBe(512);
  });

  it('serves a full 200 response when no Range header is present', async () => {
    mockS3.getObjectForProxy.mockResolvedValue({
      contentType: 'audio/mpeg',
      contentLength: 4096,
      contentRange: null,
      body: { pipe: vi.fn() },
    });

    const res = makeRes();
    const req = makeReq({ key: READABLE_KEY });

    await UploadController.url(req, res);

    expect(mockS3.getObjectForProxy).toHaveBeenCalledWith(READABLE_KEY, null);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Range']).toBeUndefined();
    expect(res.headers['Accept-Ranges']).toBe('bytes');
  });

  it('ignores malformed or multi-range headers and returns the full object', async () => {
    mockS3.getObjectForProxy.mockResolvedValue({
      contentType: 'audio/mpeg',
      contentLength: 4096,
      contentRange: null,
      body: { pipe: vi.fn() },
    });

    const res = makeRes();
    await UploadController.url(
      makeReq({ key: READABLE_KEY }, 'bytes=0-1024,2048-3072'),
      res,
    );
    expect(mockS3.getObjectForProxy).toHaveBeenCalledWith(READABLE_KEY, null);

    vi.clearAllMocks();
    mockS3.getObjectForProxy.mockResolvedValue({
      contentType: 'audio/mpeg',
      contentLength: 4096,
      contentRange: null,
      body: { pipe: vi.fn() },
    });
    await UploadController.url(
      makeReq({ key: READABLE_KEY }, 'items=1-2'),
      res,
    );
    expect(mockS3.getObjectForProxy).toHaveBeenCalledWith(READABLE_KEY, null);
  });

  it('passes open-ended and suffix ranges through to S3', async () => {
    mockS3.getObjectForProxy.mockResolvedValue({
      contentType: 'audio/mpeg',
      contentLength: 2072,
      contentRange: 'bytes 1024-4095/4096',
      body: { pipe: vi.fn() },
    });

    const res = makeRes();
    await UploadController.url(
      makeReq({ key: READABLE_KEY }, 'bytes=1024-'),
      res,
    );
    expect(mockS3.getObjectForProxy).toHaveBeenCalledWith(READABLE_KEY, 'bytes=1024-');

    vi.clearAllMocks();
    mockS3.getObjectForProxy.mockResolvedValue({
      contentType: 'audio/mpeg',
      contentLength: 1000,
      contentRange: 'bytes 3096-4095/4096',
      body: { pipe: vi.fn() },
    });
    await UploadController.url(
      makeReq({ key: READABLE_KEY }, 'bytes=-1000'),
      res,
    );
    expect(mockS3.getObjectForProxy).toHaveBeenCalledWith(READABLE_KEY, 'bytes=-1000');
  });

  it('still enforces readable-key authorization for range requests', async () => {
    const res = makeRes();
    const req = makeReq({ key: 'Private/secret.mp3' }, 'bytes=0-99');

    await UploadController.url(req, res);

    expect(mockS3.getObjectForProxy).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});