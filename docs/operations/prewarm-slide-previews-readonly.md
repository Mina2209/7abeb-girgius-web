# Prewarm Slide Previews - Read-Only Inspection Runbook

This document is for **read-only inspection only**. No Production operations, no `--apply`, no generation, no modifications are performed by following this document.

## 1) Access Prerequisites

- **Existing authorized session only**: You must have an existing, authorized server/session that you are already permitted to use. The repository does **not** provision credentials, private keys, or permissions.
- **Read-only DB access**: Ability to inspect a single `File` record (by ID) in read-only mode only. No updates, inserts, deletes, or migrations.
- **Read-only S3 access**: Ability to check object existence for specific keys only (no `put`, `delete`, `sync`, or listing of unrelated objects).
- **No secrets documented**: Never document credentials, connection strings, environment variables, bucket names, profiles, regions, or private key paths in this repo. Those are operator prerequisites. No AWS profile/DB connection assumptions are made here.

## 2) Prisma Schema (Confirmed Fields)

From `server/prisma/schema.prisma` (relevant):
- `model File { id String @id @default(uuid()), hymnId String, type FileType, fileUrl String, originalName String?, previewImageBaseUrl String?, ... }`
- `enum FileType { VIDEO_MONTAGE, VIDEO_POWERPOINT, POWERPOINT, MUSIC_AUDIO }`

Supported PowerPoint types for this workflow: `POWERPOINT`, `VIDEO_POWERPOINT`. Supported extensions checked by script: `.ppsx,.pptx,.ppt,.pps,.pptm,.ppsm,.potx,.potm,.odp` (see `server/scripts/prewarm-slide-previews.js` `isPowerPointFile()`).

## 3) Single-Record Selection

- **Prefer explicit File ID**: Use a verified `File.id` (UUID) supplied by an authorized operator. Do **not** perform unbounded exports.
- **Narrow query only if provided by DB admin**: If no explicit ID is available, an operator must obtain a read-only query from the database administrator that returns **exactly one** record matching `type IN ('POWERPOINT','VIDEO_POWERPOINT')`. The repository does not provide a ready-to-run SQL/Prisma command here because DB connection details are not documented.
- **Validate fields**: Confirm `fileUrl` exists and is a supported PowerPoint by extension/name.

## 4) Exact Key Verification (Use Project Code)

Reference these functions (do **not** reimplement algorithms):
- PDF keys: `server/services/ppsx-converter.js` - `previewKeyForSource(sourceKey, version)` (legacy) and `previewKeyForOwnedSource(sourceKey, { kind, version })` (owned). `PREVIEW_PIPELINE_VERSION = '2'`.
- PDF key routing used by slide rendering: `server/services/slide-images.js` lines ~204-206 - uses owned key if `options.kind === 'image' | 'file'`, else legacy.
- Slide image prefix/marker: `server/services/slide-images.js` - `slideImagePrefixForSource(sourceKey, { kind, version })`, `slideImageMarkerKeyForSource(sourceKey, options)` returns `${prefix}complete.json`. For owned kinds uses `ownedSlideImagePrefixForSource()` from `server/services/preview-cache-key.js`.
- Marker validation: valid only if marker JSON has integer `pages > 0` (`server/services/slide-images.js` peek/check logic).
- Source key extraction: derive from `fileUrl` query param `key` (pattern used in `server/scripts/prewarm-slide-previews.js` `keyFromFileUrl()`).

**Rules:**
- Determine namespace/kind by checking which PDF exists (legacy/`file`/`image`). **If more than one exists → ambiguous → STOP (do not guess).**
- If no PDF exists in any namespace → **STOP** (script does not create PDFs).
- If valid `complete.json` exists → **STOP** (already ready).

## 5) Read-Only Object Checks

The repository's deploy docs reference S3/CloudFront but do **not** document a canonical read-only object-existence command for this inspection. 

- **Operator prerequisite (not a ready command)**: If the environment supports a verified read-only mechanism, the operator must confirm the exact mechanism with their administrator using their existing authorized tools. **Do not** assume AWS CLI profile, bucket, region, or credentials here. No command is provided in this document because it is not verifiably standardized in the repo.
- **What to verify** (if possible): existence of the exact `<PDF_KEY>` for the determined namespace and existence/validity of `<MARKER_KEY>`. Do not list buckets/objects broadly. No writes/deletes/overwrites.
- **If unverifiable**: Treat as a prerequisite and do not proceed until confirmed. This is an operator responsibility, not a documented procedure.

## 6) Toolchain and Dry-Run

### Toolchain (read-only command)
```bash
command -v pdftoppm pdfinfo || which pdftoppm pdfinfo
pdftoppm -v 2>&1 | head -1
pdfinfo -v 2>&1 | head -1
```
If missing → **STOP**. These are standard POSIX checks if the binaries are in PATH.

### Dry-run (read-only, only after verification)
From the server repo directory, using the **exactly verified** ID:
```bash
cd server
node scripts/prewarm-slide-previews.js --dry-run --file-id <VERIFIED_FILE_ID> --verbose
```
- Uses `--file-id` to target exactly one record (no broad scan). See `server/scripts/prewarm-slide-previews.js`.
- Dry-run is default behavior and does **not** call image generation or write to S3/DB.
- Must report the exact verified ID, source key, kind/namespace.
- Script will skip safely on ambiguity/missing/unsupported/invalid marker. No generation or writes occur.

## 7) Stop Conditions and Safety

**STOP if:**
- No existing authorized read-only session
- Cannot obtain/read the single record safely
- File type/extension not supported
- Source key cannot be extracted
- PDF namespace ambiguous or missing
- Valid `complete.json` exists
- Keys cannot be verified against project functions
- Toolchain missing
- Cannot rule out concurrent preview generation (**`inFlight` in `slide-images.js` is process-local only; no cross-process lock exists**)
- Any uncertainty about read-only permissions

**Safety notes:**
- `PREWARM_ALLOW_CROSS_PROCESS=1` is **only a bypass gate, not a distributed/process lock** - never used for dry-run. The presence of existing objects alone does not guarantee no other process is generating.
- `--apply` must never follow automatically; requires separate explicit approval.
- No database records or source PDFs are created/modified by this workflow (read-only inspection).
- Writes (if ever applied) are only derived slide images and `complete.json` written last (marker written after uploads).
- This document is documentation-only; no Production operations were performed. All commands marked as read-only must be used as such.
