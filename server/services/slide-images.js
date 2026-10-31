// Per-slide WebP previews for PowerPoint/PPSX uploads.
//
// The PDF preview (services/ppsx-converter.js) is produced by LibreOffice (plus
// the clip-guard repair pass) and is the render the app trusts — it is what the
// browser's native PDF viewer displays correctly, including Arabic with
// diacritics. The embedded viewer cannot use that render directly though: it is
// shipped as a PDF, and the in-app PDF.js canvas renderer mis-positions Arabic
// "char + tanween" clusters in these decks (the text overlaps).
//
// So this module rasterises the *already-stored* preview PDF to one PNG per
// slide with Poppler's pdftoppm — the same engine that was verified to match the
// reference render — re-encodes each to WebP with sharp (already a dependency;
// pdftoppm builds are not universally compiled with WebP output), and uploads
// them under a new S3 prefix. The viewer displays those images and never touches
// PDF.js, so it cannot reintroduce the Arabic overlap. The PDF stays in place:
// the viewer links to it as a safe fallback whenever the image set is missing.
//
// Everything here is best-effort: if poppler's pdftoppm is absent the caller
// gets `null` and the app behaves exactly as it did before, PDF-link-only.
//
// The legacy image key is derived from the source key hash alone, so it matches
// the pre-existing `previews-img/<hash>/<n>.webp` layout used by the File-row
// pipeline. New on-demand/admin previews pass an ownership kind and use the
// matching `previews-file-img/...` or `previews-image-img/...` namespace (see
// preview-cache-key.js). The images are rendered from whatever preview PDF is
// stored *at render time*; a future pipeline-version bump must re-render the
// sets for the affected decks so the images track the new PDF bytes.

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import defaultS3Service from './s3.service.js';
import {
  PREVIEW_PIPELINE_VERSION,
  previewKeyForOwnedSource,
  previewKeyForSource,
} from './ppsx-converter.js';
import { uploadUrlFor } from './storage-urls.js';
import { ownedSlideImagePrefixForSource } from './preview-cache-key.js';

const execFileAsync = promisify(execFile);

const IMAGE_WIDTH = 1600;
// WebP quality for the slide images. 82 matches the fitlib pipeline this
// replaced and keeps text crisp while staying far smaller than PNG.
const WEBP_QUALITY = 82;
// pdftoppm over a 13-page 16:9 deck takes seconds; 5 minutes is a huge bound
// that only a pathological PDF could hit.
const RENDER_TIMEOUT_MS = 5 * 60_000;
const RENDER_MAX_BUFFER = 8 * 1024 * 1024;
// Guard against pathological PDF page sizes producing absurd DPI (and huge
// bitmaps): slides are ~10-13in wide, so 72-300dpi covers everything sane.
const DPI_MIN = 72;
const DPI_MAX = 300;
const DPI_FALLBACK = 150;

/** Hash of the source key — must match previewKeyForSource() in ppsx-converter.js. */
function hashOf(sourceKey) {
  return createHash('sha256').update(sourceKey).digest('hex').slice(0, 32);
}

/**
 * S3 prefix holding the numbered WebPs of one deck.
 *
 * With no options this preserves the legacy previews-img/ layout used by the
 * File-row pipeline. New on-demand/admin previews pass { kind: 'image' | 'file' }
 * so the cache carries the same ownership namespace as its PDF.
 */
export function slideImagePrefixForSource(sourceKey, {
  kind = null,
  version = PREVIEW_PIPELINE_VERSION,
} = {}) {
  if (kind === 'image' || kind === 'file') {
    return ownedSlideImagePrefixForSource(sourceKey, { kind, version });
  }
  return `previews-img/${hashOf(sourceKey)}/`;
}

export function slideImageKeyForSource(sourceKey, page, options = {}) {
  return `${slideImagePrefixForSource(sourceKey, options)}${page}.webp`;
}

