import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Sanitize filename for S3 keys - use ASCII-safe characters
// S3 presigned URLs can have issues with Unicode in keys
function sanitizeFilename(name) {
  // For S3 key safety, replace non-ASCII and problematic characters
  // This ensures the presigned URL signing works correctly
  return name
    .replace(/[^\x20-\x7E]/g, '_')     // Replace non-ASCII chars with underscore
    .replace(/[\/\\:*?"<>|]/g, '_')    // Replace problematic chars with underscore
    .replace(/^[\s.]+|[\s.]+$/g, '')   // Trim spaces and dots from ends
    .replace(/\s+/g, '_')              // Replace spaces with underscores
    .replace(/_+/g, '_');              // Collapse multiple underscores
}

// Extract the original filename from an S3 key
// Keys are formatted as: prefix/timestamp-random-originalFilename
function extractOriginalFilename(key) {
  if (!key) return null;
  // Get the last part after the final slash (the actual filename part)
  const parts = key.split('/');
  const filename = parts[parts.length - 1];
  // The format is: timestamp-random-originalFilename
  // We need to remove the first two segments (timestamp and random number)
  const match = filename.match(/^\d+-\d+-(.+)$/);
  if (match && match[1]) {
    return match[1];
  }
  // Fallback to the full filename if pattern doesn't match
  return filename;
}

// Factory to create an S3 service instance configured with region, bucket and prefix
function createS3Service({ region, bucket, prefix = 'Uploads/' } = {}) {
  if (!bucket) {
    console.warn('AWS_S3_BUCKET is not set. S3 operations will fail without it.');
  }

  const s3 = new S3Client({ region });

  // Allow an explicit empty string to mean "no base prefix". If `prefix` is undefined use default.
  const rawPrefix = (typeof prefix === 'string') ? prefix : 'Uploads/';
  const S3_KEY_PREFIX = rawPrefix === '' ? '' : (rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`);

  function buildKeyPrefix(folder) {
    if (!folder) return S3_KEY_PREFIX;
    // strip leading/trailing slashes from folder and append to base prefix
    const raw = String(folder);
    // If folder starts with '/' or a '!' marker treat as absolute (do not prepend base prefix)
    if (raw.startsWith('/') || raw.startsWith('!')) {
      const cleaned = raw.replace(/^[/!]+|\/+$/g, '');
      return `${cleaned}/`;
    }
    const cleaned = raw.replace(/^\/+|\/+$/g, '');
    return `${S3_KEY_PREFIX}${cleaned}/`;
  }

  return {
    async getPresignedPutUrl({ filename, contentType, folder, expiresIn = 900 } = {}) {
      const prefix = buildKeyPrefix(folder);
      const key = `${prefix}${Date.now()}-${Math.round(Math.random() * 1e9)}-${sanitizeFilename(filename)}`;
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
      const url = await getSignedUrl(s3, command, { expiresIn });
      return { url, key, expiresIn };
    },

    async getPresignedGetUrl(key, expiresIn = 900, originalFilename = null, { forceDownload = true } = {}) {
      // If no original filename provided, try to extract it from the key
      const downloadFilename = originalFilename || extractOriginalFilename(key);

      const commandOptions = { Bucket: bucket, Key: key };

      // Set Content-Disposition: attachment forces a download (good for the download button).
      // When forceDownload is false (preview mode), skip this so the Office viewer can render
      // the file inline in the iframe.
      if (downloadFilename && forceDownload) {
        // Encode filename for Content-Disposition header (handles Unicode)
        const encodedFilename = encodeURIComponent(downloadFilename).replace(/'/g, '%27');
        // Use both filename (ASCII fallback) and filename* (UTF-8) for compatibility
        commandOptions.ResponseContentDisposition = `attachment; filename="${downloadFilename.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${encodedFilename}`;
      }

      const command = new GetObjectCommand(commandOptions);
      const url = await getSignedUrl(s3, command, { expiresIn });
      return url;
    },

    async deleteObject(key) {
      const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
      return s3.send(command);
    },

    // Read an object's raw bytes (used for server-side thumbnail generation).
    async getObjectBuffer(key) {
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return Buffer.from(await res.Body.transformToByteArray());
    },

    // Open an object as a Node Readable stream (used to stream files into a zip without
    // buffering them in memory). The caller is responsible for consuming/destroying it.
    async getObjectStream(key) {
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return res.Body; // Node.js Readable in a server runtime
    },

    // Fetch an object and return metadata + stream for proxying responses.
    // Returns { contentType, contentLength, body } where body is a Node Readable.
    async getObjectForProxy(key) {
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return {
        contentType: res.ContentType || 'application/octet-stream',
        contentLength: res.ContentLength || null,
        body: res.Body,
      };
    },

    // Write bytes to a key (used to cache generated thumbnails).
    async putObjectBuffer(key, body, contentType) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    },

    // True if the object exists, false otherwise (used to serve cached thumbnails).
    async objectExists(key) {
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch {
        return false;
      }
    },

    async createMultipartUpload({ filename, contentType, folder } = {}) {
      const prefix = buildKeyPrefix(folder);
      const key = `${prefix}${Date.now()}-${Math.round(Math.random() * 1e9)}-${sanitizeFilename(filename)}`;
      const command = new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType });
      const res = await s3.send(command);
      return { key, uploadId: res.UploadId };
    },

    async getPresignedUploadPartUrl({ key, uploadId, partNumber, expiresIn = 3600 }) {
      const command = new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber });
      const url = await getSignedUrl(s3, command, { expiresIn });
      return url;
    },

    async completeMultipartUpload({ key, uploadId, parts }) {
      const command = new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts }
      });
      return s3.send(command);
    },

    async abortMultipartUpload({ key, uploadId }) {
      const command = new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId });
      return s3.send(command);
    }
  };
}

// default instance configured from environment variables for backwards compatibility
const region = process.env.AWS_REGION;
const bucket = process.env.AWS_S3_BUCKET;
// Respect an explicitly set empty prefix. Use nullish coalescing so empty string is preserved.
const prefixEnv = process.env.S3_KEY_PREFIX ?? process.env.AWS_S3_PREFIX;
const prefixToUse = (typeof prefixEnv === 'string') ? prefixEnv : 'Uploads/';

const defaultService = createS3Service({ region, bucket, prefix: prefixToUse });

export default defaultService;
