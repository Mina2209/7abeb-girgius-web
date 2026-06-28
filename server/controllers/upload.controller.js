import sharp from 'sharp';
import defaultS3Service from '../services/s3.service.js';

// Controller factory that accepts an S3 service instance (for easier testing/DI)
export function createUploadController(s3Service = defaultS3Service) {
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

    // Redirect to a presigned GET URL so frontend can download via a stable API URL
    // query: ?key=objectKey&name=optionalRealFilename
    // `name` lets the client force the real (e.g. Arabic) download filename via the S3
    // Content-Disposition header, since the S3 key itself is ASCII-sanitized. The file is
    // never proxied through this server — we only sign a URL and redirect to S3.
      url: async (req, res) => {
        const { key, name } = req.query;
        if (!key) return res.status(400).send('key required');
        const url = await s3Service.getPresignedGetUrl(key, 900, name || null);
        // redirect browser to S3 presigned URL
        return res.redirect(url);
      },

    // Serve a resized thumbnail for a stored image (generated once, then cached in S3).
    // query: ?key=objectKey&w=400 — the full-size original is never modified.
      thumb: async (req, res) => {
        const { key } = req.query;
        if (!key) return res.status(400).send('key required');
        const width = Math.min(1600, Math.max(50, parseInt(req.query.w) || 400));
        const thumbKey = `thumbnails/${width}/${key}`;
        try {
          if (!(await s3Service.objectExists(thumbKey))) {
            const original = await s3Service.getObjectBuffer(key);
            const resized = await sharp(original)
              .rotate() // honor EXIF orientation
              .resize({ width, withoutEnlargement: true })
              .jpeg({ quality: 80 })
              .toBuffer();
            await s3Service.putObjectBuffer(thumbKey, resized, 'image/jpeg');
          }
          return res.redirect(await s3Service.getPresignedGetUrl(thumbKey));
        } catch (err) {
          // On any failure, fall back to the original so the grid still renders.
          console.error('thumbnail error for', key, '-', err.message);
          try {
            return res.redirect(await s3Service.getPresignedGetUrl(key));
          } catch {
            return res.status(404).send('not found');
          }
        }
      },

    // Delete an object from S3. Accepts key in URL param or body.
    // Protected by auth middleware at the route level.
      remove: async (req, res) => {
        const key = req.params.key || req.body?.key;
        if (!key) return res.status(400).json({ error: 'key required' });
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
        return res.json(result);
      },

      presignPart: async (req, res) => {
        const { key, uploadId, partNumber } = req.body || {};
        if (!key || !uploadId || !partNumber) return res.status(400).json({ error: 'key, uploadId and partNumber required' });
        const url = await s3Service.getPresignedUploadPartUrl({ key, uploadId, partNumber });
        return res.json({ url });
      },

      completeMultipart: async (req, res) => {
        const { key, uploadId, parts } = req.body || {};
        if (!key || !uploadId || !parts) return res.status(400).json({ error: 'key, uploadId and parts required' });
        const result = await s3Service.completeMultipartUpload({ key, uploadId, parts });
        return res.json(result);
      },

      abortMultipart: async (req, res) => {
        const { key, uploadId } = req.body || {};
        if (!key || !uploadId) return res.status(400).json({ error: 'key and uploadId required' });
        const result = await s3Service.abortMultipartUpload({ key, uploadId });
        return res.json(result);
      }
  };
}

// default controller using the default S3 service instance
export const UploadController = createUploadController(defaultS3Service);

export default UploadController;
