import { getApiBaseUrl, isApiConfigured } from '../config/api';

// ---------------------------------------------------------------------------
// First-party analytics client.
//
// Single frontend entry point for analytics events. Event names must match the
// backend whitelist in server/services/analytics.service.js EXACTLY — do not
// invent names here.
//
// Design rules:
//   - Never throws. Every path is wrapped; analytics can never break the app.
//   - Respects VITE_ANALYTICS_ENABLED (gated off unless 'true' AND API set).
//   - Anonymous identifiers only (visitor/session UUIDs in storage).
//   - Payloads are explicitly constructed and sanitized client-side too.
//   - Normal events flush via fire-and-forget fetch(keepalive); on page exit
//     (visibilitychange -> hidden / pagehide / beforeunload) any still-pending
//     queue is drained with sendBeacon. Each payload is sent exactly once.
// ---------------------------------------------------------------------------

const ANALYTICS_EVENT_NAMES = [
  // navigation
  'page_view',
  'route_change',
  'session_start',
  'card_page_view',
  // auth
  'login_success',
  'login_failed',
  'logout',
  'admin_login',
  // content
  'content_view',
  'hymn_view',
  'powerpoint_view',
  'image_view',
  'saying_view',
  'book_view',
  // downloads
  'download_started',
  'download_completed',
  'download_failed',
  // favorites
  'favorite_added',
  'favorite_removed',
  // search / filter
  'search',
  'filter_applied',
  // social / contact
  'facebook_click',
  'youtube_click',
  'email_click',
  // QR digital business card
  'card_link_click',
  'card_social_click',
  'card_share',
  'card_copy_url',
  // sharing
  'share_started',
  'share_completed',
] as const;

type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsContentType =
  | 'hymn'
  | 'powerpoint'
  | 'image'
  | 'book'
  | 'saying';

type AnalyticsProperties = Record<string, string | number | boolean>;

interface AnalyticsEventContext {
  /** Path/route this event happened on. Defaults to the current pathname. */
  route?: string;
  contentType?: AnalyticsContentType | string;
  contentId?: string | number;
  contentName?: string;
  /** Free-form metadata. Sanitized + capped; scalars only. */
  properties?: AnalyticsProperties;
}

interface AnalyticsPayload {
  eventName: AnalyticsEventName;
  route?: string;
  visitorId?: string;
  sessionId?: string;
  deviceCategory?: string;
  browserCategory?: string;
  language?: string;
  referrer?: string;
  contentType?: string;
  contentId?: string;
  contentName?: string;
  properties?: AnalyticsProperties;
}

// Actions that ALSO produce an audit-log row. Must EXACTLY match the backend
// whitelist in server/services/userActivity.service.js (USER_ACTIVITY_EVENTS).
// Only these meaningful actions are audited — page_view, filter_applied, etc.
// stay analytics-only.
const USER_ACTIVITY_ACTIONS = new Set<string>([
  // auth
  'login_success',
  'logout',
  // content
  'hymn_view',
  'powerpoint_view',
  'image_view',
  'saying_view',
  'book_view',
  // downloads
  'download_started',
  // favorites
  'favorite_added',
  'favorite_removed',
  // search
  'search',
  // sharing
  'share_started',
  'share_completed',
  // QR digital business card
  'card_link_click',
  'card_social_click',
  'card_share',
  'card_copy_url',
  // social / contact
  'facebook_click',
  'youtube_click',
  'email_click',
]);

// Payload for the audit-log endpoint. Note the differences from the analytics
// payload: `action` (not eventName), `metadata` (not properties), and NO userId —
// the server derives identity from the Authorization header (JWT) and never
// trusts a client-supplied userId.
interface ActivityPayload {
  action: string;
  route?: string;
  visitorId?: string;
  sessionId?: string;
  contentType?: string;
  contentId?: string;
  contentName?: string;
  metadata?: AnalyticsProperties;
  deviceCategory?: string;
  browserCategory?: string;
}

// Mirror the backend caps so we never send something the server would reject.
const MAX_EVENT_NAME = 64;
const MAX_STRING = 500;
const MAX_ID = 100;
const MAX_CONTENT_NAME = 300;
const MAX_PROPERTY_KEYS = 20;
const MAX_PROPERTY_STRING = 500;

