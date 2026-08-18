import { apiGetJson } from './apiClient';

// Typed client for the admin-only analytics endpoints (Batch 3).
// All GET endpoints require an ADMIN token — the centralized apiClient attaches
// the Authorization header from localStorage, and the server enforces
// authenticate + requireAdmin. Never call these for public users.

export interface AnalyticsRange {
  from?: string;
  to?: string;
}

export interface AnalyticsOverview {
  totalEvents: number;
  pageViews: number;
  uniqueVisitors: number;
  sessions: number;
  downloads: number;
  favorites: number;
  socialClicks: number;
  shares: number;
  searches: number;
  from: string | null;
  to: string | null;
}

export interface AnalyticsDayPoint {
  date: string;
  count: number;
}

export interface AnalyticsTopPage {
  route: string;
  count: number;
  percentage: string | number;
}

export interface AnalyticsContentItem {
  contentName: string;
  contentType: string | null;
  contentId: string | null;
  count: number;
}

export interface AnalyticsSocialItem {
  platform: string;
  count: number;
}

export interface AnalyticsEventItem {
  event: string;
  count: number;
}

export interface AnalyticsDeviceItem {
  device: string;
  count: number;
}

export interface AnalyticsContentTypeItem {
  contentType: string;
  count: number;
}

// visitorId / userId are intentionally omitted — never surfaced in the admin UI.
export interface AnalyticsRecentEvent {
  id: string;
  eventName: string;
  route: string | null;
  contentType: string | null;
  contentId: string | null;
  contentName: string | null;
  deviceCategory: string | null;
  createdAt: string;
}

export type TimeseriesMetric = 'page_views' | 'sessions' | 'downloads' | 'events';
type TopContentEvent = 'download' | 'favorite' | 'view';

function buildQuery(
  range: AnalyticsRange,
  extra?: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  if (range.from) search.set('from', range.from);
  if (range.to) search.set('to', range.to);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export async function getAnalyticsOverview(
  range: AnalyticsRange,
): Promise<AnalyticsOverview> {
  return apiGetJson<AnalyticsOverview>(`/api/analytics/overview${buildQuery(range)}`);
}

export async function getAnalyticsTimeseries(
  range: AnalyticsRange,
  metric: TimeseriesMetric = 'page_views',
): Promise<AnalyticsDayPoint[]> {
  return apiGetJson<AnalyticsDayPoint[]>(
    `/api/analytics/timeseries${buildQuery(range, { metric })}`,
  );
}

export async function getAnalyticsTopPages(
  range: AnalyticsRange,
  limit = 10,
): Promise<AnalyticsTopPage[]> {
  return apiGetJson<AnalyticsTopPage[]>(
    `/api/analytics/pages${buildQuery(range, { limit })}`,
  );
}

export async function getAnalyticsTopContent(
  range: AnalyticsRange,
  event: TopContentEvent = 'download',
  limit = 10,
): Promise<AnalyticsContentItem[]> {
  return apiGetJson<AnalyticsContentItem[]>(
    `/api/analytics/content${buildQuery(range, { event, limit })}`,
  );
}

export async function getAnalyticsTopSocial(
  range: AnalyticsRange,
): Promise<AnalyticsSocialItem[]> {
  return apiGetJson<AnalyticsSocialItem[]>(
    `/api/analytics/social${buildQuery(range)}`,
  );
}

export async function getAnalyticsEventBreakdown(
  range: AnalyticsRange,
  limit = 20,
): Promise<AnalyticsEventItem[]> {
  return apiGetJson<AnalyticsEventItem[]>(
    `/api/analytics/events${buildQuery(range, { limit })}`,
  );
}

export async function getAnalyticsDevices(
  range: AnalyticsRange,
): Promise<AnalyticsDeviceItem[]> {
  return apiGetJson<AnalyticsDeviceItem[]>(
    `/api/analytics/devices${buildQuery(range)}`,
  );
}

export async function getAnalyticsContentTypes(
  range: AnalyticsRange,
): Promise<AnalyticsContentTypeItem[]> {
  return apiGetJson<AnalyticsContentTypeItem[]>(
    `/api/analytics/content-types${buildQuery(range)}`,
  );
}

export async function getAnalyticsRecentEvents(
  range: AnalyticsRange,
  limit = 20,
): Promise<AnalyticsRecentEvent[]> {
  return apiGetJson<AnalyticsRecentEvent[]>(
    `/api/analytics/recent${buildQuery(range, { limit })}`,
  );
}
