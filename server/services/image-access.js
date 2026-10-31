// Shared authorization for image objects exposed by the public upload routes.
//
// Image rows store a URL, not an immutable S3 key, so the URL has to be parsed
// with the same canonical logic used by image deletes. A key is an image only
// when it is inside an image-original layout (the current upload path, the
// documented legacy Images/Uploads/Images layouts, or explicitly configured
// legacy prefixes), or when it is a derived thumbnail of such a key.
//
// Derived previews are authorized before any S3 operation:
//
// - New previews carry an explicit ownership namespace (see
//   preview-cache-key.js). Image previews encode their source key, so an exact
//   image lookup is enough; presentation previews are in a separate, deliberately
//   public namespace.
// - Old hash-only previews (previews/, previews-img/) are only public when a
//   File row proves presentation ownership and its fileUrl source hashes to the
//   same preview hash. Otherwise they are unverified legacy caches and are
//   denied. In particular, a deleted image/gallery row can never turn an old
//   image-derived cache into an ordinary public preview.
// - Unknown or malformed keys in any preview namespace fail closed.
import { prisma } from './prisma.js';
import { extractImageS3Key, getImageDeletePrefixes, isAllowedImageKey } from './image-s3-key.js';
import {
  isPreviewCacheNamespaceKey,
  parsePreviewCacheKey,
  previewSourceHash,
} from './preview-cache-key.js';

const THUMBNAIL_KEY_RE = /^thumbnails\/[^/]+\/(.+)$/;
const MAX_THUMBNAIL_UNWRAP = 4;
const UPLOAD_URL_PATH = /\/api\/uploads\/url\/?$/;

function normalizeBasePrefix(env) {
  const raw = typeof env.S3_KEY_PREFIX === 'string'
    ? env.S3_KEY_PREFIX
    : (typeof env.AWS_S3_PREFIX === 'string' ? env.AWS_S3_PREFIX : 'Uploads/');
  if (raw === '') return '';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

// Candidates decide whether a key looks like an image key. The key still has to
// pass the canonical S3-key validation, and the database row remains the final
// ownership authority. Treating a malformed candidate as image-related makes it
// fail closed instead of falling through to the generic public-key path.
function getImageCandidatePrefixes(env) {
  const prefixes = new Set(getImageDeletePrefixes(env));
  const basePrefix = normalizeBasePrefix(env);
  prefixes.add(basePrefix === '' ? 'Images/' : `${basePrefix}Images/`);
  // Also recognize the documented/legacy layouts even when the current base
  // prefix differs. A matching row is still required before anything is served.
  prefixes.add('Images/');
  prefixes.add('Uploads/Images/');
  return [...prefixes];
}

function startsWithAny(value, prefixes) {
  return prefixes.some((prefix) => typeof prefix === 'string' && value.startsWith(prefix));
}

// Direct image key, or a cached thumbnail of one. Thumbnail generation stores
// objects at thumbnails/<width>/<sourceKey>, so a cache request must be
// authorized against the source image before the cache object is touched.
function findImageCandidate(key, prefixes) {
  if (typeof key !== 'string' || key.length === 0) {
    return { sourceKey: null, overNested: false };
  }
  if (startsWithAny(key, prefixes)) return { sourceKey: key, overNested: false };

  let sourceKey = key;
  for (let depth = 0; depth < MAX_THUMBNAIL_UNWRAP; depth += 1) {
    const match = THUMBNAIL_KEY_RE.exec(sourceKey);
    if (!match) return { sourceKey: null, overNested: false };
    sourceKey = match[1];
    if (startsWithAny(sourceKey, prefixes)) return { sourceKey, overNested: false };
  }

  // Do not let an arbitrarily deep thumbnail cache wrapper fall through as a
  // non-image key. If the remaining source is still a thumbnail wrapper, deny
  // rather than treating it as an ordinary public object.
  return {
    sourceKey: null,
    overNested: THUMBNAIL_KEY_RE.test(sourceKey),
  };
}

export function canAccessUnpublishedImage(user) {
  return !!(user && (user.role === 'ADMIN' || user.role === 'EDITOR'));
}

/**
 * Resolve the source image key for an access check.
 *
 * returns { applies, sourceKey }
 * - applies=false: not an image key; preserve the endpoint's existing behavior.
 * - applies=true, sourceKey=null: image-like but malformed/reserved; deny.
 */
export function resolveImageAccessTarget(key, env = process.env) {
  const candidatePrefixes = getImageCandidatePrefixes(env);
  const candidate = findImageCandidate(key, candidatePrefixes);
  if (!candidate.sourceKey) {
    return {
      applies: candidate.overNested,
      sourceKey: null,
    };
  }

  return {
    applies: true,
    sourceKey: isAllowedImageKey(candidate.sourceKey, candidatePrefixes)
      ? candidate.sourceKey
      : null,
  };
}

// Stored imageUrl values are normally /api/uploads/url?key=<encoded>. Include
// raw and encodeURI forms for old rows; exact parsing below remains the final
// authority, so a broad contains match can never authorize a different key.
function getStoredUrlCandidates(key) {
  const values = new Set([key]);
  try {
    values.add(encodeURIComponent(key));
  } catch {
    // A malformed string will simply not match a stored URL.
  }
  try {
    values.add(encodeURI(key));
  } catch {
    // Same as above.
  }

  // Some old values may use lowercase percent escapes. Preserve the case of the
  // actual key characters and only normalize the escape hex.
  for (const value of [...values]) {
    if (value.includes('%')) {
      values.add(value.replace(/%[0-9A-F]{2}/g, (escape) => escape.toLowerCase()));
    }
  }
  return [...values].filter(Boolean);
}

async function findMatchingImages(sourceKey, prismaClient) {
  const urlCandidates = getStoredUrlCandidates(sourceKey);
  const rows = await prismaClient.image.findMany({
    where: {
      OR: urlCandidates.map((value) => ({ imageUrl: { contains: value } })),
    },
    select: { id: true, imageUrl: true, published: true },
  });

  if (!Array.isArray(rows)) {
    throw new Error('Image lookup returned an invalid result');
  }

  // Contains is only a candidate filter. The stored value must resolve through
  // the canonical upload-URL parser to exactly this key.
  return rows.filter((row) => extractImageS3Key(row?.imageUrl) === sourceKey);
}

function extractStoredPreviewKey(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value, 'http://internal.invalid');
    if (!UPLOAD_URL_PATH.test(parsed.pathname)) return null;
    const keys = parsed.searchParams.getAll('key');
    if (keys.length !== 1 || !keys[0]) return null;
    return keys[0];
  } catch {
    return null;
  }
}

