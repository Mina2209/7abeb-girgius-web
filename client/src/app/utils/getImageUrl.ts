import { getApiBaseUrl } from '../config/api';

// Optional override for setups where raw S3 keys are served by a dedicated media
// origin (e.g. a public bucket or CDN). Leave unset when the API server is the only
// thing that can resolve keys — the default below routes them through its thumbnail
// endpoint. Do NOT point this at the API origin: raw keys are not routes there.
const MEDIA_SERVER = import.meta.env.VITE_MEDIA_SERVER_URL || '';

/**
 * Resolve an image path to a usable URL.
 *
 * - Full URLs (`http://…`, `https://…`, `data:…`, `blob:…`) are returned as-is.
 * - API paths (`/api/uploads/…`) are resolved against the API base URL.
 * - Raw S3 keys (`Images/foo.jpg`) are routed through the API's `/api/uploads/thumb`.
 *
 * Every returned URL is absolute whenever an API base is configured. The frontend is
 * served from an S3 website bucket, which is a different origin to the API and has no
 * proxy in front of it, so a relative `/api/…` would resolve against the bucket and 404.
 */
export function getImageUrl(path: string | null | undefined): string {
  if (!path) return '';

  // Full URLs pass through unchanged
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path;
  }

  const normalized = path.startsWith('/') ? path : `/${path}`;
  const apiBase = getApiBaseUrl();

  // API paths — resolve against the API origin (empty base falls back to same-origin,
  // which is what the Vite dev proxy expects).
  if (normalized.startsWith('/api/')) {
    return `${apiBase}${normalized}`;
  }

  // A dedicated media origin, when one is configured, serves raw keys directly.
  if (MEDIA_SERVER) {
    return `${MEDIA_SERVER}${normalized}`;
  }

  // Default: let the API resize and serve the key.
  return `${apiBase}/api/uploads/thumb?key=${encodeURIComponent(normalized)}&w=700`;
}