const VISITOR_KEY = 'habib_gerges_analytics_visitor_id';
const SESSION_KEY = 'habib_gerges_analytics_session_id';

// ---------------------------------------------------------------------------
// Environment gate
// ---------------------------------------------------------------------------

function isAnalyticsEnabled(): boolean {
  return import.meta.env.VITE_ANALYTICS_ENABLED === 'true' && isApiConfigured();
}

// ---------------------------------------------------------------------------
// Anonymous identifiers
// ---------------------------------------------------------------------------

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Safe fallback when crypto.randomUUID is unavailable (non-secure origins).
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${time}-${rand}-${Math.random().toString(36).slice(2, 10)}`;
}

function storageAvailable(storage: Storage | null | undefined): boolean {
  if (typeof window === 'undefined' || !storage) return false;
  try {
    const test = '__analytics_test__';
    storage.setItem(test, '1');
    storage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

function getOrCreateId(storage: Storage | null | undefined, key: string): string {
  if (storage && storageAvailable(storage)) {
    try {
      const existing = storage.getItem(key);
      if (existing) return existing;
      const id = generateId();
      storage.setItem(key, id);
      return id;
    } catch {
      // storage read/write failed — fall through to ephemeral id
    }
  }
  return generateId();
}

let cachedVisitorId: string | null = null;
let cachedSessionId: string | null = null;

/** Anonymous, namespaced, persisted visitor id (localStorage). */
function getVisitorId(): string {
  if (cachedVisitorId) return cachedVisitorId;
  const storage =
    typeof window !== 'undefined' ? window.localStorage : null;
  cachedVisitorId = getOrCreateId(storage, VISITOR_KEY);
  return cachedVisitorId;
}

/** Per-browser-session id (sessionStorage); a fresh id per browser session. */
function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;
  const storage =
    typeof window !== 'undefined' ? window.sessionStorage : null;
  cachedSessionId = getOrCreateId(storage, SESSION_KEY);
  return cachedSessionId;
}

// ---------------------------------------------------------------------------
// Derived, non-fingerprinting device/browser context
// ---------------------------------------------------------------------------

let cachedDevice: string | null = null;
function getDeviceCategory(): string {
  if (cachedDevice) return cachedDevice;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isTablet =
    /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
    (/Android/i.test(ua) && !/Mobi/i.test(ua));
  const isMobile = /Mobi|Android|iPhone|iPod|BlackBerry|Windows Phone/i.test(ua);
  cachedDevice = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';
  return cachedDevice;
}

let cachedBrowser: string | null = null;
function getBrowserCategory(): string {
  if (cachedBrowser) return cachedBrowser;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/Edg\//.test(ua)) cachedBrowser = 'edge';
  else if (/OPR\/|Opera/i.test(ua)) cachedBrowser = 'opera';
  else if (/Chrome\//.test(ua)) cachedBrowser = 'chrome';
  else if (/Firefox\//.test(ua)) cachedBrowser = 'firefox';
  else if (/Safari\//.test(ua)) cachedBrowser = 'safari';
  else cachedBrowser = 'other';
  return cachedBrowser;
}

// Captured once at load — only the page-level referrer, never IP or UA.
const PAGE_REFERRER =
  typeof document !== 'undefined' ? document.referrer : '';
const PAGE_LANGUAGE =
  typeof navigator !== 'undefined' ? navigator.language : '';

// ---------------------------------------------------------------------------
// Sanitization (mirrors server/services/analytics.service.js)
// ---------------------------------------------------------------------------

function cleanString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, max);
}

function cleanProperties(value: unknown): AnalyticsProperties | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: AnalyticsProperties = {};
  let count = 0;
  for (const [key, val] of Object.entries(value)) {
    if (count >= MAX_PROPERTY_KEYS) break;
    const k = cleanString(key, 64);
    if (!k) continue;
    if (typeof val === 'string') {
      const s = cleanString(val, MAX_PROPERTY_STRING);
      if (s !== undefined) {
        out[k] = s;
        count += 1;
      }
    } else if (typeof val === 'number' && Number.isFinite(val)) {
      out[k] = val;
      count += 1;
    } else if (typeof val === 'boolean') {
      out[k] = val;
      count += 1;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------

function buildPayload(
  eventName: AnalyticsEventName,
  ctx: AnalyticsEventContext,
): AnalyticsPayload | undefined {
  if (!ANALYTICS_EVENT_NAMES.includes(eventName)) return undefined;

  const payload: AnalyticsPayload = {
    eventName,
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    deviceCategory: getDeviceCategory(),
  };

  const browser = getBrowserCategory();
  if (browser) payload.browserCategory = browser;
  if (PAGE_LANGUAGE) payload.language = PAGE_LANGUAGE;
  if (PAGE_REFERRER) payload.referrer = PAGE_REFERRER;

  const route = cleanString(
    ctx.route ?? (typeof location !== 'undefined' ? location.pathname : ''),
    MAX_STRING,
  );
  if (route) payload.route = route;

  const contentType = cleanString(ctx.contentType, 64);
  if (contentType) payload.contentType = contentType;

  if (ctx.contentId !== undefined && ctx.contentId !== null) {
    const contentId = cleanString(String(ctx.contentId), MAX_ID);
    if (contentId) payload.contentId = contentId;
  }

  const contentName = cleanString(ctx.contentName, MAX_CONTENT_NAME);
  if (contentName) payload.contentName = contentName;

  const properties = cleanProperties(ctx.properties);
  if (properties) payload.properties = properties;

  return payload;
}

// Build the audit-log payload from the same context. Explicitly constructed and
// sanitized; `metadata` only ever carries scalar, non-sensitive values.
function buildActivityPayload(
  action: string,
  ctx: AnalyticsEventContext,
): ActivityPayload | undefined {
  if (!USER_ACTIVITY_ACTIONS.has(action)) return undefined;

  const payload: ActivityPayload = {
    action,
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    deviceCategory: getDeviceCategory(),
  };

  const browser = getBrowserCategory();
  if (browser) payload.browserCategory = browser;

  const route = cleanString(
    ctx.route ?? (typeof location !== 'undefined' ? location.pathname : ''),
    MAX_STRING,
  );
  if (route) payload.route = route;

  const contentType = cleanString(ctx.contentType, 64);
  if (contentType) payload.contentType = contentType;

  if (ctx.contentId !== undefined && ctx.contentId !== null) {
    const contentId = cleanString(String(ctx.contentId), MAX_ID);
    if (contentId) payload.contentId = contentId;
  }

  const contentName = cleanString(ctx.contentName, MAX_CONTENT_NAME);
  if (contentName) payload.contentName = contentName;

  const metadata = cleanProperties(ctx.properties);
  if (metadata) payload.metadata = metadata;

  return payload;
}

// ---------------------------------------------------------------------------
// Sending — queue + idle flush (fetch keepalive), beacon drain on page exit
// ---------------------------------------------------------------------------

function analyticsEndpoint(): string {
  return `${getApiBaseUrl()}/api/analytics/events`;
}

const queue: AnalyticsPayload[] = [];
let flushScheduled = false;

function enqueue(payload: AnalyticsPayload): void {
  queue.push(payload);
  if (!flushScheduled) {
    flushScheduled = true;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(
        () => {
          flushScheduled = false;
          flushQueue();
        },
        { timeout: 1500 },
      );
    } else {
      setTimeout(() => {
        flushScheduled = false;
        flushQueue();
      }, 0);
    }
  }
}

function flushQueue(): void {
  const batch = queue.splice(0, queue.length);
  for (const payload of batch) sendFetch(payload);
  if (queue.length && !flushScheduled) {
    flushScheduled = true;
    setTimeout(() => {
      flushScheduled = false;
      flushQueue();
    }, 0);
  }
}

function sendFetch(payload: AnalyticsPayload): void {
  try {
    void fetch(analyticsEndpoint(), {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // analytics is fire-and-forget — a failed send is irrelevant to the app
    });
  } catch {
    // ignore
  }
}

function sendBeacon(payload: AnalyticsPayload): void {
  try {
    const ok = navigator.sendBeacon(
      analyticsEndpoint(),
      new Blob([JSON.stringify(payload)], { type: 'application/json' }),
    );
    if (ok) return;
  } catch {
    // ignore — fall through to fetch below
  }
  sendFetch(payload);
}

// Drain anything still pending when the page is going away. Items already sent
// by fetch were removed from the queue, so nothing is ever double-sent.
if (typeof document !== 'undefined') {
  const drainOnExit = () => {
    const batch = queue.splice(0, queue.length);
    for (const payload of batch) sendBeacon(payload);
    const activityBatch = activityQueue.splice(0, activityQueue.length);
    for (const item of activityBatch) sendActivity(item);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') drainOnExit();
  });
  window.addEventListener('pagehide', drainOnExit);
  window.addEventListener('beforeunload', drainOnExit);
}

// ---------------------------------------------------------------------------
// Audit-log sending — same fire-and-forget discipline as analytics.
//
// Each queued item captures the Authorization header EAGERLY (at enqueue time)
// so a logout that clears localStorage before the idle flush still gets
// attributed to the user who was logged in. The token is only ever used in the
// header of an HTTPS request to our own server — never persisted or logged.
// sendBeacon cannot attach headers, so the exit drain uses fetch(keepalive)
// (which can) with a beacon fallback.
// ---------------------------------------------------------------------------

function activityEndpoint(): string {
  return `${getApiBaseUrl()}/api/admin/activity/events`;
}

function currentAuthHeader(): Record<string, string> {
  try {
    const token =
      typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

interface ActivityQueueItem {
  payload: ActivityPayload;
  authHeader: Record<string, string>;
}

const activityQueue: ActivityQueueItem[] = [];
let activityFlushScheduled = false;

function enqueueActivity(payload: ActivityPayload): void {
  activityQueue.push({ payload, authHeader: currentAuthHeader() });
  if (!activityFlushScheduled) {
    activityFlushScheduled = true;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(
        () => {
          activityFlushScheduled = false;
          flushActivityQueue();
        },
        { timeout: 1500 },
      );
    } else {
      setTimeout(() => {
        activityFlushScheduled = false;
        flushActivityQueue();
      }, 0);
    }
  }
}

function flushActivityQueue(): void {
  const batch = activityQueue.splice(0, activityQueue.length);
  for (const item of batch) sendActivity(item);
  if (activityQueue.length && !activityFlushScheduled) {
    activityFlushScheduled = true;
    setTimeout(() => {
      activityFlushScheduled = false;
      flushActivityQueue();
    }, 0);
  }
}

function sendActivity(item: ActivityQueueItem): void {
  try {
    void fetch(activityEndpoint(), {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', ...item.authHeader },
      body: JSON.stringify(item.payload),
    }).catch(() => {
      // fire-and-forget — a failed audit send is irrelevant to the app
    });
  } catch {
    // Fallback for very old browsers without keepalive fetch.
    try {
      navigator.sendBeacon(
        activityEndpoint(),
        new Blob([JSON.stringify(item.payload)], { type: 'application/json' }),
      );
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a single analytics event. Fire-and-forget, never throws.
 *
 *   trackEvent('page_view', { route: '/hymns' });
 *   trackEvent('download_started', {
 *     contentType: 'hymn', contentId: '123', contentName: 'ترنيمة',
 *   });
 *   trackEvent('facebook_click');
 */
export function trackEvent(
  eventName: AnalyticsEventName,
  ctx: AnalyticsEventContext = {},
): void {
  if (!isAnalyticsEnabled()) return;
  try {
    const payload = buildPayload(eventName, ctx);
    if (payload) enqueue(payload);
    // Same single call site also produces the audit-log row for whitelisted
    // actions. Identity is derived server-side from the JWT; anonymous visitors
    // remain anonymous. No client userId is ever sent.
    if (USER_ACTIVITY_ACTIONS.has(eventName)) {
      const activity = buildActivityPayload(eventName, ctx);
      if (activity) enqueueActivity(activity);
    }
  } catch {
    // analytics must never propagate into the UI
  }
}
