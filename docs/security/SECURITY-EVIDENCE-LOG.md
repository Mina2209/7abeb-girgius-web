# Security Evidence Log

## Finding 1: Weak JWT Secret
**Severity:** CRITICAL
**Status:** CONFIRMED
**File:** `server/.env:5`
**Evidence:**
```
JWT_SECRET=7abeb-girgius-secret-key-2026
```
**Analysis:** The JWT secret follows a predictable pattern (`<project>-secret-key-<year>`). An attacker who knows the project name and current year can forge valid JWT tokens. The startup check in `index.js:59` only verifies presence, not strength.
**Attack Scenario:** Attacker guesses or discovers the pattern, forges admin JWT, gains full system access.
**Exploitability:** HIGH - Pattern is easily guessable
**Impact:** CRITICAL - Complete authentication bypass
**Recommended Fix:** Generate cryptographically random 64+ character secret
**Confidence:** CONFIRMED

## Finding 2: S3 Object Deletion Without Validation
**Severity:** CRITICAL
**Status:** CONFIRMED
**File:** `server/controllers/upload.controller.js:148-153`
**Evidence:**
```javascript
remove: async (req, res) => {
    const key = req.params.key || req.body?.key;
    if (!key) return res.status(400).json({ error: 'key required' });
    await s3Service.deleteObject(key);
    return res.json({ success: true });
}
```
**Analysis:** Unlike other endpoints that validate S3 keys against `PUBLIC_READ_PREFIXES`, the deletion endpoint accepts any key. An authenticated editor can delete any object in the S3 bucket.
**Attack Scenario:** Malicious editor deletes backup files, user uploads, or other critical data.
**Exploitability:** HIGH - Requires editor account (obtainable via weak seed credentials)
**Impact:** CRITICAL - Data loss, potential DoS
**Recommended Fix:** Add prefix validation using `isReadableKey()` or write-allowlist
**Confidence:** CONFIRMED

## Finding 3: Missing Security Headers
**Severity:** CRITICAL
**Status:** CONFIRMED
**Files:** `client/vercel.json`, `server/index.js`
**Evidence:**
- `vercel.json` contains only rewrites, no headers configuration
- No `helmet` middleware in server
- No manual header setters in application code
- Grep search for security headers returns zero matches
**Analysis:** Application lacks all standard security headers (CSP, HSTS, X-Frame-Options, etc.).
**Attack Scenario:** Clickjacking, MIME-sniffing, protocol downgrade attacks.
**Exploitability:** MEDIUM - Requires user interaction
**Impact:** HIGH - Various browser-based attacks
**Recommended Fix:** Add all standard security headers to `vercel.json` or use `helmet` middleware
**Confidence:** CONFIRMED

## Finding 4: Weak Seed Credentials
**Severity:** CRITICAL
**Status:** CONFIRMED
**File:** `server/prisma/seed.js:7-8,30`
**Evidence:**
```javascript
const adminPassword = await bcrypt.hash('@dmin123$', 10);
console.log('Default users created: admin/TEmPpasSWordFoRaDMin12e4##');
```
**Analysis:** Seed script creates admin account with weak password and logs a different (also weak) password to console. If run in production, creates easily compromised accounts.
**Attack Scenario:** Attacker uses default credentials to gain admin access.
**Exploitability:** HIGH - Default credentials are well-known
**Impact:** CRITICAL - Complete system compromise
**Recommended Fix:** Generate random passwords, don't log credentials
**Confidence:** CONFIRMED

## Finding 5: Multipart Upload Bypass
**Severity:** HIGH
**Status:** CONFIRMED
**File:** `server/controllers/upload.controller.js:167-179`
**Evidence:**
- `presignPart` accepts arbitrary `key` from request body
- No validation against initiated uploads
- Bypasses `S3_FOLDER_MAP` restrictions
**Analysis:** Editor can upload to any S3 location by manipulating the key parameter in multipart requests.
**Attack Scenario:** Upload malicious files to backup or system folders.
**Exploitability:** MEDIUM - Requires editor account
**Impact:** HIGH - Data integrity compromise
**Recommended Fix:** Track initiated uploads and validate keys against them
**Confidence:** CONFIRMED