function storedPreviewMatches(value, cacheKey) {
  const storedKey = extractStoredPreviewKey(value);
  if (!storedKey) return false;
  if (storedKey === cacheKey) return true;

  // previewImageBaseUrl stores a template: previews-img/<hash>/{n}.webp.
  if (!storedKey.includes('{n}')) return false;
  const [prefix, suffix] = storedKey.split('{n}');
  return cacheKey.startsWith(prefix) && cacheKey.endsWith(suffix);
}

// Old hash-only previews have no ownership metadata. A File row is the only
// remaining proof, and it must point at the same cache key/template *and* at a
// non-image source whose hash produces this preview hash. This avoids treating
// an arbitrary File row (or an image's own source record) as presentation proof.
async function legacyPreviewOwnedByFile(cacheKey, hash, prismaClient, env) {
  const fileModel = prismaClient?.file;
  if (!fileModel || typeof fileModel.findMany !== 'function') {
    throw new Error('File preview lookup unavailable');
  }

  const rows = await fileModel.findMany({
    where: {
      OR: [
        { previewUrl: { contains: hash } },
        { previewImageBaseUrl: { contains: hash } },
      ],
    },
    select: {
      fileUrl: true,
      previewUrl: true,
      previewImageBaseUrl: true,
    },
  });
  if (!Array.isArray(rows)) {
    throw new Error('File preview lookup returned an invalid result');
  }

  return rows.some((row) => {
    const ownsCache = storedPreviewMatches(row?.previewUrl, cacheKey)
      || storedPreviewMatches(row?.previewImageBaseUrl, cacheKey);
    if (!ownsCache) return false;

    const sourceKey = extractStoredPreviewKey(row?.fileUrl);
    if (!sourceKey) return false;
    // A File row whose source is in the image layout is not presentation proof.
    if (resolveImageAccessTarget(sourceKey, env).applies) return false;
    return previewSourceHash(sourceKey) === hash;
  });
}

/**
 * Classify a preview-cache key, including thumbnail wrappers around one.
 *
 * Returns null for a key that is not in a preview namespace, or one of:
 *   { kind: 'image', sourceKey, hash, cacheKey }
 *   { kind: 'file', hash, cacheKey }
 *   { kind: 'legacy', hash, cacheKey }
 *   { kind: 'unknown' | 'over-nested', cacheKey }
 */
export function resolvePreviewCacheTarget(key) {
  if (typeof key !== 'string' || key.length === 0) return null;

  let candidate = key;
  for (let depth = 0; depth <= MAX_THUMBNAIL_UNWRAP; depth += 1) {
    const parsed = parsePreviewCacheKey(candidate);
    if (parsed) return { ...parsed, cacheKey: candidate };

    const thumbnail = THUMBNAIL_KEY_RE.exec(candidate);
    if (!thumbnail) {
      return isPreviewCacheNamespaceKey(candidate)
        ? { kind: 'unknown', cacheKey: candidate }
        : null;
    }
    candidate = thumbnail[1];
  }

  return { kind: 'over-nested', cacheKey: candidate };
}

