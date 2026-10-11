import { apiGetJson, apiPostJson, uploadWithProgress } from './apiClient';
import { startUpload, updateProgress, completeUpload, failUpload } from '../state/uploadProgressStore';
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

// Mirrors the server's PREVIEW_NAME_OK: every presentation format the admin upload
// UI accepts. Must stay in sync with server/services/ppsx-converter.js.
const PREVIEWABLE_EXT = /\.(ppsx|pptx|ppt|pps|pptm|ppsm|potx|potm|odp)$/i;

// Preview PDFs live at a stable URL derived from the source object key, but their
// bytes are mutable — re-running the conversion (e.g. the Arabic-font fix) rewrites
// the same S3 object. The server answers with `must-revalidate` + an ETag so future
// changes are picked up, but a browser that cached the old bytes under the previous
// `immutable` header will not revalidate until that entry expires. This explicit
// version moves every client onto a fresh URL once. The server ignores `v`, so it
// never triggers a new conversion or a new S3 object; it is deterministic, so the
// URL is identical on every render for a given deploy. Bump it only when the cached
// previews are regenerated out-of-band.
export const PREVIEW_PDF_CACHE_VERSION = '20261011-fontfix';

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
  const uploadId = startUpload(file.name);
  try {
    const { url, key } = await apiGetJson<{ url: string; key: string }>(
      '/api/uploads/presign',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType, folder }),
      },
    );

    const putRes = await uploadWithProgress({
      url,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
      onUploadProgress: (loaded, total) => updateProgress(uploadId, loaded, total),
    });
    if (!putRes.ok) {
      const detail = await putRes.text().catch(() => '');
      throw new Error(`S3 upload failed with status ${putRes.status}${detail ? `: ${detail}` : ''}`);
    }

    completeUpload(uploadId);
    // Stored absolute, matching every row the previous site wrote. The value is
    // persisted in the database and read back by a frontend served from a different
    // origin (the S3 website bucket), where a relative path would not resolve.
    return { url: `${getApiBaseUrl()}/api/uploads/url?key=${encodeURIComponent(key)}`, key };
  } catch (err) {
    failUpload(uploadId, err instanceof Error ? err.message : String(err));
    throw err;
  }
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
* Ask the server to generate (or reuse) the PDF preview for an uploaded
 * presentation, returning the preview URL and page count. The original .ppsx is
 * never touched. Returns null when generation fails (e.g. LibreOffice missing).
 */
export async function requestPreviewGeneration(key: string): Promise<{
  previewUrl: string;
  slideCount: number | null;
} | null> {
  try {
    const res = await apiPostJson<{
      previewKey: string;
      previewUrl: string;
      slideCount: number | null;
    }>('/api/uploads/preview', { key });
    // Normalize a relative server URL so the browser can fetch it from any origin.
    const previewUrl = res.previewUrl.startsWith('/api/')
      ? `${getApiBaseUrl()}${res.previewUrl}`
      : res.previewUrl;
    return {
      previewUrl,
      slideCount: res.slideCount ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Build the on-demand PDF preview URL for a stored presentation.
 *
 * The server derives a cache key from the source object, converts the presentation
 * with LibreOffice the first time it is requested, and streams the PDF back. That
 * makes the preview available for every presentation already in the bucket — no
 * re-upload and no per-file metadata required.
 *
 * Returns undefined for anything that is not a presentation (audio, video, images).
 */
export function buildPreviewPdfUrl(storedUrl?: string | null): string | undefined {
  if (!storedUrl) return undefined;
  try {
    const u = new URL(storedUrl, window.location.origin);
    const key = u.searchParams.get('key');
    if (!key || !PREVIEWABLE_EXT.test(key)) return undefined;
    const origin = getApiBaseUrl() || window.location.origin;
    return `${origin}/api/uploads/preview/pdf?key=${encodeURIComponent(key)}&v=${PREVIEW_PDF_CACHE_VERSION}`;
  } catch {
    return undefined;
  }
}

/**
 * Resolve a stored file URL (e.g. `/api/uploads/url?key=...`) to the app's own
 * streaming endpoint so the browser can fetch the raw file bytes.
 *
 * The returned URL is absolute so it works on localhost during development and
 * avoids any CORS surprises when the app is served from a different origin.
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