## Finding 6: No Account Lockout
**Severity:** HIGH
**Status:** CONFIRMED
**Files:** `server/controllers/auth.controller.js`, `server/services/auth.service.js`
**Evidence:**
- Only IP-based rate limiting (10 attempts/15min)
- No account-level lockout mechanism
- Same error message for invalid username/password
**Analysis:** Attacker can rotate IPs to brute-force passwords indefinitely.
**Attack Scenario:** Dictionary attack against user accounts using VPN/proxy rotation.
**Exploitability:** HIGH - Simple automation
**Impact:** HIGH - Account compromise
**Recommended Fix:** Implement account lockout after 5 failed attempts
**Confidence:** CONFIRMED

## Finding 7: Role Changes Don't Invalidate Tokens
**Severity:** HIGH
**Status:** CONFIRMED
**Files:** `server/services/auth.service.js`, `server/middleware/auth.js`
**Evidence:**
- `tokenVersion` only incremented on password change
- Role changes don't affect existing tokens
- JWT contains role from time of issuance
**Analysis:** Downgraded user retains admin access until token expires (7 days) or password changes.
**Attack Scenario:** Admin demotes compromised account, but attacker continues using old token.
**Exploitability:** MEDIUM - Requires admin action
**Impact:** HIGH - Persistent unauthorized access
**Recommended Fix:** Increment tokenVersion on role change
**Confidence:** CONFIRMED

## Finding 8: Async Middleware Bug
**Severity:** HIGH → MEDIUM (downgraded after testing)
**Status:** REMEDIATED (Aug 2026)
**File:** `server/middleware/auth.js:26-37`
**Evidence (original):**
```javascript
prisma.user.findUnique({ where: { id: decoded.id } })
    .then(user => {
        // ... authentication logic
    })
    .catch(() => {
        // ... error handling
    });
```
**Test Results (async-auth-behavior.test.js):**
- ✅ `next()` called only after DB query succeeds
- ✅ 401 returned on tokenVersion mismatch
- ✅ 401 returned when user not found in DB
- ✅ 401 returned on DB error
- ✅ Auth blocks requests during slow DB queries
- ✅ Legacy tokens without tokenVersion handled correctly
**Analysis:** The promise is not returned to Express 4, which means Express doesn't track its lifecycle. However, in Express 5, rejected promises ARE caught. The test confirms the middleware functionally blocks unauthorized requests — there is NO auth bypass. The issue is a code quality/reliability concern: if both `res.status(401).json()` and `next()` are somehow called, Express would throw "headers already sent" errors. Under normal operation, the branching logic prevents this.
**Attack Scenario:** Slow DB query could theoretically cause Express to not track the middleware's completion state — but this does NOT cause auth bypass because the promise chain handles both success (next()) and failure (401) paths correctly.
**Exploitability:** LOW - No proven exploit path
**Impact:** LOW (reliability issue only, not security bypass)
**Recommended Fix:** Make middleware async or return promise from `.then().catch()` chain
**Remediation:** `authenticate`/`optionalAuthenticate` rewritten as `async` functions with `try/await/catch`; promises now returned to Express 5 for lifecycle tracking. Identical 401 messages preserved. Regression: suite green (`async-auth-behavior`, `auth-middleware`, `auth-security`).
**Confidence:** DOWNGRADED from HIGH to LOW after empirical testing

## Finding 9: Weak Password Policy
**Severity:** MEDIUM
**Status:** REMEDIATED (Aug 2026)
**File:** `server/controllers/auth.controller.js:14-16`
**Evidence (original):**
```javascript
if (!password || password.length < 6) {
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
}
```
**Analysis:** Only requires 6 characters, no complexity requirements.
**Attack Scenario:** Dictionary attack succeeds with weak passwords.
**Exploitability:** MEDIUM - Depends on user password choice
**Impact:** MEDIUM - Account compromise
**Recommended Fix:** Require 8+ characters with complexity
**Remediation:** New `server/utils/password-policy.js`: min 8 / max 128, plus lowercase + uppercase + digit + special. Enforced in `register`, `createUser` (admin-add), and self-service `changePassword`. `admin updateUser` intentionally policy-free (admin reset flexibility; existing tests rely on short passwords there). Client mirrors via `client/src/app/utils/password.ts` in Signup/ChangePassword/AddUser modals. Tests: `password-policy.test.js`.
**Confidence:** CONFIRMED

