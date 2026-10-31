// Image-specific S3 key authorization for deletes.
//
// The image record only stores a URL, not an immutable S3 key. That URL is
// editable by editors, so it must never be treated as proof that an arbitrary
// object belongs to the image. Deletes are therefore restricted to the exact
// prefix the current client upload path writes to:
//
//   client contentWriteService -> presignAndUpload(..., 'Images')
//   upload controller          -> folderMap['Images'] || 'Images'
//   s3 service                 -> buildKeyPrefix(folder)
//
// `S3_FOLDER_MAP.image` is not the source of truth for this path. It is only
// accepted as a consistency assertion when it resolves to the same image
// folder. `S3_ALLOWED_FOLDERS` is a general upload allowlist and is deliberately
// not used to expand or shrink the image delete scope.
//
// Legacy layouts are never added automatically. They must be listed explicitly
// in S3_LEGACY_IMAGE_PREFIXES (empty by default), and may not be a parent of the
// current prefix.
const IMAGE_UPLOAD_FOLDER = 'Images';
const DEFAULT_BASE_PREFIX = 'Uploads/';
const UPLOAD_URL_PATH = /\/api\/uploads\/url\/?$/;

// These are app-managed namespaces, never image originals.
const RESERVED_FOLDER_SEGMENTS = new Set([
  'backups',
  'previews',
  'previews-img',
  'previews-file',
  'previews-file-img',
  'previews-image',
  'previews-image-img',
  'thumbnails',
]);

function readFolderMap(value) {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeBasePrefix(value) {
  if (typeof value !== 'string') return DEFAULT_BASE_PREFIX;
  return value === '' ? '' : (value.endsWith('/') ? value : `${value}/`);
}

function getBasePrefix(env) {
  const raw = typeof env.S3_KEY_PREFIX === 'string'
    ? env.S3_KEY_PREFIX
    : (typeof env.AWS_S3_PREFIX === 'string' ? env.AWS_S3_PREFIX : DEFAULT_BASE_PREFIX);
  return normalizeBasePrefix(raw);
}

function stripFolderMarkers(folder) {
  return String(folder).replace(/^[/!]+|\/+$/g, '');
}

function isSafePrefix(prefix) {
  if (typeof prefix !== 'string' || !prefix.endsWith('/')) return false;
  if (Buffer.byteLength(prefix, 'utf8') > 1024) return false;
  if (/[\u0000-\u001F\u007F]/.test(prefix)) return false;

  const segments = prefix.split('/');
  segments.pop(); // trailing empty segment
  if (segments.length === 0) return false;
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return false;
  }
  return !segments.some((segment) => RESERVED_FOLDER_SEGMENTS.has(segment.toLowerCase()));
}

function isValidS3Key(key) {
  if (typeof key !== 'string' || key.length === 0) return false;
  if (Buffer.byteLength(key, 'utf8') > 1024) return false;
  if (/[\u0000-\u001F\u007F]/.test(key)) return false;

  const segments = key.split('/');
  // S3 keys are opaque, but rejecting dot segments makes crafted traversal
  // URLs fail closed instead of relying on S3's literal key interpretation.
  if (segments.some((segment) => segment === '.' || segment === '..')) return false;
  // Never delete anything under a reserved app namespace, even when a crafted
  // image key contains one of those names below the image prefix.
  if (segments.some((segment) => RESERVED_FOLDER_SEGMENTS.has(segment.toLowerCase()))) {
    return false;
  }
  return true;
}

// Resolve the folder the current image upload path actually uses. The client
// sends the literal "Images"; the upload controller then applies the mapping
// entry for that literal key. A mapping that redirects it elsewhere, or an
// S3_FOLDER_MAP.image value that claims another folder, is a configuration
// conflict and must fail closed.
function getActualImageUpload(env) {
  const folderMap = readFolderMap(env.S3_FOLDER_MAP);
  if (!folderMap) return null;

  const mappedRaw = folderMap[IMAGE_UPLOAD_FOLDER] || IMAGE_UPLOAD_FOLDER;
  if (typeof mappedRaw !== 'string') return null;

  const absolute = mappedRaw.startsWith('/') || mappedRaw.startsWith('!');
  const folder = stripFolderMarkers(mappedRaw);
  if (folder !== IMAGE_UPLOAD_FOLDER) return null;

  if (Object.prototype.hasOwnProperty.call(folderMap, 'image')) {
    const imageMapping = folderMap.image;
    if (typeof imageMapping !== 'string') return null;
    // S3_FOLDER_MAP.image is not used by the current client upload path, but if
    // it points somewhere else the configuration is contradictory.
    if (stripFolderMarkers(imageMapping.trim()) !== IMAGE_UPLOAD_FOLDER) return null;
  }

  return { folder, absolute };
}

