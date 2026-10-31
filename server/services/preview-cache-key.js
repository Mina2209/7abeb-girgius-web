// Preview-cache key layout and classification.
//
// The original preview cache was keyed only by a hash of the source key:
//
//   previews/v2/<hash>.pdf
//   previews-img/<hash>/<n>.webp
//
// That format cannot tell an image-derived preview from an ordinary
// presentation preview once the image row is gone (or its imageUrl changes).
// New previews therefore carry an explicit ownership namespace:
//
//   previews-file/v2/<hash>.pdf              ordinary presentation PDF
//   previews-file-img/v2/<hash>/<n>.webp     ordinary presentation slides
//   previews-image/v2/<source>/<hash>.pdf    image-derived PDF
//   previews-image-img/v2/<source>/<n>.webp  image-derived slides
//
// <source> is the URL-safe base64 encoding of the image source S3 key. It lets
// authorization do an exact image lookup without scanning every image row. The
// file namespace has no source because it is deliberately public presentation
// data and must never alias an image-derived key.
//
// The old previews/ and previews-img/ namespaces remain readable only when a
// File row proves presentation ownership; otherwise they are treated as
// unverified legacy caches and denied.
import { createHash } from 'node:crypto';

export const PREVIEW_FILE_PDF_PREFIX = 'previews-file/';
export const PREVIEW_FILE_IMAGE_PREFIX = 'previews-file-img/';
export const PREVIEW_IMAGE_PDF_PREFIX = 'previews-image/';
export const PREVIEW_IMAGE_IMAGE_PREFIX = 'previews-image-img/';

// Namespaces that need the image-access check before an object is served. This
// intentionally includes the legacy namespaces so malformed/unknown legacy
// keys fail closed instead of falling through as generic public objects.
export const PREVIEW_CACHE_NAMESPACES = [
  'previews/',
  'previews-img/',
  PREVIEW_FILE_PDF_PREFIX,
  PREVIEW_FILE_IMAGE_PREFIX,
  PREVIEW_IMAGE_PDF_PREFIX,
  PREVIEW_IMAGE_IMAGE_PREFIX,
];

const IMAGE_PDF_RE = /^previews-image\/v([^/]+)\/([A-Za-z0-9_-]+)\/([a-f0-9]{32})\.pdf$/;
const IMAGE_SLIDE_RE = /^previews-image-img\/v([^/]+)\/([A-Za-z0-9_-]+)\/[^/]+$/;
const FILE_PDF_RE = /^previews-file\/v([^/]+)\/([a-f0-9]{32})\.pdf$/;
const FILE_SLIDE_RE = /^previews-file-img\/v([^/]+)\/([a-f0-9]{32})\/[^/]+$/;
const LEGACY_PDF_RE = /^previews\/(?:v[^/]+\/)?([a-f0-9]{32})\.pdf$/;
const LEGACY_SLIDE_RE = /^previews-img\/([a-f0-9]{32})\/[^/]+$/;

export function previewSourceHash(sourceKey) {
  return createHash('sha256').update(sourceKey).digest('hex').slice(0, 32);
}

export function encodePreviewSourceKey(sourceKey) {
  return Buffer.from(sourceKey, 'utf8').toString('base64url');
}

export function decodePreviewSourceKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    // Re-encode to reject non-canonical encodings and replacement characters.
    if (!decoded || Buffer.from(decoded, 'utf8').toString('base64url') !== value) return null;
    if (/[\u0000-\u001F\u007F]/.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function isOwnedKind(kind) {
  return kind === 'image' || kind === 'file';
}

export function ownedPreviewKeyForSource(sourceKey, {
  kind = 'file',
  version = '2',
} = {}) {
  if (!isOwnedKind(kind)) throw new Error(`invalid preview ownership kind: ${kind}`);
  const hash = previewSourceHash(sourceKey);
  if (kind === 'image') {
    return `${PREVIEW_IMAGE_PDF_PREFIX}v${version}/${encodePreviewSourceKey(sourceKey)}/${hash}.pdf`;
  }
  return `${PREVIEW_FILE_PDF_PREFIX}v${version}/${hash}.pdf`;
}

export function ownedSlideImagePrefixForSource(sourceKey, {
  kind = 'file',
  version = '2',
} = {}) {
  if (!isOwnedKind(kind)) throw new Error(`invalid preview ownership kind: ${kind}`);
  const hash = previewSourceHash(sourceKey);
  if (kind === 'image') {
    return `${PREVIEW_IMAGE_IMAGE_PREFIX}v${version}/${encodePreviewSourceKey(sourceKey)}/`;
  }
  return `${PREVIEW_FILE_IMAGE_PREFIX}v${version}/${hash}/`;
}

export function isPreviewCacheNamespaceKey(key) {
  if (typeof key !== 'string') return false;
  return PREVIEW_CACHE_NAMESPACES.some((prefix) => key.startsWith(prefix));
}

/**
 * Parse a preview-cache object key without unwrapping thumbnails.
 *
 * Returns one of:
 *   { kind: 'image', sourceKey, hash, version, cacheKey }  new image preview
 *   { kind: 'file', hash, version, cacheKey }              new presentation preview
 *   { kind: 'legacy', hash, cacheKey }                     old hash-only preview
 *   null                                                   not a preview cache key
 *
 * A new image key with an undecodable source still returns kind:'image' with
 * sourceKey:null so authorization fails closed rather than treating it as an
 * ordinary public key.
 */
export function parsePreviewCacheKey(key) {
  if (typeof key !== 'string' || key.length === 0) return null;

  let match = IMAGE_PDF_RE.exec(key);
  if (match) {
    return {
      kind: 'image',
      version: match[1],
      sourceKey: decodePreviewSourceKey(match[2]),
      hash: match[3],
      cacheKey: key,
    };
  }

  match = IMAGE_SLIDE_RE.exec(key);
  if (match) {
    return {
      kind: 'image',
      version: match[1],
      sourceKey: decodePreviewSourceKey(match[2]),
      hash: null,
      cacheKey: key,
    };
  }

  match = FILE_PDF_RE.exec(key);
  if (match) {
    return {
      kind: 'file',
      version: match[1],
      hash: match[2],
      cacheKey: key,
    };
  }

  match = FILE_SLIDE_RE.exec(key);
  if (match) {
    return {
      kind: 'file',
      version: match[1],
      hash: match[2],
      cacheKey: key,
    };
  }

  match = LEGACY_PDF_RE.exec(key);
  if (match) {
    return { kind: 'legacy', hash: match[1], cacheKey: key };
  }

  match = LEGACY_SLIDE_RE.exec(key);
  if (match) {
    return { kind: 'legacy', hash: match[1], cacheKey: key };
  }

  return null;
}
