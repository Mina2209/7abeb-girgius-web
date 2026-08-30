import { trackEvent } from '../services/analytics';
import type { AnalyticsContentType } from '../services/analytics';

interface DownloadAnalyticsMeta {
  contentType?: AnalyticsContentType | string;
  contentId?: string | number;
  contentName?: string;
  properties?: Record<string, string | number | boolean>;
}

// Append the real (e.g. Arabic) filename to our S3 redirect endpoint so the server can
// sign the presigned URL with a Content-Disposition that forces that filename. The S3 key
// itself is ASCII-sanitized, so without this the file downloads under a garbled name.
// Non-proxy URLs (external/data URLs) are returned unchanged.
function withDownloadName(url: string, filename: string): string {
  if (!url || !url.includes('/api/uploads/url?key=')) return url;
  return `${url}&name=${encodeURIComponent(filename)}`;
}

// Fire-and-forget download analytics. The download itself has already started by the
// time this runs, so a failed analytics request can never delay or break it.
function trackDownload(meta?: DownloadAnalyticsMeta): void {
  if (!meta) return;
  const properties: Record<string, string | number | boolean> = {};
  if (meta.properties) {
    Object.assign(properties, meta.properties);
  }
  const extMatch = meta.contentName?.match(/\.([a-z0-9]{2,5})$/i);
  if (extMatch) properties.fileExtension = extMatch[1].toLowerCase();
  trackEvent('download_started', {
    contentType: meta.contentType,
    contentId: meta.contentId,
    contentName: meta.contentName,
    properties,
  });
}

// Trigger a native browser download. The browser streams the file straight from S3 to disk
// (no memory buffering, native progress bar) and the Content-Disposition header forces the
// correct filename. The `download` attribute is only an extra hint for same-origin URLs.
export function downloadFile(
  url: string,
  filename: string,
  meta?: DownloadAnalyticsMeta,
): void {
  if (!url) return;
  const link = document.createElement('a');
  link.href = withDownloadName(url, filename);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  trackDownload(meta);
}

// Trigger a download from a server URL that responds with Content-Disposition: attachment
// (e.g. the zip endpoint). A transient anchor click is used: it navigates the top-level
// window to the URL, and the browser owns the download from there via the attachment
// header — so the current page is left untouched on success.
//
// Note: a hidden iframe must NOT be used here. The server sends `X-Frame-Options: DENY`
// on every response, and Chrome/Edge silently drop downloads that come from an iframe
// whose response is blocked by framing restrictions — producing a dead button.
export function downloadViaUrl(
  url: string,
  meta?: DownloadAnalyticsMeta,
): void {
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  trackDownload(meta);
}
