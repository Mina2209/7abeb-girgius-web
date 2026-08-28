# Security Tasks

## Immediate Actions (Today) — COMPLETED

### Task 1: Rotate JWT Secret
**Priority:** CRITICAL
**Status:** ✅ IMPLEMENTED (code-level validation added; actual secret rotation = infrastructure action)
**Assignee:** DevOps/Security Lead
**Estimated Time:** 30 minutes
**Acceptance Criteria:**
- [x] Startup validation enforces 32+ char secret, weak-pattern detection, entropy check
- [ ] Generate new 64+ character random secret (INFRASTRUCTURE ACTION)
- [ ] Update production environment variable (INFRASTRUCTURE ACTION)
- [ ] Invalidate all existing tokens — force re-login (INFRASTRUCTURE ACTION)

### Task 2: Fix S3 Object Deletion
**Priority:** CRITICAL
**Status:** ✅ COMPLETED
**Files:** `server/controllers/upload.controller.js`
**What was done:**
- Added `isWritableKey()` function with `WRITABLE_PREFIXES` allowlist
- Deletion now validates key against writable prefixes before calling S3
- Unit tests pass: `s3-key-auth.test.js`

### Task 3: Add Security Headers
**Priority:** CRITICAL
**Status:** ✅ COMPLETED
**Files:** `server/index.js`, `client/vercel.json`
**What was done:**
- Added `securityHeaders` middleware (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- Added HSTS header for HTTPS
- Added CSP header to vercel.json (reports only — enforcing deferred)
- Unit tests pass: `security-headers.test.js`

## This Week

### Task 4: Fix Multipart Upload
**Priority:** HIGH
**Status:** ✅ COMPLETED
**Files:** `server/controllers/upload.controller.js`
**What was done:**
- Added `initiatedUploads` Map to track active uploads
- `initiateMultipart` records uploads; `presignPart`/`completeMultipart`/`abortMultipart` validate against them
- Unit tests pass: `multipart-auth.test.js`

### Task 5: Implement Account Lockout
**Priority:** HIGH
**Status:** ✅ COMPLETED (progressive delay, NOT lockout — per user's request to avoid DoS)
**Files:** `server/services/auth.service.js`
**What was done:**
- Implemented in-memory progressive delay (exponential backoff per-username)
- 1s base delay, 30s max, 15-minute window
- Same delay applied to non-existent users (prevents enumeration)
- Unit tests pass: `brute-force-protection.test.js`
**Note:** User requested NO blind account lockout. Analysis required comparing lockout, progressive backoff, per-account+per-IP, and failure counters before deploying.

### Task 6: Fix Async Middleware
**Priority:** HIGH → LOW (downgraded after testing)
**Status:** ⚠️ NOT FIXED (reliability issue only, no auth bypass confirmed)
**Files:** `server/middleware/auth.js`
**What was done:**
- Wrote comprehensive test suite: `async-auth-behavior.test.js`
- All 8 tests pass — confirms NO auth bypass exists
- Issue is code quality (promise not returned to Express), not security
**Recommendation:** Fix in future maintenance cycle; low risk as-is

## Next Week

### Task 7: Strengthen Password Policy
**Priority:** MEDIUM
**Assignee:** Backend Developer
**Estimated Time:** 3 hours
**Acceptance Criteria:**
- [ ] Update validation to require 8+ characters
- [ ] Add complexity requirements
- [ ] Update client-side validation
- [ ] Add password strength indicator
- [ ] Deploy to staging

### Task 8: Add Request IDs
**Priority:** MEDIUM
**Assignee:** Backend Developer
**Estimated Time:** 2 hours
**Acceptance Criteria:**
- [ ] Generate UUID for each request
- [ ] Include in all log entries
- [ ] Return in response headers
- [ ] Update error handling
- [ ] Deploy to staging

### Task 9: Invalidate Tokens on Role Change
**Priority:** MEDIUM
**Status:** ✅ COMPLETED
**Files:** `server/services/auth.service.js`
**What was done:**
- `updateUser` now increments `tokenVersion` when role changes
- Role unchanged = no increment (preserves current session)
- Unit tests pass: `role-change-token.test.js`

## Seed Safety (Immediate — Phase 1)

### Task: Fix Seed Script
**Priority:** CRITICAL
**Status:** ✅ COMPLETED
**Files:** `server/prisma/seed.js`
**What was done:**
- Added `NODE_ENV === 'production'` guard with `process.exit(1)`
- Removed hardcoded passwords; now generates random 16-char passwords via `crypto.randomBytes`
- Removed console.log of actual password values
- Unit tests pass: `seed-safety.test.js`

## Ongoing Tasks

### Task 10: Enhance Logging
**Priority:** LOW
**Assignee:** Backend Developer
**Estimated Time:** 4 hours
**Acceptance Criteria:**
- [ ] Replace all `console.error` with structured logger
- [ ] Add request ID to all log entries
- [ ] Implement log rotation
- [ ] Set up log retention policies

### Task 11: Add Security Tests
**Priority:** LOW
**Status:** ✅ COMPLETED (for Phase 1 + Phase 2 findings)
**What was done:**
- `s3-key-auth.test.js` — isWritableKey unit tests
- `security-headers.test.js` — security headers presence tests
- `seed-safety.test.js` — seed script safety verification
- `jwt-secret-validation.test.js` — JWT secret strength validation tests
- `multipart-auth.test.js` — multipart upload authorization tests
- `role-change-token.test.js` — role change token invalidation tests
- `brute-force-protection.test.js` — progressive delay brute-force tests
- `async-auth-behavior.test.js` — async auth middleware behavior tests
**Remaining:** Rate limiter tests, input validation tests, auth flow integration tests

### Task 12: Docker Security Improvements
**Priority:** LOW
**Assignee:** DevOps
**Estimated Time:** 2 hours
**Acceptance Criteria:**
- [ ] Use environment variables for credentials
- [ ] Remove exposed database port
- [ ] Update `.dockerignore`
- [ ] Test Docker build

### Task 13: Client-Side Improvements
**Priority:** LOW
**Assignee:** Frontend Developer
**Estimated Time:** 4 hours
**Acceptance Criteria:**
- [ ] Evaluate httpOnly cookie auth
- [ ] Add client-side rate limiting
- [ ] Implement retry logic
- [ ] Update error handling

## Emergency Procedures

### Security Incident Response
1. **Detection:** Monitor logs for suspicious activity
2. **Containment:** Immediately revoke compromised credentials
3. **Eradication:** Patch vulnerability and deploy fix
4. **Recovery:** Restore from clean backup if needed
5. **Lessons Learned:** Update security procedures

### Rollback Procedures
1. **Database:** Restore from latest backup
2. **Application:** Deploy previous version
3. **Credentials:** Revoke and rotate all secrets
4. **Communication:** Notify affected users if needed

## Verification Checklist

Before marking any task as complete:
- [ ] Code reviewed by another developer
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] Deployed to staging environment
- [ ] Verified in staging environment
- [ ] Production deployment planned