/**
 * URL template stored on the File row. "{n}" is the 1-based slide number and is
 * substituted by the client, which keeps the row at one URL no matter how many
 * slides the deck has.
 */
export function slideImageTemplateForSource(sourceKey, options = {}) {
  return `${uploadUrlFor(slideImagePrefixForSource(sourceKey, options))}{n}.webp`;
}

/**
 * Completion marker for a deck's image set. It is uploaded LAST, after every
 * slide, so its presence is the only reliable proof the set is complete. The
 * per-slide keys keep their `<n>.webp` shape — this is a sibling object, never
 * requested by the client (which only ever asks for `{n}.webp`).
 *
 * Without it, an interrupted render (a crash or an S3 error part-way through the
 * slide loop) would leave slide 1 behind and be mistaken for a finished set
 * forever, because peek() could not tell "complete" from "one slide written".
 *
 * It carries the page count so a cache hit can report it without re-reading the
 * PDF.
 */
export function slideImageMarkerKeyForSource(sourceKey, options = {}) {
  return `${slideImagePrefixForSource(sourceKey, options)}complete.json`;
}

// The toolchain probe is cached for the process lifetime: it shells out twice,
// and a missing pdftoppm must not be re-probed on every request.
let toolchainPromise;
export function slideImageToolchain() {
  if (!toolchainPromise) {
    toolchainPromise = (async () => {
      try {
        await execFileAsync('pdftoppm', ['-v'], { timeout: 15_000 });
        await execFileAsync('pdfinfo', ['-v'], { timeout: 15_000 });
        return { available: true };
      } catch (error) {
        console.warn(
          '[slide-images] poppler unavailable, previews stay PDF-link-only:',
          error?.message || error,
        );
        return { available: false };
      }
    })();
  }
  return toolchainPromise;
}

/**
 * Parse pdfinfo's "Page size:" line into { widthPt, heightPt }.
 * Accepts points and inches ("Page size: 960 x 540 pts", "13.33 x 7.5 ins").
 */
function parsePdfInfoPageSize(stdout) {
  const match = String(stdout || '').match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+(pts|ins)/im);
  if (!match) return null;
  const inches = match[3] === 'ins';
  return {
    widthPt: Number(match[1]) * (inches ? 72 : 1),
    heightPt: Number(match[2]) * (inches ? 72 : 1),
  };
}

/**
 * DPI that renders the slide at `width` pixels. Falls back to DPI_FALLBACK for
 * any page whose geometry cannot be read or is degenerate.
 */
function dpiForWidth(widthPt, width) {
  if (!widthPt || widthPt <= 0) return DPI_FALLBACK;
  const dpi = Math.round((width * 72) / widthPt);
  return Math.min(DPI_MAX, Math.max(DPI_MIN, dpi));
}

