import { describe, it, expect, vi } from 'vitest';
import { validate } from '../middleware/validate.js';

function makeRes() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('validate middleware — max-length enforcement', () => {
  it('rejects a string longer than the declared max', () => {
    const mw = validate({ title: 'string:5' });
    const res = makeRes();
    const next = vi.fn();

    mw({ body: { title: '123456' } }, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('must not exceed 5 characters');
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a string within the declared max and trims it', () => {
    const mw = validate({ title: 'string:5' });
    const res = makeRes();
    const next = vi.fn();

    mw({ body: { title: '  123  ' } }, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeUndefined();
  });

  it('rejects an empty string', () => {
    const mw = validate({ title: 'string:5' });
    const res = makeRes();
    const next = vi.fn();

    mw({ body: { title: '   ' } }, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('must not be empty');
  });

  it('trims and passes the sanitized body to the handler', () => {
    const mw = validate({ title: 'string:5' });
    const req = { body: { title: '  abc  ' } };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(req.body).toEqual({ title: 'abc' });
  });

  it('rejects an array exceeding the item-count limit', () => {
    const mw = validate({ tags: 'array:2' });
    const res = makeRes();

    mw({ body: { tags: [1, 2, 3] } }, res, vi.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('must not exceed 2 items');
  });

  it('rejects a string array with a non-string or empty item', () => {
    const mw1 = validate({ tags: 'string[]:100' });
    const res1 = makeRes();
    mw1({ body: { tags: ['ok', 42] } }, res1, vi.fn());
    expect(res1.statusCode).toBe(400);
    expect(res1.body.error).toContain('item 1');

    const mw2 = validate({ tags: 'string[]:100' });
    const res2 = makeRes();
    mw2({ body: { tags: ['ok', '   '] } }, res2, vi.fn());
    expect(res2.statusCode).toBe(400);
    expect(res2.body.error).toContain('item 1');
  });

  it('trims each validated array item', () => {
    const mw = validate({ tags: 'string[]:100' });
    const req = { body: { tags: ['  one  ', ' two '] } };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(req.body.tags).toEqual(['one', 'two']);
  });

  it('rejects a string array item longer than the per-element max', () => {
    const mw = validate({ tags: 'string[]:100:3' });
    const res = makeRes();

    mw({ body: { tags: ['ab', 'abcde'] } }, res, vi.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('item 1');
    expect(res.body.error).toContain('exceed 3 characters');
  });
});

describe('validate middleware — required fields & stripping', () => {
  it('reports missing required fields as "is required"', () => {
    const mw = validate({ title: 'string', content: 'string?' });
    const res = makeRes();

    mw({ body: {} }, res, vi.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('title is required');
  });

  it('strips unknown fields not declared in the schema', () => {
    const mw = validate({ title: 'string' });
    const req = { body: { title: 'T', admin: true, injected: 'x' } };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ title: 'T' });
  });

  it('accepts optional fields that are absent', () => {
    const mw = validate({ author: 'string', tags: 'array?:5' });
    const req = { body: { author: 'me' } };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ author: 'me' });
  });
});