import sharp from 'sharp';
import defaultS3Service from '../services/s3.service.js';
import { ensurePreviewPdf, generatePreviewForKey, isPreviewableKey } from '../services/ppsx-converter.js';

// Verify an S3 key is within a public-readable prefix. All prefixes must end with '/'
// to prevent segment-collision (e.g. 'HymnsEvil/' must not match prefix 'Hymns/').
// When prefixes is empty, all keys are allowed (legacy fallback when no folder map is set).
export function isReadableKey(key, prefixes) {
  if (!key || typeof key !== 'string') return false;
  if (!prefixes || !prefixes.length) return true;
  return prefixes.some((prefix) => key.startsWith(prefix));
}

// Verify an S3 key is within a writable prefix (for deletion/mutation).
// Unlike isReadableKey, this REJECTS keys when no prefixes are configured
// to prevent accidental deletion of arbitrary S3 objects.
export function isWritableKey(key, prefixes) {
  if (!key || typeof key !== 'string') return false;
  if (!prefixes || !prefixes.length) return false;
  return prefixes.some((prefix) => key.startsWith(prefix));
}

// True when an If-None-Match header value matches the given S3 ETag. Handles a
// list of candidates and the weak "W/" prefix; "*" matches anything. The
// comparison ignores the surrounding quotes too, so a client (or proxy) that
// sends the entity-tag with or without quotes still revalidates to a 304
// instead of re-downloading the whole PDF.
function etagMatches(header, etag) {
  if (!header || !etag) return false;
  if (header.trim() === '*') return true;
  const normalize = (value) => value.trim().replace(/^W\//i, '').replace(/^"|"$/g, '');
  const target = normalize(etag);
  return header.split(',').some((candidate) => normalize(candidate) === target);
}

// Attach a single error handler to an S3 body stream before it is piped to the
// response, so a failure that surfaces *after* the first bytes (and therefore the
// headers) are flushed tears the connection down instead of answering a second
// time. A naive `catch → res.status(...).send(...)` threw ERR_HTTP_HEADERS_SENT
// ("Cannot set headers after they are sent") in production when a cached preview
// key went missing mid-stream. Exported so the guard can be unit-tested directly.
export function guardBodyStream(res, body, onError) {
  if (!body || typeof body.once !== 'function') return;
  body.once('error', (err) => {
    if (typeof onError === 'function') onError(err);
    if (res.headersSent) res.destroy(err);
    else res.status(502).json({ error: 'preview stream failed' });
  });
  // Client hung up: stop pulling bytes we can no longer deliver.
  res.once('close', () => {
    if (typeof body.destroy === 'function') body.destroy();
  });
}

// Controller factory that accepts an S3 service instance (for easier testing/DI)
function createUploadController(s3Service = defaultS3Service) {
  // Load optional folder/type mapping and allowlist from environment
  // S3_FOLDER_MAP should be a JSON string like: {"hymn":"Hymns","image":"Images"}
  let folderMap = {};
  try {
    if (process.env.S3_FOLDER_MAP) folderMap = JSON.parse(process.env.S3_FOLDER_MAP);
  } catch (e) {
    console.warn('Invalid S3_FOLDER_MAP environment variable, expected JSON. Ignoring.');
    folderMap = {};
  }

  const allowedFolders = process.env.S3_ALLOWED_FOLDERS
    ? process.env.S3_ALLOWED_FOLDERS.split(',').map(s => s.trim()).filter(Boolean)
    : null;

  // Public read prefixes: the set of S3 key prefixes that may be signed without auth.
  // Derived from S3_FOLDER_MAP values + thumbnails/ (for on-demand resize cache).
  // All values are normalized to end with '/' so that prefix matching is segment-safe:
  // 'Hymns/' will not match 'HymnsEvil/secret.mp3'.
  const PUBLIC_READ_PREFIXES = [
    ...Object.values(folderMap).map((v) => (v.endsWith('/') ? v : `${v}/`)),
    'thumbnails/',
    'previews/',
    // Per-slide WebP previews (services/slide-images.js). A separate prefix from
    // 'previews/' so the PDF and the image set can never collide, and so the image
    // objects can be retired independently.
    'previews-img/',
  ].filter(Boolean);

  // Writable prefixes: the set of S3 key prefixes that editors may delete/mutate.
  // Includes all public-read prefixes plus a base Uploads/ prefix for uploaded content.
  // Keys outside these prefixes (e.g. backups/, other apps' data) cannot be deleted.
  const basePrefix = (typeof process.env.S3_KEY_PREFIX === 'string') ? process.env.S3_KEY_PREFIX
    : (typeof process.env.AWS_S3_PREFIX === 'string') ? process.env.AWS_S3_PREFIX
    : 'Uploads/';
  const normalizedBasePrefix = basePrefix === '' ? '' : (basePrefix.endsWith('/') ? basePrefix : `${basePrefix}/`);
  const WRITABLE_PREFIXES = [
    ...PUBLIC_READ_PREFIXES,
    normalizedBasePrefix || 'Uploads/',
  ].filter(Boolean);

  // Track initiated multipart uploads to prevent arbitrary key injection.
  // Maps uploadId -> { key, createdAt }
  const initiatedUploads = new Map();
  const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Cleanup expired uploads periodically
  setInterval(() => {
    const now = Date.now();
    for (const [uploadId, data] of initiatedUploads) {
      if (now - data.createdAt > UPLOAD_TTL_MS) {
        initiatedUploads.delete(uploadId);
      }
    }
  }, 60 * 60 * 1000); // Check hourly

  function resolveFolder(req) {
    const body = req.body || {};
    const query = req.query || {};
    const raw = body.folder || query.folder || body.type || query.type || null;
    if (!raw) return null;
    // if mapping exists, map the raw type to folder name
    const mapped = folderMap[raw] || raw;
    // If allowlist is set, enforce it
    if (allowedFolders && !allowedFolders.includes(mapped)) return null;
    return mapped;
  }

  // Normalize an HTTP Range header to a value S3 accepts (single byte range only:
  // "bytes=start-end", "bytes=start-", or "bytes=-end"). Returns the raw header or
  // null when absent / unsupported (multi-range gets the full object).
  function parseByteRangeHeader(header) {
    if (typeof header !== 'string') return null;
    const trimmed = header.trim();
    return /^bytes=\d*-\d*$/.test(trimmed) ? trimmed : null;
  }

  return {
    // Request a presigned PUT URL for uploading directly to S3
    // body: { filename, contentType }
      presign: async (req, res) => {
        const { filename, contentType } = req.body || {};
        if (!filename || !contentType) return res.status(400).json({ error: 'filename and contentType required' });
        const folder = resolveFolder(req);
        if ((req.body?.folder || req.body?.type) && !folder) {
          return res.status(400).json({ error: 'invalid or disallowed folder/type' });
        }
        const result = await s3Service.getPresignedPutUrl({ filename, contentType, folder });
        return res.json(result);
      },

    // Stream a file directly from S3 through this server.
    // query: ?key=objectKey&name=optionalRealFilename
    // Streams the file directly to avoid cross-origin redirect issues (CORB).
      url: async (req, res) => {
        const { key, name } = req.query;
        if (!key) return res.status(400).send('key required');
        if (!isReadableKey(key, PUBLIC_READ_PREFIXES)) return res.status(403).json({ error: 'access denied' });
        const range = parseByteRangeHeader(req.headers.range);
        try {
          const { contentType, contentLength, contentRange, body } = await s3Service.getObjectForProxy(key, range);
          res.setHeader('Content-Type', contentType || 'application/octet-stream');
          res.setHeader('Accept-Ranges', 'bytes');
          if (contentRange) {
            res.status(206);
            res.setHeader('Content-Range', contentRange);
          }
          if (contentLength) res.setHeader('Content-Length', contentLength);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          if (name) {
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`);
          }
          if (body && typeof body.pipe === 'function') {
            body.pipe(res);
          } else if (body && typeof body.transformToByteArray === 'function') {
            const buf = await body.transformToByteArray();
            res.end(Buffer.from(buf));
          } else {
            res.status(404).send('not found');
          }
        } catch (err) {
          console.error('url proxy error for', key, '-', err.message);
          return res.status(404).send('not found');
        }
      },

    // Return a direct presigned GET URL as JSON (no redirect).
    // Used by the Office Online viewer iframe which cannot follow server-side redirects.
    // Uses inline disposition so the viewer can render the file instead of downloading it.
      preview: async (req, res) => {
        const { key } = req.query;
        if (!key) return res.status(400).json({ error: 'key required' });
        if (!isReadableKey(key, PUBLIC_READ_PREFIXES)) return res.status(403).json({ error: 'access denied' });
        const url = await s3Service.getPresignedGetUrl(key, 3600, null, { forceDownload: false });
        return res.json({ url });
      },

    // Stream a file directly from S3 through this server.
    // Used by the Office Online viewer iframe which may not be able to access
    // presigned S3 URLs directly (CORS / network restrictions).
    // The response is served with Content-Disposition: inline so the viewer can
    // render the file rather than triggering a download.
      proxy: async (req, res) => {
        const { key } = req.query;
        if (!key) return res.status(400).json({ error: 'key required' });
        if (!isReadableKey(key, PUBLIC_READ_PREFIXES)) return res.status(403).json({ error: 'access denied' });
        const range = parseByteRangeHeader(req.headers.range);
        try {
          const { contentType, contentLength, contentRange, body } = await s3Service.getObjectForProxy(key, range);
          res.setHeader('Content-Type', contentType);
          res.setHeader('Accept-Ranges', 'bytes');
          if (contentRange) {
            res.status(206);
            res.setHeader('Content-Range', contentRange);
          }
          if (contentLength) res.setHeader('Content-Length', contentLength);
          res.setHeader('Content-Disposition', 'inline');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          if (body && typeof body.pipe === 'function') {
            body.pipe(res);
          } else if (body && typeof body.transformToByteArray === 'function') {
            const buf = await body.transformToByteArray();
            res.end(Buffer.from(buf));
          } else {
            res.status(404).json({ error: 'could not read file' });
          }
        } catch (err) {
          console.error('proxy error for key', key, '-', err.message);
          return res.status(404).json({ error: 'file not found' });
        }
      },

    // Serves a target for the Microsoft Office Online viewer (view.officeapps.live.com).
    // The viewer decides the file type from the URL *path extension*, so the streamed
    // URL must end with a recognised extension — a bare /proxy?key= endpoint never
    // renders. Here the :filename path segment is cosmetic; the real S3 object is
    // addressed via ?key=. Content-Type is forced to pptx so both .pptx and .ppsx
    // streams (identical OOXML presentation format) open regardless of their extension.
      office: async (req, res) => {
        const { key } = req.query;
        if (!key) return res.status(400).json({ error: 'key required' });
        if (!isReadableKey(key, PUBLIC_READ_PREFIXES)) return res.status(403).json({ error: 'access denied' });
        try {
          const { contentLength, body } = await s3Service.getObjectForProxy(key);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
          if (contentLength) res.setHeader('Content-Length', contentLength);
          res.setHeader('Content-Disposition', 'inline; filename="presentation.pptx"');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          if (body && typeof body.pipe === 'function') {
            body.pipe(res);
          } else if (body && typeof body.transformToByteArray === 'function') {
            const buf = await body.transformToByteArray();
            res.end(Buffer.from(buf));
          } else {
            res.status(404).json({ error: 'could not read file' });
          }
        } catch (err) {
          console.error('office proxy error for key', key, '-', err.message);
          return res.status(404).json({ error: 'file not found' });
        }
      },

    // Serve a resized thumbnail for a stored image (generated once, then cached in S3).
    // query: ?key=objectKey&w=400 — the full-size original is never modified.
    // Streams the image directly to avoid cross-origin redirect issues (CORB).
      thumb: async (req, res) => {
        const { key } = req.query;
        if (!key) return res.status(400).send('key required');
        if (!isReadableKey(key, PUBLIC_READ_PREFIXES)) return res.status(403).json({ error: 'access denied' });
        const width = Math.min(1600, Math.max(50, parseInt(req.query.w) || 400));
        const thumbKey = `thumbnails/${width}/${key}`;
        try {
          if (!(await s3Service.objectExists(thumbKey))) {
            if (!(await s3Service.objectExists(key))) {
              return res.status(404).send('original not found');
            }
            const original = await s3Service.getObjectBuffer(key);
            const resized = await sharp(original)
              .rotate() // honor EXIF orientation
              .resize({ width, withoutEnlargement: true })
              .jpeg({ quality: 80 })
              .toBuffer();
            await s3Service.putObjectBuffer(thumbKey, resized, 'image/jpeg');
          }
          const { contentType, contentLength, body } = await s3Service.getObjectForProxy(thumbKey);
          res.setHeader('Content-Type', contentType || 'image/jpeg');
          if (contentLength) res.setHeader('Content-Length', contentLength);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          if (body && typeof body.pipe === 'function') {
            body.pipe(res);
          } else if (body && typeof body.transformToByteArray === 'function') {
            const buf = await body.transformToByteArray();
            res.end(Buffer.from(buf));
          } else {
            res.status(404).send('not found');
          }
        } catch (err) {
          console.error('thumbnail error for', key, '-', err.message);
          return res.status(404).send('not found');
        }
      },

    // Delete an object from S3. Accepts key in URL param or body.
    // Protected by auth middleware at the route level.
    // Key must be within WRITABLE_PREFIXES to prevent deletion of unrelated objects.
      remove: async (req, res) => {
        const key = req.params.key || req.body?.key;
        if (!key) return res.status(400).json({ error: 'key required' });
        if (!isWritableKey(key, WRITABLE_PREFIXES)) {
          return res.status(403).json({ error: 'access denied' });
        }
        await s3Service.deleteObject(key);
        return res.json({ success: true });
      },

    // Generate (or reuse) a cached PDF preview for an uploaded presentation.
    // Protected by auth middleware at the route level.
    // body: { key } — key must be within a readable prefix.
      generatePreview: async (req, res) => {
        const key = typeof req.body?.key === 'string' ? String(req.body.key).trim() : '';
        if (!key) return res.status(400).json({ error: 'key required' });
        if (!isReadableKey(key, PUBLIC_READ_PREFIXES)) return res.status(403).json({ error: 'access denied' });
        try {
          const result = await generatePreviewForKey(key);
          return res.json(result);
        } catch (err) {
          if (err?.code === 'UNSUPPORTED_TYPE') {
            return res.status(400).json({ error: 'unsupported file type for preview' });
          }
          if (err?.code === 'CONVERTER_UNAVAILABLE') {
            return res.status(503).json({ error: 'preview converter unavailable' });
          }
          console.error('preview generation error for key', key, '-', err?.message || err);
          return res.status(502).json({ error: 'preview generation failed' });
        }
      },

    // Stream the PDF preview for a presentation, converting it on first request.
    // Public (no auth) so any visitor can preview a hymn: the source key must
    // still be inside a public-read prefix, and the conversion result is cached in
    // S3 under a key derived from the source key, so only the first viewer of a
    // given presentation pays the LibreOffice cost.
    // query: ?key=<presentationObjectKey>
      previewPdf: async (req, res) => {
        const { key } = req.query;
        if (!key) return res.status(400).json({ error: 'key required' });
        if (!isReadableKey(key, PUBLIC_READ_PREFIXES)) return res.status(403).json({ error: 'access denied' });
        if (!isPreviewableKey(key)) return res.status(415).json({ error: 'unsupported file type for preview' });

        let previewKey;
        try {
          ({ previewKey } = await ensurePreviewPdf(key));
        } catch (err) {
          if (err?.code === 'CONVERTER_UNAVAILABLE') {
            // Deployment problem (no LibreOffice), not a bad request. Distinguish it
            // so the client can say so instead of showing a generic failure.
            return res.status(503).json({ error: 'preview converter unavailable' });
          }
          console.error('preview conversion error for key', key, '-', err?.message || err);
          return res.status(502).json({ error: 'preview generation failed' });
        }

        const range = parseByteRangeHeader(req.headers.range);
        try {
          const { contentLength, contentRange, etag, lastModified, body } = await s3Service.getObjectForProxy(previewKey, range);

          // The preview key is derived from the source upload key, but its *bytes*
          // are mutable: re-running the conversion (e.g. the Arabic-font fix) rewrites
          // the same object. `immutable` therefore lied to every browser — a client
          // that had the old PDF cached kept it for a full day even for a URL whose
          // content had changed. Store it, but require revalidation, and expose the
          // S3 ETag/Last-Modified so unchanged clients get a cheap 304 instead of the
          // whole PDF (and no re-conversion).
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          if (etag) res.setHeader('ETag', etag);
          if (lastModified) res.setHeader('Last-Modified', new Date(lastModified).toUTCString());

          // Only full responses are conditionally revalidated; a Range request must
          // still answer with 206 partial content.
          if (!range && etagMatches(req.headers['if-none-match'], etag)) {
            if (body && typeof body.destroy === 'function') body.destroy();
            return res.status(304).end();
          }

          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Accept-Ranges', 'bytes');
          if (contentRange) {
            res.status(206);
            res.setHeader('Content-Range', contentRange);
          }
          if (contentLength) res.setHeader('Content-Length', contentLength);
          if (body && typeof body.pipe === 'function') {
            // The S3 body is a Node stream: a failure can surface asynchronously
            // AFTER the first bytes (and therefore the headers) are on the wire.
            // Guard it so the outer catch never answers a second time — that threw
            // ERR_HTTP_HEADERS_SENT on a missing cached preview key in production.
            guardBodyStream(res, body, (streamErr) => {
              console.error('preview stream error for key', previewKey, '-', streamErr?.message || streamErr);
            });
            body.pipe(res);
          } else if (body && typeof body.transformToByteArray === 'function') {
            const buf = await body.transformToByteArray();
            res.end(Buffer.from(buf));
          } else {
            res.status(404).send('not found');
          }
        } catch (err) {
          console.error('preview stream error for key', previewKey, '-', err.message);
          // Headers may already be flushed (a body.pipe() that had started):
          // answering again would throw ERR_HTTP_HEADERS_SENT. Drop the connection.
          if (res.headersSent) return res.destroy(err);
          return res.status(404).send('not found');
        }
      },

    // Multipart endpoints
      initiateMultipart: async (req, res) => {
        const { filename, contentType } = req.body || {};
        if (!filename || !contentType) return res.status(400).json({ error: 'filename and contentType required' });
        const folder = resolveFolder(req);
        if ((req.body?.folder || req.body?.type) && !folder) {
          return res.status(400).json({ error: 'invalid or disallowed folder/type' });
        }
        const result = await s3Service.createMultipartUpload({ filename, contentType, folder });
        // Track this upload to prevent arbitrary key injection in subsequent requests
        initiatedUploads.set(result.uploadId, { key: result.key, createdAt: Date.now() });
        return res.json(result);
      },

      presignPart: async (req, res) => {
        const { key, uploadId, partNumber } = req.body || {};
        if (!key || !uploadId || !partNumber) return res.status(400).json({ error: 'key, uploadId and partNumber required' });
        // Validate that this upload was initiated by this server
        const tracked = initiatedUploads.get(uploadId);
        if (!tracked || tracked.key !== key) {
          return res.status(403).json({ error: 'invalid uploadId or key mismatch' });
        }
        const url = await s3Service.getPresignedUploadPartUrl({ key, uploadId, partNumber });
        return res.json({ url });
      },

      completeMultipart: async (req, res) => {
        const { key, uploadId, parts } = req.body || {};
        if (!key || !uploadId || !parts) return res.status(400).json({ error: 'key, uploadId and parts required' });
        // Validate that this upload was initiated by this server
        const tracked = initiatedUploads.get(uploadId);
        if (!tracked || tracked.key !== key) {
          return res.status(403).json({ error: 'invalid uploadId or key mismatch' });
        }
        const result = await s3Service.completeMultipartUpload({ key, uploadId, parts });
        // Clean up tracking after successful completion
        initiatedUploads.delete(uploadId);
        return res.json(result);
      },

      abortMultipart: async (req, res) => {
        const { key, uploadId } = req.body || {};
        if (!key || !uploadId) return res.status(400).json({ error: 'key and uploadId required' });
        // Validate that this upload was initiated by this server
        const tracked = initiatedUploads.get(uploadId);
        if (!tracked || tracked.key !== key) {
          return res.status(403).json({ error: 'invalid uploadId or key mismatch' });
        }
        const result = await s3Service.abortMultipartUpload({ key, uploadId });
        // Clean up tracking after abort
        initiatedUploads.delete(uploadId);
        return res.json(result);
      }
  };
}

// default controller using the default S3 service instance
export const UploadController = createUploadController(defaultS3Service);

export default UploadController;
