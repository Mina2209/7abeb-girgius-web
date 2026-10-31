import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  createRequestTimeout,
  timeoutBudgetForPath,
  DEFAULT_REQUEST_TIMEOUT_MS,
  PREVIEW_IMAGES_TIMEOUT_MS,
  PREVIEW_IMAGES_PATH,
} from '../middleware/requestTimeout.js';

function fakeRes(overrides = {}) {
  return {
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    on: vi.fn(),
    ...overrides,
  };
}

function fakeReq(path, overrides = {}) {
  return { path, destroyed: false, destroy: vi.fn(), ...overrides };
}

describe('request timeout policy (per path)', () => {
  it('uses the short default budget for ordinary API paths', () => {
    expect(timeoutBudgetForPath('/api/hymns')).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
    expect(timeoutBudgetForPath('/api/uploads/url')).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBe(30 * 1000);
  });

  it('gives the image preview the longer, frontend-aligned budget', () => {
    expect(timeoutBudgetForPath(PREVIEW_IMAGES_PATH)).toBe(PREVIEW_IMAGES_TIMEOUT_MS);
    // A differently-mounted variant still matches on the suffix.
    expect(timeoutBudgetForPath('/api/uploads/preview/images')).toBe(PREVIEW_IMAGES_TIMEOUT_MS);
    expect(timeoutBudgetForPath('/preview/images')).toBe(PREVIEW_IMAGES_TIMEOUT_MS);
  });

  it('aligns the preview budget with the frontend 180s wait, above the default', () => {
    // PptxViewer PREVIEW_FETCH_TIMEOUT_MS === 180_000.
    expect(PREVIEW_IMAGES_TIMEOUT_MS).toBe(180 * 1000);
    expect(PREVIEW_IMAGES_TIMEOUT_MS).toBeGreaterThan(DEFAULT_REQUEST_TIMEOUT_MS);
  });

  it('leaves the streaming zip endpoints unbounded (unchanged behaviour)', () => {
    expect(timeoutBudgetForPath('/zip')).toBe(0);
    expect(timeoutBudgetForPath('/api/hymns/zip')).toBe(0);
  });

  it('does not accidentally give the PDF preview endpoint the short default twice', () => {
    // /preview/pdf keeps the default (its budget is a separate concern).
    expect(timeoutBudgetForPath('/api/uploads/preview/pdf')).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
  });
});

describe('request timeout middleware (timer behaviour)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('attaches no timer for streaming paths', () => {
    const mw = createRequestTimeout({ defaultMs: 1000, previewImagesMs: 5000 });
    const req = fakeReq('/zip');
    const res = fakeRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.on).not.toHaveBeenCalled();
  });

  it('answers 504 and destroys the request when a normal handler overruns', () => {
    const mw = createRequestTimeout({ defaultMs: 1000, previewImagesMs: 5000 });
    const req = fakeReq('/api/hymns');
    const res = fakeRes();

    mw(req, res, vi.fn());

    vi.advanceTimersByTime(999);
    expect(res.status).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith({ error: 'Gateway timeout' });
    expect(req.destroy).toHaveBeenCalledOnce();
  });

  it('gives the image preview its own longer budget before firing', () => {
    const mw = createRequestTimeout({ defaultMs: 1000, previewImagesMs: 5000 });
    const req = fakeReq(PREVIEW_IMAGES_PATH);
    const res = fakeRes();

    mw(req, res, vi.fn());

    vi.advanceTimersByTime(1000); // past the default…
    expect(res.status).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000); // …but not the preview budget
    expect(res.status).toHaveBeenCalledWith(504);
  });

  it('clears the timer when the handler finishes, so no 504 is sent', () => {
    const mw = createRequestTimeout({ defaultMs: 1000, previewImagesMs: 5000 });
    const req = fakeReq('/api/hymns');
    let onFinish;
    const res = fakeRes({
      on: vi.fn((event, cb) => {
        if (event === 'finish') onFinish = cb;
      }),
    });

    mw(req, res, vi.fn());
    onFinish();
    vi.advanceTimersByTime(10_000);

    expect(res.status).not.toHaveBeenCalled();
    expect(req.destroy).not.toHaveBeenCalled();
  });

  it('does not send a second response after the response has already ended', () => {
    const mw = createRequestTimeout({ defaultMs: 1000, previewImagesMs: 5000 });
    const req = fakeReq('/api/hymns');
    const res = fakeRes({ writableEnded: true });

    mw(req, res, vi.fn());
    vi.advanceTimersByTime(1000);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(req.destroy).not.toHaveBeenCalled();
  });

  it('never writes to a destroyed request or response', () => {
    const mw = createRequestTimeout({ defaultMs: 1000, previewImagesMs: 5000 });
    const req = fakeReq('/api/hymns', { destroyed: true });
    const res = fakeRes({ destroyed: true });

    mw(req, res, vi.fn());
    vi.advanceTimersByTime(1000);

    expect(res.status).not.toHaveBeenCalled();
    expect(req.destroy).not.toHaveBeenCalled();
  });

  it('tears down, but does not re-answer, a handler that already started streaming', () => {
    const mw = createRequestTimeout({ defaultMs: 1000, previewImagesMs: 5000 });
    const req = fakeReq('/api/hymns');
    const res = fakeRes({ headersSent: true });

    mw(req, res, vi.fn());
    vi.advanceTimersByTime(1000);

    expect(res.status).not.toHaveBeenCalled();
    expect(req.destroy).toHaveBeenCalledOnce();
  });
});

describe('request timeout middleware (integration)', () => {
  function appWith(mw, handler) {
    const app = express();
    app.use(mw);
    app.get('/api/hymns', handler);
    app.get(PREVIEW_IMAGES_PATH, handler);
    return app;
  }

  it('passes a fast handler through untouched', async () => {
    const mw = createRequestTimeout({ defaultMs: 1000, previewImagesMs: 1000 });
    const app = appWith(mw, (_req, res) => res.json({ ok: true }));

    const res = await request(app).get(PREVIEW_IMAGES_PATH);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('lets the preview endpoint run past the default budget without a 504', async () => {
    // Default budget 30ms: a handler that takes ~120ms would normally 504, but
    // the preview route carries the longer budget (200ms here).
    const mw = createRequestTimeout({ defaultMs: 30, previewImagesMs: 200 });
    const slow = (_req, res) => setTimeout(() => res.json({ ok: true }), 120);
    const app = appWith(mw, slow);

    const res = await request(app).get(PREVIEW_IMAGES_PATH);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
