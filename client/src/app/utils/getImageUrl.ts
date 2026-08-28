const MEDIA_SERVER = import.meta.env.VITE_MEDIA_SERVER_URL || '';

/**
 * Resolve an image path to a usable URL.
 *
 * - Full URLs (`http://…`, `https://…`, `data:…`, `blob:…`) are returned as-is.
 * - API paths (`/api/uploads/…`) are returned as-is (same-origin via Vercel proxy).
 * - Raw S3 keys (`Images/foo.jpg`) are routed through `/api/uploads/thumb` (same-origin).
 * - In development (no MEDIA_SERVER set), raw keys go through the local backend.
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

  // API paths — use same-origin (Vercel proxies /api/* to backend)
  if (normalized.startsWith('/api/')) {
    return normalized;
  }

  // If a media server is explicitly configured (dev or custom), use it directly
  if (MEDIA_SERVER) {
    return `${MEDIA_SERVER}${normalized}`;
  }

  // Production default: route raw S3 keys through same-origin thumb endpoint
  return `/api/uploads/thumb?key=${encodeURIComponent(normalized)}&w=700`;
}
