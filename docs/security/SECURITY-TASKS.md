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
**Status:** ✅ COMPLETED (Aug 2026)
**Files:** `server/middleware/auth.js`
**What was done:**
- Wrote comprehensive test suite: `async-auth-behavior.test.js`
- All 8 tests pass — confirms NO auth bypass exists
- `authenticate`/`optionalAuthenticate` converted from `.then().catch()` chains to `async/await` — promises are now returned to Express 5 so their completion state is tracked
- Identical 401 messages preserved: 'Unauthorized - No token provided', 'Unauthorized - Invalid token', 'Unauthorized - Token revoked', 'Unauthorized - Token verification failed'
- Test suite still green: `async-auth-behavior.test.js`, `auth-middleware.test.js`, `auth-security.test.js`

## Next Week

### Task 7: Strengthen Password Policy
**Priority:** MEDIUM
**Status:** ✅ COMPLETED (Aug 2026)
**Files:** `server/utils/password-policy.js`, `server/controllers/auth.controller.js`, `client/src/app/utils/password.ts`, `client/src/app/components/{SignupModal,ChangePasswordModal,AddUserModal}.tsx`
**Acceptance Criteria:**
- [x] Update validation to require 8+ characters (enforced on server: register, createUser, changePassword)
- [x] Add complexity requirements (lowercase + uppercase + digit + special, max 128)
- [x] Update client-side validation (shared `checkPassword` util mirrors server policy)
- [ ] Add password strength indicator (not added — deferred)
- [ ] Deploy to staging (infra action)
**Note:** `admin updateUser` is intentionally policy-free to preserve admin password-reset flexibility.

### Task 8: Add Request IDs
**Priority:** MEDIUM
**Status:** ✅ COMPLETED (Aug 2026)
**Files:** `server/middleware/requestId.js`, `server/index.js`, `server/middleware/errorHandler.js`
**Acceptance Criteria:**
- [x] Generate UUID for each request (`crypto.randomUUID` in new `requestId` middleware, registered before requestLogger)
- [x] Include in all log entries (requestLogger + errorHandler now emit `requestId`)
- [x] Return in response headers (`X-Request-ID`)
- [x] Update error handling (errorHandler log payload includes `requestId`)
- [ ] Deploy to staging (infra action)
- Unit tests pass: `request-id.test.js`

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
- `validate-security.test.js` — input length / array-item / field-stripping tests (added Aug 2026)
- `password-policy.test.js` — password complexity policy tests (added Aug 2026)
- `request-id.test.js` — request ID assignment/header tests (added Aug 2026)
**Baseline:** 136/136 server tests passing (was 113).

### Task 12: Docker Security Improvements
**Priority:** LOW
**Status:** ✅ COMPLETED (code) — Docker build test pending (docker CLI not available in this environment)
**Files:** `docker-compose.yml`, `server/.dockerignore`
**Acceptance Criteria:**
- [x] Use environment variables for credentials (`${POSTGRES_USER:-...}`, `${POSTGRES_PASSWORD:-...}`, `${POSTGRES_DB:-...}`)
- [x] Remove exposed database port (commented out, no host mapping)
- [x] Update `.dockerignore` (env files, node_modules, tests, dist, logs, backups, git, docs)
- [x] API fails fast if `JWT_SECRET` missing: `${JWT_SECRET:?JWT_SECRET must be set to a random 32+ char value}`
- [x] API secrets never ship with a weak default in compose
- [ ] Test Docker build (needs docker CLI)

### Task 13: Client-Side Improvements
**Priority:** LOW
**Status:** ✅ PARTIALLY COMPLETED (Aug 2026) — httpOnly cookie auth & strength-indicator UI deferred
**Files:** `client/src/app/services/apiClient.ts`, `client/src/app/utils/password.ts`, `client/src/app/components/{SignupModal,ChangePasswordModal,AddUserModal}.tsx`
**Acceptance Criteria:**
- [ ] Evaluate httpOnly cookie auth (deferred — requires broader auth refactor)
- [x] Add client-side rate limiting (150ms min-gap throttle in `apiRequest`)
- [x] Implement retry logic (GET-only exponential backoff w/ jitter on 429/502/503/504/network errors; mutations never retried to avoid double-submit)
- [x] Update error handling (API transport errors surfaced as before; session-expiry triggers preserved)
- [x] Client password strength now mirrors server policy (8+ chars, complexity requirements)

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
