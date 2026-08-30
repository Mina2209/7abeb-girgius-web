import { describe, it, expect, vi } from 'vitest';
import requestIdMiddleware from '../middleware/requestId.js';

// import makes a real randomUUID
import { randomUUID } from 'node:crypto';

describe('request ID middleware', () => {
  it('assigns req.id and sets X-Request-ID header', () => {
    const req = {};
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(req.id).toBeDefined();
    expect(typeof req.id).toBe('string');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.id);
    expect(next).toHaveBeenCalledOnce();
  });

  it('uses UUID format and is unique across requests', () => {
    const req1 = {};
    const req2 = {};
    const res1 = { setHeader: vi.fn() };
    const res2 = { setHeader: vi.fn() };

    requestIdMiddleware(req1, res1, vi.fn());
    requestIdMiddleware(req2, res2, vi.fn());

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(req1.id).toMatch(uuidRegex);
    expect(req2.id).toMatch(uuidRegex);
    expect(req1.id).not.toBe(req2.id);
  });

  it('produces valid UUIDs via node crypto', () => {
    expect(randomUUID()).toMatch(/^[0-9a-f]{8}-/);
  });
});