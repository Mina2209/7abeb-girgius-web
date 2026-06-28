// Append the real (e.g. Arabic) filename to our S3 redirect endpoint so the server can
// sign the presigned URL with a Content-Disposition that forces that filename. The S3 key
// itself is ASCII-sanitized, so without this the file downloads under a garbled name.
// Non-proxy URLs (external/data URLs) are returned unchanged.
export function withDownloadName(url: string, filename: string): string {
  if (!url || !url.includes('/api/uploads/url?key=')) return url;
  return `${url}&name=${encodeURIComponent(filename)}`;
}

// Trigger a native browser download. The browser streams the file straight from S3 to disk
// (no memory buffering, native progress bar) and the Content-Disposition header forces the
// correct filename. The `download` attribute is only an extra hint for same-origin URLs.
export function downloadFile(url: string, filename: string): void {
  if (!url) return;
  const link = document.createElement('a');
  link.href = withDownloadName(url, filename);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Trigger a download from a server URL that responds with Content-Disposition: attachment
// (e.g. the zip endpoint). A hidden iframe is used instead of navigation so that an error
// response (such as a 503 when the server is busy) is contained inside the iframe and
// doesn't replace the app's page. The download itself is owned by the browser once it
// starts, so removing the iframe afterwards is safe.
export function downloadViaUrl(url: string): void {
  if (!url) return;
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  setTimeout(() => iframe.remove(), 120000);
}
