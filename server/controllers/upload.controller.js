import sharp from 'sharp';
import defaultS3Service from '../services/s3.service.js';

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
        try {
          const { contentType, contentLength, body } = await s3Service.getObjectForProxy(key);
          res.setHeader('Content-Type', contentType || 'application/octet-stream');
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
        try {
          const { contentType, contentLength, body } = await s3Service.getObjectForProxy(key);
          res.setHeader('Content-Type', contentType);
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
