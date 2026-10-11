# Arabic PowerPoint/PDF Preview — Deployment Instructions

> **STATUS: DEPLOYED ✅ — 2026-10-11 (stamp `20261011-085211`).**
>
> Both fixes are live on `st-mary-backend` (EC2 `ip-172-31-77-124`).
> | | |
> |---|---|
> | New release | `/home/ec2-user/releases/20261011-085211` |
> | Previous release (rollback target) | `/home/ec2-user/releases/20261007-135433` |
> | `current` symlink | → `20261011-085211` (atomic swap; PM2 **Case A**) |
> | PM2 | `st-mary-backend` **online**, script path `/home/ec2-user/current/index.js` |
> | File backups | `/home/ec2-user/backups-20261011-085211/` (both replaced files) |
> | Font-config backup | `/home/ec2-user/fontbackup-20261011-085211/` (prior conf + `tajawal.orig.tgz`) |
> | Font baseline log | `/home/ec2-user/fontfix-before-20261011-085211.txt` |
> | Health | `GET /health` → `200 {"status":"ok","db":"connected"}` |
> | Post-deploy `ERR_HTTP_HEADERS_SENT` (new release) | **0** (36 are historical, all from the old release path) |
> | On-demand preview gate | uncached deck converted → valid PDF, **Tajawal embedded, no Noto**, `clip-guard` repaired 19 slides; HTTP 200 |
> | Visual sign-off (§10.5) | **PASS 2026-10-11** — shaping, RTL, clipping, layout all PASS (deck `Hymns/1770576021243-378285480-احكى_يا_تاريخ.ppsx`) |
>
> **Local verification:** full test suite **228 passed** (23 files); `sha256sum -c SHA256SUMS`
> **9/9 OK** in this package. The steps below were executed in order; §11 rollback restores the
> prior state.

Target process: **`st-mary-backend`** (fixed — do not auto-detect).

---

## 1. Verified production facts (inputs to these instructions)

| Fact | Value |
|---|---|
| `current` | symlink → `/home/ec2-user/releases/20261007-135433` |
| PM2 process | `st-mary-backend` |
| PM2 script path | `/home/ec2-user/current/index.js` |
| PM2 working directory | `/home/ec2-user/current` |
| Release layout | **root-level backend**: `index.js`, `services/`, `controllers/`, `routes/`, `prisma/`, `node_modules/`, `.env` all at the **release root** — **no `server/` prefix** |
| Active release has | `services/ppsx-converter.js`, `controllers/upload.controller.js` (at root) |
| Active release lacks | the font installer and the Tajawal font assets |
| Host tools already present | `fc-match`, `fc-cache`, `libreoffice`, `pdffonts` |
| Free disk | ~17 GB |
| Health endpoint | `GET /health` — **read-only**; `200 {"status":"ok","db":"connected"}` or `503 {"status":"error","db":"disconnected"}`; runs a read-only `SELECT 1` |

**Consequence:** the repo (and this package) uses a `server/` prefix, but production does
**not**. Every path below maps `server/<x>` → `<release>/<x>`.

---

## 2. Root causes (two independent bugs)

### 2a. Arabic glyphs — disconnected / mis-shaped (font substitution)

LibreOffice converts decks to PDF on the host. The hymn decks tag Arabic lyric runs
`cs="Times New Roman"` (not embedded). Docker installs **Tajawal** + a fontconfig alias
`Times New Roman → Tajawal`; the PM2 host never did → fontconfig substitutes **Noto Naskh
Arabic** → disconnected glyphs. Cached previews are fine; **decks without a cached preview**
(converted on demand) are affected. Fix = install the font + alias on the host, plus a
startup self-check and a hardened preview-route ETag match.

### 2b. `ERR_HTTP_HEADERS_SENT` on the preview route (stream double-response)

