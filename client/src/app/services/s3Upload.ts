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

  await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });

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
export async function getPreviewUrl(storedUrl: string): Promise<string> {
  try {
    const u = new URL(storedUrl, window.location.origin);
    const key = u.searchParams.get('key');
    if (!key) return storedUrl;
    const apiBase = getApiBaseUrl();
    const origin = apiBase || window.location.origin;
    return `${origin}/api/uploads/proxy?key=${encodeURIComponent(key)}`;
  } catch {
    return storedUrl;
  }
}
