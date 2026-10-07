// Single source of truth for the app-facing URL of a stored S3 object.
//
// Both the PDF preview (ppsx-converter) and the per-slide images (slide-images)
// stream through the same `/api/uploads/url` proxy, so the base-URL handling
// lives here once. An empty base means "same origin": the stored value stays
// relative, which is what the deployed app has always produced.

export function publicApiBaseUrl() {
  return (process.env.PUBLIC_API_URL || process.env.API_BASE_URL || '').replace(/\/$/, '');
}

export function uploadUrlFor(key) {
  return `${publicApiBaseUrl()}/api/uploads/url?key=${encodeURIComponent(key)}`;
}