## Finding 10: No Request ID Correlation
**Severity:** MEDIUM
**Status:** REMEDIATED (Aug 2026)
**File:** `server/index.js:9-18`
**Evidence (original):**
```javascript
const requestLogger = (req, res, next) => {
    if (req.path === '/health') return next();
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
};
```
**Analysis:** No request ID generated or logged, making debugging difficult.
**Attack Scenario:** Security incident investigation hampered by lack of correlation.
**Exploitability:** N/A - Operational issue
**Impact:** MEDIUM - Incident response difficulty
**Recommended Fix:** Generate UUID for each request, include in logs
**Remediation:** New `server/middleware/requestId.js` (registers before requestLogger) assigns `crypto.randomUUID()` per request, echoes it via `X-Request-ID` response header, and includes `requestId` in both requestLogger lines and errorHandler log payload. Tests: `request-id.test.js`.
**Confidence:** CONFIRMED

## Finding 11: No Max-Length / Array-Item Enforcement in Request Validation
**Severity:** MEDIUM
**Status:** REMEDIATED (Aug 2026)
**File:** `server/middleware/validate.js`, route schemas
**Evidence (original):** `validate()` types were `string`/`string?`/`array?` with no maximum-length or per-element constraints, so oversized strings/arrays were passed through to controllers/database.
**Analysis:** Unbounded text bodies can inflate DB storage and downstream processing (PDF/zip generation), enabling storage/blast-radius abuse.
**Remediation:** `validate()` now supports `string:255`, `string?:10000`, `string[]:100`, `array?:100`, and `string[]:100:255` (max count, per-element max). Route schemas updated for hymn, father, image, saying, tag. Unknown fields still stripped; bodies replaced with validated payload only. Tests: `validate-security.test.js`.
**Confidence:** CONFIRMED

## Positive Findings (Well Implemented)

### P1: SQL Injection Prevention
**Status:** CONFIRMED SAFE
**Evidence:**
- All raw SQL uses parameterized queries (`$queryRaw` with tagged templates or `$queryRawUnsafe` with `$1`/`$2` parameters)
- No string interpolation in SQL queries
- Dynamic ORDER BY uses whitelisted values only

### P2: Password Hashing
**Status:** CONFIRMED SAFE
**Evidence:**
- bcrypt with cost factor 10
- Constant-time comparison via `bcrypt.compare`
- Passwords never returned in API responses

### P3: JWT Token Revocation
**Status:** CONFIRMED SAFE
**Evidence:**
- `tokenVersion` field on User model
- Checked on every authenticated request
- Incremented on password change

### P4: Input Validation Framework
**Status:** CONFIRMED SAFE
**Evidence:**
- Unknown fields stripped from request body
- Type validation for strings, numbers, booleans, arrays
- Trim and reject empty strings

### P5: Rate Limiting
**Status:** CONFIRMED SAFE
**Evidence:**
- Global API rate limiter (500/15min)
- Login rate limiter (10/15min)
- Register rate limiter (5/hour)
- ZIP download rate limiter (10/hour)

### P6: Docker Security
**Status:** CONFIRMED SAFE — strengthened (Aug 2026)
**Evidence:**
- Multi-stage build excludes dev dependencies
- Runs as non-root user (`USER node`)
- No secrets hardcoded in Dockerfile
- `docker-compose.yml` no longer hardcodes `POSTGRES_PASSWORD`/`JWT_SECRET`; credentials come from env var interpolation and the API refuses to boot if `JWT_SECRET` unset (fail-fast `${JWT_SECRET:?...}`)
- DB port no longer published to the host (internal compose network only; host mapping commented out)

### P7: Backup Security
**Status:** CONFIRMED SAFE
**Evidence:**
- Admin-only access required
- Uses `execFile` (no shell injection)
- Database password parsed via URL constructor
- Presigned URLs with 1-hour expiry

## False Positives

### FP1: CORS No-Origin Bypass
**Status:** FALSE POSITIVE
**Analysis:** Allowing requests without Origin header is standard behavior for server-to-server communication. Browser CORS policies still apply to browser requests.

### FP2: Trust Proxy Configuration
**Status:** FALSE POSITIVE
**Analysis:** `app.set('trust proxy', 1)` is correct for single-proxy deployments (e.g., load balancer).

## Infrastructure Verification Checklist

Items that cannot be verified from repository code alone:

- [ ] AWS Security Group settings
- [ ] Actual TLS termination configuration
- [ ] Production environment variables
- [ ] Database firewall rules
- [ ] VPC configuration
- [ ] Load balancer configuration
- [ ] S3 bucket policies
- [ ] IAM role permissions
- [ ] Network segmentation
- [ ] DDoS protection settings

**Note:** These require infrastructure access to verify.
