# Security Strategy

## Executive Summary

This document outlines the security strategy for the church application (hymnal/content management system). The application is a production-oriented React/Vite + Node/Express + Prisma/PostgreSQL stack with JWT authentication, role-based access control (ADMIN/EDITOR/VIEWER), S3 file storage, and analytics.

## Security Posture Assessment

**Overall Rating: SAFE WITH CONDITIONS**

The application demonstrates strong security fundamentals in critical areas:
- Proper password hashing (bcrypt cost 10)
- JWT token revocation via tokenVersion
- Role-based access control with middleware enforcement
- Parameterized database queries (no SQL injection)
- Input validation framework with unknown field stripping
- Rate limiting on sensitive endpoints
- Non-root Docker containers

However, several critical and high-severity findings require immediate remediation before production deployment:

### Critical Findings (Must Fix Before Launch)
1. **Weak JWT Secret** - Current secret is guessable pattern
2. **S3 Object Deletion Without Validation** - Editors can delete any S3 object
3. **Missing Security Headers** - No CSP, HSTS, X-Frame-Options
4. **Weak Seed Credentials** - Default admin password is trivial

### High Findings (Must Fix Before Launch)
1. **Multipart Upload Bypass** - S3 folder restrictions can be circumvented
2. **No Account Lockout** - Only IP-based rate limiting on login
3. **Role Changes Don't Invalidate Tokens** - Stale JWTs retain old roles
4. **Async Middleware Bug** - Potential auth bypass under load

## Security Principles

1. **Defense in Depth** - Multiple layers of security controls
2. **Least Privilege** - Users get minimum required permissions
3. **Fail Closed** - System denies access by default
4. **No Security Through Obscurity** - Controls must work even if attackers know the implementation
5. **Secure by Default** - Secure configurations are the default

## Risk Acceptance Criteria

### Accepted Risks
- JWT stored in localStorage (XSS attack surface, mitigated by strong CSP)
- 7-day token expiry (balance between security and UX)
- No refresh token mechanism (simplicity over security)
- Public content endpoints without authentication (by design)
- Global content model (no per-user ownership for hymns/images)

### Deferred Risks
- Redis-based rate limiting (current in-memory sufficient for single-instance)
- OAuth/SSO integration (not required for initial launch)
- Web Application Firewall (WAF) - infrastructure layer
- Penetration testing (recommended post-launch)

## Compliance Requirements

- No PII collection beyond user profiles (username, email, optional profile fields)
- Analytics are anonymous (no search query storage)
- Backup data encrypted at rest (S3 server-side encryption)
- Audit logging for admin actions