// Kept for callers that only need the legacy hash. New image slide keys have no
// hash in their path, so this intentionally returns null for them.
export function resolveDerivedPreviewHash(key) {
  const target = resolvePreviewCacheTarget(key);
  return target && target.hash ? target.hash : null;
}

/**
 * Authorize one key against the image table and preview ownership metadata.
 *
 * returns { applies, allowed, published, reason }
 * - applies=false: not an image or preview-cache key; caller may continue.
 * - applies=true, allowed=false: respond 404 and do not touch S3.
 * - applies=true, allowed=true: published=true for public images, or the
 *   request has a verified editor/admin identity for drafts.
 */
export async function authorizeImageAccess(key, {
  user = null,
  prismaClient = prisma,
  env = process.env,
} = {}) {
  const target = resolveImageAccessTarget(key, env);
  if (target.applies) {
    if (!target.sourceKey) {
      return { applies: true, allowed: false, published: null, reason: 'invalid-key' };
    }

    let matches;
    try {
      matches = await findMatchingImages(target.sourceKey, prismaClient);
    } catch (err) {
      // Fail closed. Never fall back to serving the object when ownership cannot
      // be established.
      console.error('Image access database lookup failed:', err?.message || err);
      return { applies: true, allowed: false, published: null, reason: 'db-error' };
    }

    if (matches.length === 0) {
      return { applies: true, allowed: false, published: null, reason: 'not-found' };
    }
    if (matches.length > 1) {
      // The model has no immutable key; duplicate references are ambiguous.
      return { applies: true, allowed: false, published: null, reason: 'ambiguous' };
    }

    const image = matches[0];
    if (!image.published && !canAccessUnpublishedImage(user)) {
      return { applies: true, allowed: false, published: false, reason: 'unpublished' };
    }

    return {
      applies: true,
      allowed: true,
      published: !!image.published,
      imageId: image.id,
      reason: null,
    };
  }

  const preview = resolvePreviewCacheTarget(key);
  if (!preview) {
    return { applies: false, allowed: true, published: null, reason: null };
  }

  if (preview.kind === 'unknown' || preview.kind === 'over-nested') {
    return {
      applies: true,
      allowed: false,
      published: null,
      reason: preview.kind === 'over-nested' ? 'preview-over-nested' : 'preview-unknown',
    };
  }

  // A new presentation preview is generated only for non-image sources and is
  // deliberately public; its namespace cannot alias an image-derived key.
  if (preview.kind === 'file') {
    return { applies: true, allowed: true, published: null, reason: 'presentation-preview' };
  }

  if (preview.kind === 'legacy') {
    let owned;
    try {
      owned = await legacyPreviewOwnedByFile(preview.cacheKey, preview.hash, prismaClient, env);
    } catch (err) {
      // A database outage must not turn an unclassified legacy cache public.
      console.error('Image preview cache database lookup failed:', err?.message || err);
      return { applies: true, allowed: false, published: null, reason: 'preview-db-error' };
    }
    if (!owned) {
      return { applies: true, allowed: false, published: null, reason: 'legacy-unverified' };
    }
    return { applies: true, allowed: true, published: null, reason: 'legacy-presentation-preview' };
  }

  if (preview.kind === 'image') {
    if (!preview.sourceKey) {
      return { applies: true, allowed: false, published: null, reason: 'preview-invalid-source' };
    }

    const prefixes = getImageCandidatePrefixes(env);
    if (!isAllowedImageKey(preview.sourceKey, prefixes)) {
      return { applies: true, allowed: false, published: null, reason: 'preview-invalid-source' };
    }
    if (preview.hash && preview.hash !== previewSourceHash(preview.sourceKey)) {
      return { applies: true, allowed: false, published: null, reason: 'preview-hash-mismatch' };
    }

    let matches;
    try {
      // Exact source lookup; deliberately not an all-image-row scan.
      matches = await findMatchingImages(preview.sourceKey, prismaClient);
    } catch (err) {
      console.error('Image preview cache database lookup failed:', err?.message || err);
      return { applies: true, allowed: false, published: null, reason: 'preview-db-error' };
    }

    if (matches.length === 0) {
      return { applies: true, allowed: false, published: null, reason: 'preview-source-not-found' };
    }
    if (matches.length > 1) {
      return { applies: true, allowed: false, published: null, reason: 'ambiguous' };
    }

    const image = matches[0];
    if (!image.published && !canAccessUnpublishedImage(user)) {
      return { applies: true, allowed: false, published: false, reason: 'unpublished' };
    }
    return {
      applies: true,
      allowed: true,
      published: !!image.published,
      imageId: image.id,
      reason: null,
    };
  }

  return { applies: true, allowed: false, published: null, reason: 'preview-unknown' };
}