`controllers/upload.controller.js` `previewPdf` piped the S3 body to the response and answered
errors from an outer `try/catch` with `res.status(404).send('not found')`. When the S3 body
fails **asynchronously**, after `body.pipe(res)` has already flushed the headers, that second
answer throws `ERR_HTTP_HEADERS_SENT` ("Cannot set headers after they are sent"). Observed in
production with a **missing cached preview key** (`NoSuchKey` → "The specified key does not
exist."): the `getObjectForProxy` call resolves, the body then errors, and the catch re-sends.

Fix (in this package): the body stream is guarded *before* it is piped —
- the guard attaches a single `error` handler; if headers are **not** yet sent it answers
  **502 `{"error":"preview stream failed"}`** exactly once; if headers **are** already sent it
  calls `res.destroy(err)` (drops the connection — the only correct action);
- the outer `catch` is additionally defensive: it `res.destroy(err)`s instead of answering when
  `res.headersSent` is true.
- the guard is the exported `guardBodyStream(res, body, onError)` helper, unit-tested directly.

This is a **behavioral change to a runtime file** (`upload.controller.js`), separate from the
font fix; both must be deployed together (§7.3 ships the new controller).

---

## 3. Package contents and file → destination mapping

The staging package keeps the repo layout (`server/...`). **Do not copy the package's
`server/` folder wholesale.** Copy each file to its mapped destination explicitly.

### 3a. Runtime files → release destinations (7)

| Staging package path | Release destination (root-level) | Action |
|---|---|---|
| `server/scripts/install-arabic-fonts.sh` | `scripts/install-arabic-fonts.sh` | **add** |
| `server/fonts/Tajawal-Regular.ttf` | `fonts/Tajawal-Regular.ttf` | **add** |
| `server/fonts/Tajawal-Bold.ttf` | `fonts/Tajawal-Bold.ttf` | **add** |
| `server/fonts/OFL.txt` | `fonts/OFL.txt` | **add** |
| `server/fonts/90-tajawal-times-new-roman.conf` | `fonts/90-tajawal-times-new-roman.conf` | **add** |
| `server/services/ppsx-converter.js` | `services/ppsx-converter.js` | **replace** |
| `server/controllers/upload.controller.js` | `controllers/upload.controller.js` | **replace** |

### 3b. Test files → **not deployed** (2)

`server/__tests__/ppsx-converter.test.js`, `server/__tests__/upload-preview-route.test.js`
are **not copied to production** (not imported by the server; dev-only runner). They ship in
the package only for local/CI verification. The preview-route test file now also contains
`guardBodyStream (stream double-response guard)` unit tests (502-before-headers path and
destroy-after-headers path) that pin the §2b fix. Run them locally with:

```bash
cd server && npx vitest run __tests__/upload-preview-route.test.js __tests__/ppsx-converter.test.js
```

### 3c. SHA-256 (`SHA256SUMS`, all 9 payload files)

`SHA256SUMS` lists the **staging** paths (`server/...`); run it in the staging dir (§6). The
7 runtime-file hashes:

```
02baa4315a2bc84fa109b59397bcbc369c98f3f18ee69c7f1e651ba10c1c8a84  server/scripts/install-arabic-fonts.sh
6882892da3e03527d5db2bbab3b48bde6ef2e878a43f522d1a4eebda90010a19  server/fonts/Tajawal-Regular.ttf
0342ab6b74b6bd1b4b5bf7beda45a9734a2b3147a31e8a3a45b6a3417a52d9d7  server/fonts/Tajawal-Bold.ttf
9b584984f9db0ee30347391a76eff9c0a6b03dc450c3c6afe3757a2cb3a4db87  server/fonts/OFL.txt
45251f26e8660e6fad7b7d228ca7febdf992a26e81e3f1014b3cd7a64bfad3e2  server/fonts/90-tajawal-times-new-roman.conf
3a5e9cc0e1e2c36a838a58b6752555ae9fac78d08aab7497a060558585910d00  server/services/ppsx-converter.js
5583b830e491c669ea4b8f4538d20df568de529b5371b47db6ab491cbaed6fcb  server/controllers/upload.controller.js
```

The two test-file hashes (staging only, not deployed):
```
6ddc144039c20574296d86120260bc6eaf8d740e58c1cbf32d19252ab6ffbfcf  server/__tests__/upload-preview-route.test.js
f02638fb3d1918cdd20035db8b43802037256cce8e04341df4997496511d9969  server/__tests__/ppsx-converter.test.js
```

---

## 4. How the installer locates its fonts (after mapping)

`install-arabic-fonts.sh` derives its source directory as **`$here/../fonts`**, where `$here`
is the script's own directory. Mapping the installer to **`<release>/scripts/`** and the
assets to **`<release>/fonts/`** keeps them siblings, so `$here/../fonts` resolves to
`<release>/fonts` — **exactly as in the repo**.

- **No change to the installer is required.**
- This was verified with the mapped layout (`scripts/` + `fonts/` as siblings): the installer
  found all four assets (passed its asset loop) and proceeded to its next guard. It also
  self-checks and exits 1 **before installing** if any asset is missing.
- Do **not** place the installer at the release root (then `$here/../fonts` would resolve to
  `/home/ec2-user/fonts`, which does not exist). Keep `scripts/` + `fonts/` siblings.

---

## 5. Prerequisites / preflight (host)

Host tools are already present. Verify (read-only) and check disk:

```bash
command -v fc-match fc-cache libreoffice pdffonts
df -h /home/ec2-user
du -sh /home/ec2-user/releases/20261007-135433   # size to clone; must be < free space
```

**Release prerequisite:** the active release must already serve the cache-header backend
(`services/s3.service.js` returning `ETag`/`Last-Modified`) — confirmed live. We are **not**
shipping `services/s3.service.js`; the clone preserves the existing one. **No DB migrations, no
schema changes, and no changes to existing S3 objects.** The only S3 write in this whole document
is the single **new** preview cache object created for a verified-uncached deck by the §10.4 test;
source decks and existing cached previews are never modified or deleted.

---

## 6. Transfer the verified package Windows → EC2

From **Windows PowerShell**, package at `F:\7abeb-girgius-web\deploy-pptx-arabic-font-fix\`:

```powershell
$EC2 = "ec2-user@<EC2_HOST_OR_IP>"
$KEY = "C:\path\to\your-key.pem"
scp -i $KEY -r "F:\7abeb-girgius-web\deploy-pptx-arabic-font-fix" "${EC2}:/home/ec2-user/"
# -> /home/ec2-user/deploy-pptx-arabic-font-fix/
```

Alternatives:
```powershell
pscp -i C:\path\to\key.ppk -r "F:\7abeb-girgius-web\deploy-pptx-arabic-font-fix" ec2-user@<HOST>:/home/ec2-user/
wsl rsync -av -e "ssh -i /mnt/c/path/to/key.pem" /mnt/f/7abeb-girgius-web/deploy-pptx-arabic-font-fix/ ec2-user@<HOST>:/home/ec2-user/deploy-pptx-arabic-font-fix/
```

Verify on the server (stop if any line is not `OK`):

```bash
cd /home/ec2-user/deploy-pptx-arabic-font-fix
sha256sum -c SHA256SUMS
```

---

## 7. Prepare the new release (clone; do not touch the active release)

Variables used below:

```bash
set -euo pipefail
APP=st-mary-backend
CUR=/home/ec2-user/current
OLD=/home/ec2-user/releases/20261007-135433      # verified current target (preserve)
STAGE=/home/ec2-user/deploy-pptx-arabic-font-fix
STAMP=$(date +%Y%m%d-%H%M%S)
REL=/home/ec2-user/releases/$STAMP
BACKUP=/home/ec2-user/backups-$STAMP
```

### 7.1 Clone the active release (preserves deps, `.env`, prisma)

```bash
test -L "$CUR" || { echo "ABORT: $CUR is not a symlink"; exit 1; }
test -d "$OLD" || { echo "ABORT: missing active release $OLD"; exit 1; }
mkdir -p /home/ec2-user/releases
cp -a "$OLD" "$REL"           # full copy; includes node_modules/ and .env (NOT modified)
echo "new release: $REL"
```

`cp -a` preserves the existing `node_modules/`, `prisma/`, and `.env`. **The package contains
no `.env` and it is never copied or overwritten.**

### 7.2 Back up the two files being replaced (verify each backup)

```bash
mkdir -p "$BACKUP"
for f in services/ppsx-converter.js controllers/upload.controller.js; do
  test -f "$REL/$f" || { echo "ABORT: missing $REL/$f"; exit 1; }
  cp -p "$REL/$f" "$BACKUP/$(echo "$f" | tr '/' '_').$STAMP.bak"
  test -s "$BACKUP/$(echo "$f" | tr '/' '_').$STAMP.bak" || { echo "ABORT: backup failed $f"; exit 1; }
done
ls -l "$BACKUP"
```

### 7.3 Copy the 7 runtime files explicitly to root-level destinations

(No `server/` folder is copied wholesale.)

```bash
install -d "$REL/scripts" "$REL/fonts" "$REL/services" "$REL/controllers"

cp -p "$STAGE/server/scripts/install-arabic-fonts.sh"                    "$REL/scripts/install-arabic-fonts.sh"
cp -p "$STAGE/server/fonts/Tajawal-Regular.ttf" \
      "$STAGE/server/fonts/Tajawal-Bold.ttf" \
      "$STAGE/server/fonts/OFL.txt" \
      "$STAGE/server/fonts/90-tajawal-times-new-roman.conf"             "$REL/fonts/"
cp -p "$STAGE/server/services/ppsx-converter.js"                        "$REL/services/ppsx-converter.js"
cp -p "$STAGE/server/controllers/upload.controller.js"                  "$REL/controllers/upload.controller.js"
```

### 7.4 Preflight the new release (no migrations, no DB, no S3)

```bash
cd "$REL"

# (a) required runtime files present
for f in index.js package.json services/ppsx-converter.js controllers/upload.controller.js \
         routes/upload.routes.js prisma/schema.prisma .env; do
  test -e "$f" || { echo "ABORT: missing $f"; exit 1; }
done
test -d node_modules || { echo "ABORT: node_modules missing"; exit 1; }
test -d node_modules/express || { echo "ABORT: express dep missing"; exit 1; }
test -d node_modules/@prisma/client || { echo "ABORT: @prisma/client missing"; exit 1; }

# (b) the shipped files MUST match the verified package hashes EXACTLY.
#     Any mismatch aborts the deploy (sha256sum -c exits non-zero under `set -e`).
sha256sum -c --strict - <<'SUMS' || { echo "ABORT: checksum mismatch"; exit 1; }
3a5e9cc0e1e2c36a838a58b6752555ae9fac78d08aab7497a060558585910d00  services/ppsx-converter.js
5583b830e491c669ea4b8f4538d20df568de529b5371b47db6ab491cbaed6fcb  controllers/upload.controller.js
02baa4315a2bc84fa109b59397bcbc369c98f3f18ee69c7f1e651ba10c1c8a84  scripts/install-arabic-fonts.sh
6882892da3e03527d5db2bbab3b48bde6ef2e878a43f522d1a4eebda90010a19  fonts/Tajawal-Regular.ttf
0342ab6b74b6bd1b4b5bf7beda45a9734a2b3147a31e8a3a45b6a3417a52d9d7  fonts/Tajawal-Bold.ttf
9b584984f9db0ee30347391a76eff9c0a6b03dc450c3c6afe3757a2cb3a4db87  fonts/OFL.txt
45251f26e8660e6fad7b7d228ca7febdf992a26e81e3f1014b3cd7a64bfad3e2  fonts/90-tajawal-times-new-roman.conf
SUMS
#   The staging-package check `sha256sum -c SHA256SUMS` in §6 is still authoritative for
#   transfer integrity; this check confirms the files landed at the right release paths.

# (c) syntax-only parse of the changed files (does not run the server)
node --check services/ppsx-converter.js
node --check controllers/upload.controller.js
node --check index.js

# (d) Prisma schema is valid — schema-ONLY; connects to NO database and runs NO migration
./node_modules/.bin/prisma validate
```

Stop if any step fails. Note `index.js`/`package.json` are ESM (`"type": "module"`) and
`prisma validate` reads `.env` but does **not** connect to the database.

---

## 8. Install the fonts + validate the mapping (BEFORE switching/restarting)

This is a **system-level** step, independent of the app release (§7). Run it and prove the
mapping **before** touching PM2. The installer uses `install -m 0644`, which **overwrites** an
existing conf/font file, so record and back up any pre-existing state first.

```bash
set -euo pipefail
STAMP=<the $STAMP from §7>
FONTLOG=/home/ec2-user/fontfix-before-$STAMP.txt
FONTBACKUP=/home/ec2-user/fontbackup-$STAMP
```

### 8.1 Record the current font state (read-only)

```bash
{
  echo "== fc-match BEFORE ($(date -u)) =="
  echo "root    : $(fc-match 'Times New Roman')"
  echo "ec2-user: $(sudo -u ec2-user fc-match 'Times New Roman')"
  if sudo test -e /etc/fonts/conf.d/90-tajawal-times-new-roman.conf; then
    echo "conf EXISTS:"; sudo ls -l /etc/fonts/conf.d/90-tajawal-times-new-roman.conf
  else echo "conf absent"; fi
  if sudo test -d /usr/share/fonts/truetype/tajawal; then
    echo "fontdir EXISTS:"; sudo ls -l /usr/share/fonts/truetype/tajawal
  else echo "fontdir absent"; fi
} | tee "$FONTLOG"
```

Save `$FONTLOG` — it is the baseline §11B compares against.

### 8.2 Back up any pre-existing config BEFORE installing (never overwrite blind)

```bash
if sudo test -e /etc/fonts/conf.d/90-tajawal-times-new-roman.conf \
   || sudo test -d /usr/share/fonts/truetype/tajawal; then
  sudo mkdir -p "$FONTBACKUP"
  if sudo test -e /etc/fonts/conf.d/90-tajawal-times-new-roman.conf; then
    sudo cp -a /etc/fonts/conf.d/90-tajawal-times-new-roman.conf \
               "$FONTBACKUP/90-tajawal-times-new-roman.conf.orig"
  fi
  if sudo test -d /usr/share/fonts/truetype/tajawal; then
    sudo tar -C /usr/share/fonts/truetype -czf "$FONTBACKUP/tajawal.orig.tgz" tajawal
  fi
  sudo ls -l "$FONTBACKUP"
  echo "PRIOR font config exists -> backed up to $FONTBACKUP (restore in §11B)."
else
  echo "No pre-existing Tajawal config -> the install is wholly additive."
fi
```

If otherwise required, copy `$FONTBACKUP` off-host before proceeding.

### 8.3 Install, then validate for root **and** the service user

```bash
sudo bash "$REL/scripts/install-arabic-fonts.sh"     # exits non-zero if not Tajawal

fc-match "Times New Roman"
sudo -u ec2-user fc-match "Times New Roman"
sudo -u ec2-user fc-match -s "Times New Roman" | head -3
```

Do **not** proceed to §9 until both `fc-match` outputs show **`Tajawal`**.

---

## 9. Switch the release and restart PM2

### 9.0 PM2 preflight (read-only) and decision gate — BEFORE switching

Do **not** assume that the recorded script path causes `pm2 restart` to follow the switched
symlink. Inspect the **actual** stored configuration first; PM2 records either the literal
symlink path **or** a resolved real path depending on how it was started.

```bash
set -euo pipefail
APP=st-mary-backend
CUR=/home/ec2-user/current

# Read-only: dump the stored process config and print the fields that matter.
pm2 jlist > /tmp/pm2-jlist.json
APP="$APP" node -e '
const a=(require("/tmp/pm2-jlist.json").find(p=>p.name===process.env.APP));
if(!a){console.error("ABORT: app not found in pm2 jlist");process.exit(1);}
const e=a.pm2_env||{};
console.log("stored script : "+e.pm_exec_path);
console.log("stored cwd    : "+e.pm_cwd);
console.log("interpreter   : "+e.exec_interpreter);
console.log("status        : "+e.status);
'

# Read-only: the running process's real cwd (authoritative for what is running NOW).
PID=$(pm2 pid "$APP")
echo "pid=$PID"
sudo ls -l "/proc/$PID/cwd" 2>/dev/null || true    # cwd of the live process
readlink -f "$CUR"                                 # symlink target right now
readlink -f "$CUR/index.js"                        # resolved path right now
```

**Decision gate — classify the stored script path (read the `stored script:` line above):**

- **Case A — `stored script` == `/home/ec2-user/current/index.js` (the symlink path, NOT
  resolved to a release).** Node re-resolves the symlink on start, so `pm2 restart` follows the
  swapped symlink. **Proceed to §9.1 → §9.2.**
- **Case B — `stored script` == an absolute path inside a specific release dir**
  (e.g. `/home/ec2-user/releases/<stamp>/index.js`). A restart keeps running **that** release;
  the symlink swap alone will **not** take effect. **STOP here.** Do **not** automatically
  delete/recreate. Recreating the PM2 process (§9.3) changes process identity/restart counters
  and requires **separate, explicit confirmation** and (to persist) `pm2 save`. Get approval,
  then use §9.3.

Record the classification and the `stored script`/`stored cwd` values in the deploy log. If
`pm_exec_path`/`pm_cwd` are empty or unreadable, treat as **Case B** and stop.

### 9.1 Point `current` at the new release (atomic)

```bash
ln -sfn "$REL" "$CUR.new"
mv -T "$CUR.new" "$CUR"        # atomic replace of the symlink
readlink -f "$CUR"             # MUST print $REL
```

### 9.2 Restart (Case A only)

```bash
pm2 restart "$APP" --update-env
pm2 describe "$APP" | grep -Ei 'status|script path|exec cwd|pm_exec_path|uptime|restarts'
```

Confirm the process is `online`, the path/cwd are the `current` symlink forms, uptime reset,
and the restart counter incremented. Then run the **§10 health gate**.

### 9.3 Recovery only: recreate the PM2 process (Case B — requires separate confirmation)

This is a **recovery action, not an automatic fallback.** Do not run it without explicit
sign-off. It deletes and re-creates the process definition.

```bash
# REVIEW FIRST — destructive to the process definition.
pm2 delete "$APP"
pm2 start /home/ec2-user/current/index.js --name "$APP" --cwd /home/ec2-user/current
pm2 save            # persist the new process list (writes ~/.pm2/dump.pm2)
```

The old release `/home/ec2-user/releases/20261007-135433` is untouched throughout (§11A).

---

## 10. Post-deployment checks

```bash
set -euo pipefail
APP=st-mary-backend
HOST=http://<API_HOST_OR_IP>          # public API host; use http://127.0.0.1:${PORT:-8080} to bypass the LB
```

### 10.0 Post-restart health gate (run FIRST, immediately after §9)

Stop and roll back (§11) if any required check fails.

```bash
# (a) PM2 must be online with the new process age
pm2 status "$APP"
pm2 describe "$APP" | grep -Ei 'status|script path|exec cwd|restarts|uptime'

# (b) recent ERROR logs must be clean
pm2 logs "$APP" --lines 100 --error --nostream

# (c) read-only health endpoint (confirmed: GET /health, runs SELECT 1)
curl -fsS "http://127.0.0.1:${PORT:-8080}/health"; echo
#   expect HTTP 200 {"status":"ok","db":"connected"}
```

Pass criteria: PM2 `online`; no new error-log entries referencing a crash/import failure; `/health`
returns **200 ok**. A `503` means the DB check failed — this change does not touch the DB, so
investigate; if it appeared only after the switch, roll back (§11A).

### 10.1 Font mapping (already required in §8)

`fc-match "Times New Roman"` and `sudo -u ec2-user fc-match "Times New Roman"` → **`Tajawal`**.

### 10.2 Logs — expect NO font warning

```bash
pm2 logs "$APP" --lines 100 --nostream | grep -iE 'Tajawal|ppsx' || true
# Good = absence of: Arabic CS font "Times New Roman" resolves to "<...>", not Tajawal
```

### 10.3 Choose a source deck and prove its preview is UNCACHED (read-only)

```bash
# Use the EXACT stored source key (as the app/S3 uses it).
KEY="Hymns/1770593709145-960836706-_.ppsx"
# Must match previewKeyForSource(): sha256(sourceKey).hex.slice(0,32) under previews/, .pdf
CACHEKEY="previews/$(printf '%s' "$KEY" | sha256sum | cut -c1-32).pdf"
echo "source key : $KEY"
echo "cache key  : $CACHEKEY"

# Read-only existence check (head-object). Bucket/region come from the release .env (not printed).
if sudo -u ec2-user bash -lc '
      set -a; . /home/ec2-user/current/.env; set +a
      export AWS_REGION="${AWS_REGION:-$AWS_DEFAULT_REGION}"
      aws s3api head-object --bucket "$AWS_S3_BUCKET" --key "$1"
    ' _ "$CACHEKEY" >/tmp/head.out 2>/tmp/head.err; then
  echo "ALREADY CACHED — pick a different verified-uncached deck and recompute. Do NOT delete it."
elif grep -qiE '404|NoSuchKey|Not Found' /tmp/head.err; then
  echo "UNCACHED — safe to generate (creates only a NEW cache object)."
else
  echo "INCONCLUSIVE — head-object failed for another reason:"; cat /tmp/head.err
  echo "Do NOT generate and do NOT delete anything; investigate first."
fi
```

`head-object` is read-only. Only an explicit **404/NoSuchKey** means "uncached"; a 403 or any
other error is **inconclusive** — stop, don't generate, don't delete. If the key is already
cached, **never delete it**; choose a different deck verified uncached and recompute `CACHEKEY`.

> Note: the preview key has **no** `Uploads/` prefix (`previewKeyForSource` hashes the raw source
> key and prefixes only `previews/`). If your stored source keys actually carry the `S3_KEY_PREFIX`
> (default `Uploads/`), use that exact key as `KEY` so the computed hash matches.

> Scope note: generating a preview for an uncached deck creates **one new** cache object. The
> test never modifies source decks or existing cached previews. If a strictly read-only test is
> required, run LibreOffice on a local copy of the deck instead of calling the API.

### 10.4 Generate and STRICTLY validate the PDF

```bash
curl -fsS --get --data-urlencode "key=$KEY" \
  "$HOST/api/uploads/preview/pdf" -o /tmp/preview.pdf \
  || { echo "FAIL: curl failed (non-2xx/transport)"; exit 1; }

test -s /tmp/preview.pdf || { echo "FAIL: empty/zero-byte PDF"; exit 1; }
file /tmp/preview.pdf | grep -qi 'PDF document' || { echo "FAIL: not a valid PDF"; exit 1; }

pdffonts /tmp/preview.pdf > /tmp/pdffonts.txt || { echo "FAIL: pdffonts failed"; exit 1; }
test -s /tmp/pdffonts.txt || { echo "FAIL: pdffonts returned nothing"; exit 1; }

grep -qi 'Tajawal' /tmp/pdffonts.txt || { echo "FAIL: Tajawal not embedded/used"; exit 1; }
if grep -qi 'Noto' /tmp/pdffonts.txt; then echo "FAIL: Noto still used"; exit 1; fi

echo "PASS(auto): valid non-empty PDF; Tajawal present; no Noto"
```

Success requires **all** of: curl exit 0, non-empty file, valid PDF header, `pdffonts` succeeded
with output, **and** Tajawal present. Absence of Noto alone is **not** sufficient.

### 10.5 Visual inspection of representative Arabic pages (manual sign-off REQUIRED)

Automated font checks are necessary but **not sufficient** — glyph *shaping* is visual.

```bash
pdftoppm -png -r 150 -f <FIRST_ARABIC_PAGE> -l <LAST_ARABIC_PAGE> /tmp/preview.pdf /tmp/page
# open /tmp/page-*.png
# (pdftoppm ships with poppler-utils, same package as pdffonts; fallback: pdftocairo -png ...)
```

Confirm, on at least one Arabic-heavy page: **connected** glyphs (correct initial/medial/final
forms), correct **right-to-left** order, no `.notdef` boxes/squares, and readable text. Record
the reviewer and result. Do **not** mark the deploy verified on automated checks alone.

#### 10.5.1 Recorded result (PASS)

| Field | Value |
|---|---|
| Date of inspection | **2026-10-11** |
| Deck under test | `Hymns/1770576021243-378285480-احكى_يا_تاريخ.ppsx` (the verified-uncached deck generated in §10.4 during the `20261011-085211` deploy) |
| Artifacts reviewed | `preview.pdf` + `page-01.png`, `page-02.png`, `page-03.png` (host `/tmp/`; copied to `%LOCALAPPDATA%\Temp\opencode\deployed\`) |
| Reviewer | User (product owner) |
| **Arabic glyph shaping** | **PASS** — glyphs connected (correct initial/medial/final forms) |
| **RTL direction and word ordering** | **PASS** |
| **Slide clipping** | **PASS** |
| **Layout and spacing** | **PASS** |
| Overall | **PASS — visual sign-off complete** |

> The deck name is taken from the deployment/API logs (the exact source key the preview was
> generated for); it was not assumed.

---

## 11. Rollback

Two independent parts. The old release was preserved, so app rollback is a symlink swap.

### 11A. Application rollback (reliable — old release preserved)
```bash
set -euo pipefail
APP=st-mary-backend
OLD=/home/ec2-user/releases/20261007-135433

test -d "$OLD" || { echo "ABORT: previous release missing"; exit 1; }
ln -sfn "$OLD" /home/ec2-user/current.new
mv -T /home/ec2-user/current.new /home/ec2-user/current
readlink -f /home/ec2-user/current        # MUST print $OLD

pm2 restart "$APP" --update-env
# If §9.0 was Case B (PM2 stored a resolved realpath), restart alone will NOT switch back —
# use the §9.3 recreate procedure after separate confirmation.
```
Alternatively (in-place restore of the two files, without the symlink):
```bash
STAMP=<the $STAMP from §7>
cp -p /home/ec2-user/backups-$STAMP/services_ppsx-converter.js.$STAMP.bak      /home/ec2-user/current/services/ppsx-converter.js
cp -p /home/ec2-user/backups-$STAMP/controllers_upload.controller.js.$STAMP.bak /home/ec2-user/current/controllers/upload.controller.js
pm2 restart "$APP" --update-env
```

### 11B. Restore the system font configuration (separate from app rollback)

Restores what §8.1 recorded: **revert to the backup if §8.2 created one, otherwise remove only
what we added.** Never delete a pre-existing file that has a backup.

```bash
set -euo pipefail
FONTBACKUP=<the $FONTBACKUP from §8.2>

if sudo test -f "$FONTBACKUP/90-tajawal-times-new-roman.conf.orig"; then
  sudo cp -a "$FONTBACKUP/90-tajawal-times-new-roman.conf.orig" \
             /etc/fonts/conf.d/90-tajawal-times-new-roman.conf
else
  sudo rm -f /etc/fonts/conf.d/90-tajawal-times-new-roman.conf
fi

if sudo test -f "$FONTBACKUP/tajawal.orig.tgz"; then
  sudo rm -rf /usr/share/fonts/truetype/tajawal
  sudo tar -C /usr/share/fonts/truetype -xzf "$FONTBACKUP/tajawal.orig.tgz"
else
  sudo rm -rf /usr/share/fonts/truetype/tajawal
fi

sudo fc-cache -f
# Compare against the §8.1 baseline ($FONTLOG) — must reproduce the prior result:
fc-match "Times New Roman"
sudo -u ec2-user fc-match "Times New Roman"
```

### 11C. Verify
```bash
pm2 status "$APP"
pm2 logs "$APP" --lines 50 --nostream
curl -fsS "http://127.0.0.1:${PORT:-8080}/health"; echo   # expect 200 ok
```
Rollback restores/removes only the app code and the system font files (restoring any
pre-existing config via §11B). It never touches S3, cached previews, source decks, the database,
or `.env`.

---

## 12. Remaining risks / open items

1. **PM2 symlink resolution (now gated).** We no longer assume a restart follows the symlink.
   §9.0 inspects the **actual** stored `pm_exec_path`/`pm_cwd` (read-only) and defines a gate:
   Case A (symlink path) → safe restart; Case B (resolved release path) → **stop**; recreating
   the process (§9.3) is a recovery action needing separate confirmation. **Uncertainty:** the
   stored value cannot be read from this Windows workstation; §9.0 must be run on the host.
2. **Release-root contents not independently verified here.** §7.4 preflight confirms `index.js`,
   `package.json`, `routes/`, `prisma/`, `node_modules/`, `.env` exist before switch; if any
   differs, stop and adjust the mapping.
3. **`s3.service.js` dependency.** The hardened ETag match assumes the clone's
   `services/s3.service.js` returns `ETag`/`Last-Modified` (confirmed live). If the active
   release predates that, previews still render but never answer `304`.
4. **Fonts are host-wide.** The alias affects every LibreOffice conversion on the host. §8.1/§8.2
   record the prior state and back up any pre-existing config; §11B restores it. **Uncertainty:**
   whether `/etc/fonts/conf.d/90-tajawal-times-new-roman.conf` or
   `/usr/share/fonts/truetype/tajawal` already exist on the host is unknown until §8.1 runs.
5. **The self-check only logs.** It surfaces a bad mapping; it does not itself fix rendering —
   the installer (§8) is what fixes it.
6. **Disk.** Cloning the release duplicates the app (incl. `node_modules`). ~17 GB is ample for
   a typical Node app; §5 checks `du` vs `df` first.
7. **No DB/S3 impact.** No migrations or schema changes. The only S3 write is the single **new**
   preview object created for a verified-uncached deck by the §10.4 test; source decks and
   existing cached previews are never modified or deleted.
8. **Visual check — DONE (PASS).** The English/Arabic shaping check (§10.5) was performed on
   **2026-10-11** on the §10.4 deck and passed (shaping / RTL / clipping / layout). See §10.5.1.
9. **Controller stream-guard is a behavioral change.** `upload.controller.js` now answers **502**
   (not 404) when the S3 body errors before headers are sent, and **destroys the connection**
   when it errors after. This is covered by the new unit tests and rolled back by §11A (the
   old controller is backed up in §7.2). Client behavior on a genuinely missing cached key
   changes from a double-response crash (invalid/empty body) to a clean **502** (or a dropped
   connection if bytes had started) — the preview simply fails instead of wedging the request.

**Deployed 2026-10-11** (stamp `20261011-085211`). The local package hashes, the installer
font-discovery logic, and the full test suite (228 passed) were verified locally (§3c, §4);
the runbook above was then executed in order on the host, with the §10 health and preview gates
passing. The §10.5 **visual Arabic-shaping sign-off was completed on 2026-10-11 — PASS** (shaping,
RTL/word ordering, clipping, and layout all PASS; see §10.5.1). No further manual item remains.
