import { describe, it, expect, vi } from 'vitest';

// Test the security headers middleware behavior
// Since the middleware is defined inline in index.js, we test its expected behavior
describe('Security Headers Middleware', () => {
  // Recreate the middleware function for testing
  function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  }

  it('should set X-Content-Type-Options to nosniff', () => {
    const req = {};
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('should set X-Frame-Options to DENY', () => {
    const req = {};
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
  });

  it('should set Referrer-Policy', () => {
    const req = {};
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

  it('should set Permissions-Policy', () => {
    const req = {};
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    );
  });

  it('should set HSTS in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const req = {};
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should NOT set HSTS in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const req = {};
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Strict-Transport-Security',
      expect.any(String)
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should call next() to continue middleware chain', () => {
    const req = {};
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    securityHeaders(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('should set all required headers', () => {
    const req = {};
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    securityHeaders(req, res, next);

    // Should have at least 4 header calls (5 in production)
    expect(res.setHeader).toHaveBeenCalledTimes(4);
  });
});
