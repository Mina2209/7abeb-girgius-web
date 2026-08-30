import { apiGetJson } from './apiClient';
import { getApiBaseUrl } from '../config/api';

const FILE_CONTENT_TYPES: Record<string, string> = {
  'Video montage': 'video/mp4',
  'Video PowerPoint': 'video/mp4',
  'PowerPoint file':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'Music': 'audio/mpeg',
  VIDEO_MONTAGE: 'video/mp4',
  VIDEO_POWERPOINT: 'video/mp4',
  POWERPOINT:
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  MUSIC_AUDIO: 'audio/mpeg',
};

const FILE_FOLDERS: Record<string, string> = {
  'Video montage': 'Hymns',
  'Video PowerPoint': 'Hymns',
  'PowerPoint file': 'Hymns',
  'Music': 'Hymns',
};

export function getFileContentType(fileType: string): string {
  return FILE_CONTENT_TYPES[fileType] || 'application/octet-stream';
}

export function getFileFolder(fileType: string): string {
  return FILE_FOLDERS[fileType] || 'Hymns';
}

export interface UploadResult {
  url: string;
  key: string;
}

export async function presignAndUpload(
  file: File,
  contentType: string,
  folder: string,
): Promise<UploadResult> {
  const { url, key } = await apiGetJson<{ url: string; key: string }>(
    '/api/uploads/presign',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType, folder }),
    },
  );

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`S3 upload failed with status ${putRes.status}`);
  }

  return { url: `/api/uploads/url?key=${encodeURIComponent(key)}`, key };
}

export async function uploadFileToS3(
  file: File,
  fileType: string,
): Promise<string | null> {
  try {
    // Prefer the browser-detected MIME type (handles .ppsx, .ppt, etc.)
    // Fall back to our hardcoded mapping for server-side file type strings.
    const contentType = file.type || getFileContentType(fileType);
    const folder = getFileFolder(fileType);
    const result = await presignAndUpload(file, contentType, folder);
    return result.url;
  } catch {
    return null;
  }
}

/**
 * Resolve a stored file URL (e.g. `/api/uploads/url?key=...`) to a server-proxied
 * URL suitable for embedding in the Office Online viewer iframe.
 *
 * The Office viewer fetches the file from Microsoft's servers, which cannot access
 * S3 presigned URLs directly (CORS / network restrictions). By pointing the viewer
 * at our own server's proxy endpoint, the server fetches from S3 and streams the
 * file back to Microsoft's viewer — avoiding all CORS issues.
 *
 * The returned URL is absolute so Microsoft's servers can resolve it.
 */
/**
 * Resolve a stored file URL to the app's own streaming endpoint so the browser can
 * fetch the raw file bytes (used by the in-app PowerPoint renderer).
 *
 * Unlike `getPreviewUrl`, this always points at the app's API base (same environment
 * the app itself talks to), never at an external host — so it works on localhost
 * during development and avoids any CORS surprises.
 */
export async function getDocumentFetchUrl(storedUrl: string): Promise<string> {
  try {
    const u = new URL(storedUrl, window.location.origin);
    const key = u.searchParams.get('key');
    if (!key) return storedUrl;
    const origin = getApiBaseUrl() || window.location.origin;
    return `${origin}/api/uploads/url?key=${encodeURIComponent(key)}`;
  } catch {
    return storedUrl;
  }
}

function isPublicHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return !(
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '0.0.0.0' ||
    h.endsWith('.local') ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

/**
 * Resolve a stored file URL (e.g. `/api/uploads/url?key=...`) to a URL Microsoft's
 * Office Online viewer can open.
 *
 * The Office viewer (view.officeapps.live.com) fetches the document from Microsoft's
 * servers, so two things must be true:
 *   1. The URL must be publicly reachable (Microsoft cannot access `localhost`).
 *      We prefer the host of the stored absolute URL when it is public, otherwise we
 *      fall back to the configured API base.
 *   2. The URL path must end with a recognised document extension (.pptx / .ppsx / ...).
 *      The viewer refuses URLs without one, so we build a path like
 *      `/api/uploads/office/<name>.pptx?key=<s3Key>` and force `.pptx` — .ppsx is the
 *      same OOXML presentation format, so it renders identically in the viewer.
 */
export async function getPreviewUrl(storedUrl: string): Promise<string> {
  try {
    const u = new URL(storedUrl, window.location.origin);
    const key = u.searchParams.get('key');
    if (!key) return storedUrl;

    const apiBase = getApiBaseUrl();
    let origin = '';
    if (/^https?:$/.test(u.protocol) && u.hostname && isPublicHost(u.hostname)) {
      origin = u.origin;
    } else {
      origin = apiBase || window.location.origin;
    }

    const keyName = key.split('/').pop() || 'presentation';
    const baseName = keyName
      .replace(/[?#].*$/, '')
      .replace(/\.(pptx|ppsx|ppt|pptm|potx|potm|pdf)$/i, '');

    return `${origin}/api/uploads/office/${encodeURIComponent(baseName)}.pptx?key=${encodeURIComponent(key)}`;
  } catch {
    return storedUrl;
  }
}