function getLegacyImagePrefixes(value, currentPrefix) {
  if (value === undefined || value === null || value === '') return [];
  if (typeof value !== 'string') return null;

  const entries = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) return [];

  const prefixes = [];
  for (const entry of entries) {
    const prefix = entry.endsWith('/') ? entry : `${entry}/`;
    if (!isSafePrefix(prefix)) return null;

    // Legacy entries are image prefixes only. This prevents a broad app folder
    // such as Hymns/ or PowerPoints/ from becoming an image delete scope.
    const segments = prefix.split('/').filter(Boolean);
    if (segments[segments.length - 1] !== IMAGE_UPLOAD_FOLDER) return null;

    // A legacy parent would reach objects outside the current image folder.
    // Fail the whole configuration closed rather than silently preferring one.
    if (prefix !== currentPrefix && currentPrefix.startsWith(prefix)) return null;

    // Equal or narrower legacy prefixes are already covered by currentPrefix.
    if (prefix === currentPrefix || prefix.startsWith(currentPrefix)) continue;

    prefixes.push(prefix);
  }

  return prefixes;
}

// Build the exact prefixes under which image originals may be deleted.
//
// The current prefix is derived from the real upload path (Images) plus the
// current S3_KEY_PREFIX/AWS_S3_PREFIX, never from S3_FOLDER_MAP.image or the
// general S3_ALLOWED_FOLDERS list. Historical prefixes are opt-in only.
export function getImageDeletePrefixes(env = process.env) {
  const actualImageUpload = getActualImageUpload(env);
  if (!actualImageUpload) return [];

  const basePrefix = getBasePrefix(env);
  const currentPrefix = actualImageUpload.absolute
    ? `${actualImageUpload.folder}/`
    : (basePrefix === '' ? `${actualImageUpload.folder}/` : `${basePrefix}${actualImageUpload.folder}/`);

  if (!isSafePrefix(currentPrefix)) return [];

  const legacyPrefixes = getLegacyImagePrefixes(env.S3_LEGACY_IMAGE_PREFIXES, currentPrefix);
  if (legacyPrefixes === null) return [];

  return [currentPrefix, ...legacyPrefixes];
}

// Extract the key from a stored `/api/uploads/url?key=...` URL. Raw keys, other
// upload endpoints, malformed URLs, duplicate key parameters and traversal
// attempts are rejected rather than guessed at.
export function extractImageS3Key(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.trim()) return null;

  let parsed;
  try {
    parsed = new URL(imageUrl, 'http://internal.invalid');
  } catch {
    return null;
  }

  if (!UPLOAD_URL_PATH.test(parsed.pathname)) return null;

  const keys = parsed.searchParams.getAll('key');
  if (keys.length !== 1) return null;

  const key = keys[0];
  return isValidS3Key(key) ? key : null;
}

export function isAllowedImageKey(key, prefixes) {
  if (!isValidS3Key(key) || !Array.isArray(prefixes) || prefixes.length === 0) return false;
  return prefixes.some((prefix) => (
    typeof prefix === 'string'
    && prefix.endsWith('/')
    && key.length > prefix.length
    && key.startsWith(prefix)
  ));
}

// Return the key only when it came from the expected upload URL shape and sits
// inside the image delete scope. Null means: do not touch S3.
export function resolveImageDeleteKey(imageUrl, env = process.env) {
  const key = extractImageS3Key(imageUrl);
  if (!key) return null;
  return isAllowedImageKey(key, getImageDeletePrefixes(env)) ? key : null;
}