export function createSlideImageGenerator({
  s3Service,
  execute = execFileAsync,
  probe = slideImageToolchain,
  width = IMAGE_WIDTH,
  // PNG -> WebP encoder. Injected so tests stay hermetic; production uses sharp,
  // which is already a hard dependency (the thumbnail path uses it).
  encodeWebp = (buffer) => sharp(buffer).webp({ quality: WEBP_QUALITY }).toBuffer(),
} = {}) {
  if (!s3Service) throw new Error('createSlideImageGenerator requires an s3Service');

  /**
   * Has this deck already been rendered to a *complete* set? The completion
   * marker is written only after every slide is in S3, so a partial upload from
   * an interrupted render has no marker and is re-rendered (each render
   * overwrites the same keys, so recovery is idempotent).
   */
  async function peek(sourceKey, options = {}) {
    const status = await probe();
    if (!status.available) return null;
    const markerKey = slideImageMarkerKeyForSource(sourceKey, options);
    if (!(await s3Service.objectExists(markerKey))) return null;

    let pages = null;
    try {
      const marker = JSON.parse((await s3Service.getObjectBuffer(markerKey)).toString('utf8'));
      if (Number.isInteger(marker?.pages) && marker.pages > 0) {
        pages = marker.pages;
      } else {
        // Invalid marker content - do not treat as complete
        return null;
      }
    } catch {
      // Marker present but unreadable/invalid - do not treat as complete
      return null;
    }
    return { template: slideImageTemplateForSource(sourceKey, options), pages };
  }

  /**
   * Render one WebP per slide of a deck's stored preview PDF and upload them.
   * Returns { template, pages, secs } or null when the toolchain is missing;
   * throws on a real render failure so the caller can log it.
   */
  async function render(sourceKey, options = {}) {
    const status = await probe();
    if (!status.available) return null;

    const prefix = slideImagePrefixForSource(sourceKey, options);
    const previewKey = options.kind === 'image' || options.kind === 'file'
      ? previewKeyForOwnedSource(sourceKey, options)
      : previewKeyForSource(sourceKey);
    const workDir = await mkdtemp(join(tmpdir(), 'ppsx-slides-'));
    const startedAt = Date.now();
    try {
      const pdf = await s3Service.getObjectBuffer(previewKey);
      const pdfPath = join(workDir, 'preview.pdf');
      await writeFile(pdfPath, pdf, { mode: 0o600 });

      // Page count and page geometry come from pdfinfo; a missing pdfinfo only
      // costs us the exact-width DPI and the count pre-check, not the render.
      let pages = null;
      let dpi = DPI_FALLBACK;
      try {
        const { stdout } = await execute('pdfinfo', [pdfPath], {
          timeout: 20_000,
          maxBuffer: RENDER_MAX_BUFFER,
        });
        const size = parsePdfInfoPageSize(stdout);
        if (size) dpi = dpiForWidth(size.widthPt, width);
        const pagesMatch = String(stdout || '').match(/^Pages:\s+(\d+)/im);
        if (pagesMatch) pages = Number(pagesMatch[1]);
      } catch (error) {
        console.warn(`[slide-images] pdfinfo failed for ${sourceKey}:`, error?.message || error);
      }

      const outPrefix = join(workDir, 'slide');
      // -png: every pdftoppm build supports it (WebP output is optional and
      // absent from some builds). sharp then encodes each frame to WebP.
      const args = ['-png', '-r', String(dpi), '-f', '1'];
      if (pages) args.push('-l', String(pages));
      args.push(pdfPath, outPrefix);
      await execute('pdftoppm', args, {
        timeout: RENDER_TIMEOUT_MS,
        maxBuffer: RENDER_MAX_BUFFER,
      });

      const images = (await readdir(workDir))
        .filter((name) => /^slide-(\d+)\.png$/.test(name))
        .map((name) => ({
          page: Number(name.match(/^slide-(\d+)\.png$/)[1]),
          name,
        }))
        .sort((a, b) => a.page - b.page);

      // A short set would leave the viewer 404-ing on the last slides, so treat
      // it as a failure rather than half-migrating the deck.
      if (pages !== null && images.length !== pages) {
        throw new Error(
          `page mismatch: pdfinfo reported ${pages}, pdftoppm rendered ${images.length}`,
        );
      }
      if (!images.length) {
        throw new Error('pdftoppm rendered no pages');
      }

      const body = await Promise.all(
        images.map((image) => readFile(join(workDir, image.name)).then(encodeWebp)),
      );
      for (const [index, buffer] of body.entries()) {
        await s3Service.putObjectBuffer(prefix + `${images[index].page}.webp`, buffer, 'image/webp', {
          CacheControl: 'public, max-age=31536000, immutable',
        });
      }
      // Completion marker, written strictly after the slide loop: a throw above
      // (or a crash) must leave the set without it, so the next request knows the
      // set is partial and re-renders.
      await s3Service.putObjectBuffer(
        slideImageMarkerKeyForSource(sourceKey, options),
        Buffer.from(JSON.stringify({ pages: images.length })),
        'application/json',
        { CacheControl: 'public, max-age=3600' },
      );
      return {
        template: slideImageTemplateForSource(sourceKey, options),
        pages: images.length,
        secs: Math.round((Date.now() - startedAt) / 100) / 10,
      };
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // One render per source key at a time: concurrent first-time viewers of the
  // same deck would otherwise run two pdftoppm passes against the same keys.
  const inFlight = new Map();
  const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

  function lockKeyForSource(sourceKey, options = {}) {
    const prefix = slideImagePrefixForSource(sourceKey, options);
    return `${prefix}.render.lock`;
  }

  function createLockToken() {
    return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function acquireLock(sourceKey, options = {}) {
    if (typeof s3Service.putObjectIfNoneMatch !== 'function') {
      throw new Error('slide-images: conditional put not supported by storage backend; cross-process locking unavailable');
    }
    const lockKey = lockKeyForSource(sourceKey, options);
    const token = createLockToken();
    try {
      const acquired = await s3Service.putObjectIfNoneMatch(
        lockKey,
        Buffer.from(JSON.stringify({ pid: process.pid, token, ts: Date.now() })),
        'application/json',
        { CacheControl: 'no-store' }
      );
      if (acquired) return { acquired: true, lockKey, token };
      // Cannot safely take over stale lock without atomic compare-and-delete or conditional delete
      // Fail closed to avoid race conditions
      return { acquired: false, lockKey, token: null };
    } catch (err) {
      if (err?.name === 'NotImplemented' || err?.$metadata?.httpStatusCode === 501) {
        throw new Error('slide-images: conditional put not supported by storage backend; cross-process locking unavailable');
      }
      throw err;
    }
  }

  async function releaseLock(lockKey, token) {
    if (!lockKey || !token) return;
    try {
      // Try to delete only if we can verify ownership; cannot do atomic compare-and-delete with standard S3
      if (typeof s3Service.getObjectBuffer === 'function') {
        try {
          const data = await s3Service.getObjectBuffer(lockKey);
          const lock = JSON.parse(data.toString('utf8'));
          if (lock?.token === token) {
            if (typeof s3Service.deleteObject === 'function') {
              try {
                await s3Service.deleteObject(lockKey);
              } catch {}
            }
          }
        } catch {
          // If can't read, don't delete
        }
      }
    } catch {}
  }

  async function generate(sourceKey, options = {}) {
    const runKey = `${options.kind || 'legacy'}:${sourceKey}`;
    const running = inFlight.get(runKey);
    if (running) return running;
    const task = (async () => {
      const existing = await peek(sourceKey, options);
      if (existing) return existing;
      let lock = await acquireLock(sourceKey, options);
      if (!lock.acquired) {
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 500));
          const done = await peek(sourceKey, options);
          if (done) return done;
        }
        // Still cannot acquire - fail closed
        throw new Error('slide-images: lock held by another process; cannot safely proceed without proven ownership');
      }
      try {
        const existing2 = await peek(sourceKey, options);
        if (existing2) return existing2;
        const result = await render(sourceKey, options);
        return result;
      } finally {
        if (lock.acquired && lock.token) {
          await releaseLock(lock.lockKey, lock.token);
        }
      }
    })().finally(() => inFlight.delete(runKey));
    inFlight.set(runKey, task);
    return task;
  }

  /** Reuse the uploaded set when present, otherwise render it. */
  async function ensure(sourceKey, options = {}) {
    const existing = await peek(sourceKey, options);
    if (existing) return existing;
    return generate(sourceKey, options);
  }

  return { peek, generate, ensure };
}

const defaultGenerator = createSlideImageGenerator({ s3Service: defaultS3Service });

export const slideImagePeek = (sourceKey, options) => defaultGenerator.peek(sourceKey, options);
export const generateSlideImages = (sourceKey, options) => defaultGenerator.generate(sourceKey, options);
export const ensureSlideImages = (sourceKey, options) => defaultGenerator.ensure(sourceKey, options);