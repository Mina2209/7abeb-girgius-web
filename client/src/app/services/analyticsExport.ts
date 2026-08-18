import { getApiBaseUrl } from '../config/api';

// Typed client for the admin-only analytics export endpoints.
//
// Downloads are triggered directly by the browser (fetch -> Blob -> object URL),
// so large exports never land in React state. The Authorization header comes
// from localStorage, exactly like the rest of the app, and the server enforces
// authenticate + requireAdmin.

export type ExportFormat = 'csv' | 'json' | 'zip';

export interface ExportRange {
  from?: string;
  to?: string;
}

export type ExportDatasetId =
  | 'summary'
  | 'pages'
  | 'content'
  | 'events'
  | 'devices'
  | 'social'
  | 'contentTypes'
  | 'activitySummary'
  | 'full';

const EXPORT_ENDPOINTS: Record<ExportDatasetId, string> = {
  summary: '/api/admin/analytics/export/summary',
  pages: '/api/admin/analytics/export/pages',
  content: '/api/admin/analytics/export/content',
  events: '/api/admin/analytics/export/events',
  devices: '/api/admin/analytics/export/devices',
  social: '/api/admin/analytics/export/social',
  contentTypes: '/api/admin/analytics/export/content-types',
  activitySummary: '/api/admin/analytics/export/activity-summary',
  full: '/api/admin/analytics/export/full',
};

// Full export is always a ZIP archive — enforced by the server too.
export const FULL_EXPORT_FORMAT: ExportFormat = 'zip';

interface ExportResult {
  filename: string;
  rangeLabel?: string;
  rows?: string;
  truncated: boolean;
}

interface ExportErrorShape extends Error {
  status?: number;
}

function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  // RFC 5987 filename*=UTF-8''<urlencoded>
  const star = disposition.match(/filename\*=(?:UTF-8''|utf-8'')([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {
      /* fall through to plain filename */
    }
  }
  const plain = disposition.match(/filename="([^"]*)"/i);
  if (plain) return plain[1];
  const bare = disposition.match(/filename=([^;]+)/i);
  if (bare) return bare[1].trim().replace(/^"|"$/g, '');
  return null;
}

function defaultFilename(dataset: ExportDatasetId, format: ExportFormat): string {
  const day = new Date().toISOString().slice(0, 10);
  const ext = format === 'zip' ? 'zip' : format;
  return `analytics-${dataset}-${day}.${ext}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before revoking the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Fetch an export as a Blob, then trigger the browser download. Returns the
// server metadata (filename, range, row count) for success/failure toasts.
export async function downloadExport(
  dataset: ExportDatasetId,
  format: ExportFormat,
  range: ExportRange,
): Promise<ExportResult> {
  const search = new URLSearchParams();
  search.set('format', format);
  if (range.from) search.set('from', range.from);
  if (range.to) search.set('to', range.to);

  const base = getApiBaseUrl();
  const url = `${base}${EXPORT_ENDPOINTS[dataset]}?${search.toString()}`;

  const token = localStorage.getItem('token');
  const headers = new Headers({ Accept: 'application/json' });
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(url, { headers, method: 'GET' });
  } catch {
    const error: ExportErrorShape = new Error('تعذر الاتصال بالخادم');
    error.status = 0;
    throw error;
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      window.dispatchEvent(new Event('sessionExpired'));
    }
    const text = await res.text().catch(() => '');
    let message = `خطأ ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed && typeof parsed.error === 'string' && parsed.error) {
        message = parsed.error;
      }
    } catch {
      /* non-JSON error body */
    }
    const error: ExportErrorShape = new Error(message);
    error.status = res.status;
    throw error;
  }

  const blob = await res.blob();
  const filename =
    parseFilename(res.headers.get('Content-Disposition')) ??
    defaultFilename(dataset, format);

  const rangeLabel = res.headers.get('X-Export-Range') ?? undefined;
  const rows = res.headers.get('X-Export-Rows') ?? undefined;
  const truncated = res.headers.get('X-Export-Truncated') === 'true';

  triggerDownload(blob, filename);

  return { filename, rangeLabel, rows, truncated };
}
