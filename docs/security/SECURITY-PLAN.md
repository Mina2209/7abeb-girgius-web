# Security Remediation Plan

## Phase 1: Critical Fixes (Immediate - Before Any Deployment)

### 1.1 Rotate JWT Secret
**Severity:** CRITICAL
**File:** `server/.env`, `server/index.js`
**Action:**
- Generate a cryptographically random 64+ character secret
- Update `JWT_SECRET` in production environment
- Add minimum length validation in `index.js` startup check (≥32 chars)

### 1.2 Fix S3 Object Deletion
**Severity:** CRITICAL
**File:** `server/controllers/upload.controller.js:148-153`
**Action:**
- Add prefix validation to `remove` endpoint using `isReadableKey()` or a write-allowlist
- Prevent editors from deleting objects outside application folders

### 1.3 Add Security Headers
**Severity:** CRITICAL
**File:** `client/vercel.json`
**Action:**
- Add `Content-Security-Policy` with appropriate directives
- Add `X-Content-Type-Options: nosniff`
- Add `X-Frame-Options: DENY`
- Add `Strict-Transport-Security` with appropriate max-age
- Add `Referrer-Policy: strict-origin-when-cross-origin`
- Add `Permissions-Policy` to disable unnecessary browser features

### 1.4 Rotate Seed Credentials
**Severity:** CRITICAL
**File:** `server/prisma/seed.js`
**Action:**
- Update seed script to generate strong random passwords
- Remove hardcoded password from console.log
- Document that seed should only be run in development

## Phase 2: High-Priority Fixes (Before Public Launch)

### 2.1 Fix Multipart Upload Validation
**Severity:** HIGH
**File:** `server/controllers/upload.controller.js:167-179`
**Action:**
- Store initiated upload IDs in memory or database
- Validate `presignPart` and `completeMultipart` requests against initiated uploads
- Reject requests for keys not matching allowed folders

### 2.2 Add Account Lockout
**Severity:** HIGH
**File:** `server/controllers/auth.controller.js`, `server/services/auth.service.js`
**Action:**
- Implement account-level lockout after 5 failed attempts (15-minute window)
- Store failed attempt count and lockout timestamp in database
- Return consistent error messages to prevent enumeration

### 2.3 Invalidate Tokens on Role Change
**Severity:** HIGH
**File:** `server/services/auth.service.js`, `server/controllers/auth.controller.js`
**Action:**
- Increment `tokenVersion` when admin changes user role
- Add `roleChangedAt` field to User model if needed
- Update auth middleware to check role validity

### 2.4 Fix Async Middleware
**Severity:** HIGH
**File:** `server/middleware/auth.js:26-37`, `server/middleware/auth.js:54-66`
**Action:**
- Return the promise from `prisma.user.findUnique()` in `authenticate` and `optionalAuthenticate`
- Ensure Express properly waits for async operations

## Phase 3: Medium-Priority Fixes (Post-Launch Improvements)

### 3.1 Strengthen Password Policy
**Severity:** MEDIUM
**File:** `server/controllers/auth.controller.js:14-16`
**Action:**
- Require minimum 8 characters
- Add complexity requirements (uppercase, lowercase, digit, special character)
- Add password strength meter in client

### 3.2 Add Request ID Correlation
**Severity:** MEDIUM
**File:** `server/index.js:9-18`
**Action:**
- Generate unique request ID for each request
- Include in all log entries
- Return in response headers for debugging

### 3.3 Improve Rate Limiting
**Severity:** MEDIUM
**Files:** `server/index.js`, `server/routes/*.js`
**Action:**
- Add per-user rate limits for authenticated endpoints
- Add rate limiting to password change endpoint
- Consider token bucket algorithm for smoother rate limiting

### 3.4 Add Input Length Validation
**Severity:** MEDIUM
**File:** `server/middleware/validate.js`
**Action:**
- Add max-length enforcement for string fields (255 chars for names, 10000 for content)
- Add max-length for arrays (100 items for tags)
- Validate array element types

## Phase 4: Low-Priority Improvements (Ongoing)

### 4.1 Enhance Logging
**Severity:** LOW
**Files:** `server/services/logger.js`, `server/controllers/auth.controller.js`
**Action:**
- Replace `console.error` calls with structured logger
- Add request ID to all log entries
- Implement log rotation and retention policies

### 4.2 Add Security Tests
**Severity:** LOW
**File:** `server/__tests__/`
**Action:**
- Add tests for `authenticate` middleware
- Add tests for rate limiters
- Add tests for input validation
- Add integration tests for auth flows

### 4.3 Improve Docker Security
**Severity:** LOW
**Files:** `docker-compose.yml`, `server/.dockerignore`
**Action:**
- Use environment variables for database credentials
- Remove exposed database port
- Add missing entries to `.dockerignore`

### 4.4 Client-Side Improvements
**Severity:** LOW
**Files:** `client/src/app/contexts/AuthContext.tsx`, `client/src/app/services/apiClient.ts`
**Action:**
- Consider httpOnly cookie-based auth (requires CSRF protection)
- Add rate limiting on client side for API calls
- Implement retry logic with exponential backoff

## Implementation Timeline

### Week 1: Critical Fixes
- Day 1-2: Rotate JWT secret, fix S3 deletion
- Day 3-4: Add security headers
- Day 5: Update seed credentials, fix async middleware

### Week 2: High-Priority Fixes
- Day 1-3: Fix multipart upload validation
- Day 4-5: Implement account lockout

### Week 3: Medium-Priority Fixes
- Day 1-2: Strengthen password policy
- Day 3-4: Add request ID correlation
- Day 5: Improve rate limiting

### Week 4: Low-Priority Improvements
- Day 1-2: Enhance logging
- Day 3-4: Add security tests
- Day 5: Docker and client improvements

## Success Metrics

1. **Critical findings reduced to 0** before any public deployment
2. **High findings reduced to 0** before public launch
3. **Medium findings reduced by 50%** within first month
4. **Security test coverage > 80%** for critical paths
5. **No successful penetration test findings** in post-launch audit

## Monitoring and Alerting

### Required Alerts
1. Failed login attempts > 10 per minute per IP
2. JWT validation errors > 50 per minute
3. S3 access errors > 100 per hour
4. Database connection failures
5. Backup failures

### Log Retention
- Application logs: 30 days
- Audit logs: 90 days
- Security logs: 1 year
- Backup logs: 1 year
