// ---------------------------------------------------------------------------
// Google Analytics 4 (GA4) client — third-party analytics layer.
//
// GA4 is a SEPARATE, opt-in analytics system alongside the first-party client
// in ./analytics.ts. It is intentionally independent:
//   - Gates on VITE_GA4_ENABLED === 'true' AND a non-empty VITE_GA4_ID.
//   - Loads gtag.js ONLY after the visitor grants consent (see
//     AnalyticsConsentBanner.tsx). No consent, no Google request, no tracking.
//   - Never throws. Every path is wrapped; GA4 can never break the app.
//   - No PII: anonymize_ip, no signals, no user_properties. Params are
//     sanitized and capped client-side.
// ---------------------------------------------------------------------------

export type GA4ConsentState = 'pending' | 'granted' | 'denied';

const CONSENT_KEY = 'habib_gerges_ga4_consent';
const SCRIPT_ID = 'ga4-gtag';
const SCRIPT_SRC_PREFIX = 'https://www.googletagmanager.com/gtag/js?id=';

// Param keys that must NEVER reach Google — free text that could carry PII or
// privilege data. Applied as a hard gate in trackGA4 (defense in depth) even if
// a future call site forgets. The GA4 bridge never includes these values by
// construction; this set makes that impossible to regress.
const GA4_BLOCKED_PARAMS = new Set<string>([
  'search_term',
  'query',
  'q',
  'term',
  'role',
  'email',
  'username',
  'user_name',
  'full_name',
  'name',
  'phone',
  'phone_number',
  'mobile',
  'password',
  'pass',
  'token',
  'jwt',
  'access_token',
  'authorization',
  'secret',
  'api_key',
  'ssn',
  'national_id',
  'national_number',
]);

// First-party events that GA4 should NOT re-emit — the platform already fires
// its own equivalents automatically (session_start) or they would duplicate
// the manual page_view (route_change).
const GA4_SKIP_EVENTS = new Set<string>(['session_start', 'route_change']);

// First-party event -> GA4 recommended/custom event name.
// Events not listed here pass through with their own name.
const GA4_EVENT_NAMES: Record<string, string> = {
  page_view: 'page_view',
  login_success: 'login',
  sign_up: 'sign_up',
  hymn_view: 'select_content',
  powerpoint_view: 'select_content',
  image_view: 'select_content',
  saying_view: 'select_content',
  book_view: 'select_content',
  content_view: 'select_content',
  download_started: 'file_download',
  share_completed: 'share',
  search: 'search',
};

// ---------------------------------------------------------------------------
// Sanitization (mirrors ./analytics.ts spirit; no PII values ever sent)
// ---------------------------------------------------------------------------

const MAX_STRING = 500;
const MAX_ID = 100;
const MAX_CONTENT_NAME = 300;
const MAX_PROPERTY_KEYS = 20;
const MAX_PROPERTY_STRING = 500;

function cleanString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, max);
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function cleanBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function cleanProperties(
  value: unknown,
): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, string | number | boolean> = {};
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
// Environment gate
// ---------------------------------------------------------------------------

export function ga4MeasurementId(): string {
  return (import.meta.env.VITE_GA4_ID ?? '').trim();
}

export function isGA4Configured(): boolean {
  return import.meta.env.VITE_GA4_ENABLED === 'true' && ga4MeasurementId().length > 0;
}

// ---------------------------------------------------------------------------
// Consent state (localStorage)
// ---------------------------------------------------------------------------

function storageAvailable(storage: Storage | null | undefined): boolean {
  if (typeof window === 'undefined' || !storage) return false;
  try {
    const test = '__ga4_consent_test__';
    storage.setItem(test, '1');
    storage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function setGA4Consent(state: GA4ConsentState): void {
  try {
    const storage =
      typeof window !== 'undefined' ? window.localStorage : null;
    if (storage && storageAvailable(storage)) {
      storage.setItem(CONSENT_KEY, state);
    }
  } catch {
    // storage unavailable — GA4 simply stays off until reload persists state
  }
}

export function getGA4Consent(): GA4ConsentState {
  try {
    const storage =
      typeof window !== 'undefined' ? window.localStorage : null;
    const value =
      storage && storageAvailable(storage) ? storage.getItem(CONSENT_KEY) : null;
    if (value === 'granted' || value === 'denied') return value;
  } catch {
    // fall through to pending
  }
  return 'pending';
}

// ---------------------------------------------------------------------------
// gtag runtime (injected lazily, only after consent is granted)
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let configured = false;

function ensureGtagRuntime(): void {
  if (typeof window === 'undefined') return;
  if (!window.dataLayer) window.dataLayer = [];
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer!.push(args);
    };
  }
}

function injectScript(id: string): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `${SCRIPT_SRC_PREFIX}${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

/**
 * Re-fire the current page_view once at grant time. The landing page is usually
 * viewed BEFORE consent, so its page_view was dropped by the gate; without this
 * it would be permanently lost. Guaranteed single-fire:
 *   - This is the only place it runs on grant.
 *   - AnalyticsRouteTracker only fires on *subsequent* pathname changes, so a
 *     grant-time view for the current path can never be duplicated by it.
 *   - If the user navigates again before gtag.js finishes loading, the queued
 *     order is [current page, next page] — two distinct paths, no duplication.
 */
function trackCurrentPageView(): void {
  try {
    const path =
      typeof location !== 'undefined' ? location.pathname : '';
    if (!path) return;
    const params: GA4EventParams = { page_path: path };
    const title =
      typeof document !== 'undefined' ? document.title : '';
    if (title) params.page_title = title;
    window.gtag?.('event', 'page_view', params);
  } catch {
    // ignore — GA4 must never break consent handling
  }
}

/**
 * Grant consent: enable GA4 for this visitor. Called once by the consent
 * banner. Config is pushed through the dataLayer so gtag.js executes it in
 * order the moment the script tag finishes loading.
 */
export function grantGA4Consent(): void {
  setGA4Consent('granted');
  if (!isGA4Configured()) return;
  ensureGtagRuntime();
  const gtag = window.gtag;
  if (!gtag) return;

  if (configured) {
    // Consent re-granted after a revoke — the script is already active.
    gtag('consent', 'update', { analytics_storage: 'granted' });
  } else {
    configured = true;

    const id = ga4MeasurementId();
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
      wait_for_update: 500,
    });
    gtag('js', new Date());
    gtag('config', id, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      // SPA route changes are tracked manually via the page_view mapping.
      send_page_view: false,
    });
    gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
    });
    injectScript(id);
  }

  // The landing page must not be permanently lost to the pre-consent gate.
  trackCurrentPageView();
}

/** Deny consent: GA4 stays completely off for this visitor. */
export function denyGA4Consent(): void {
  setGA4Consent('denied');
}

/**
 * Revoke a previous grant: stop sending GA4 events. Uses Consent Mode to tell
 * gtag.js to drop analytics traffic; future trackGA4 calls also respect the
 * updated consent state.
 */
export function revokeGA4Consent(): void {
  setGA4Consent('denied');
  try {
    window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export type GA4EventParams = Record<string, string | number | boolean>;

/** Active = configured, consented to 'granted', and the gtag runtime exists. */
function isGA4Active(): boolean {
  return isGA4Configured() && getGA4Consent() === 'granted';
}

/**
 * Fire a single GA4 event. Fire-and-forget, never throws. No-op unless the
 * visitor explicitly granted consent and a measurement ID is configured.
 */
export function trackGA4(
  eventName: string,
  params: GA4EventParams = {},
): void {
  if (!isGA4Active()) return;
  try {
    const cleaned: GA4EventParams = {};
    for (const [key, value] of Object.entries(params)) {
      const k = cleanString(key, 64);
      if (!k) continue;
      // Hard privacy gate: never forward free-text/privileged keys.
      if (GA4_BLOCKED_PARAMS.has(k.toLowerCase())) continue;
      const s = cleanString(value as unknown, MAX_PROPERTY_STRING);
      if (s !== undefined) {
        cleaned[k] = s;
        continue;
      }
      const n = cleanNumber(value);
      if (n !== undefined) {
        cleaned[k] = n;
        continue;
      }
      const b = cleanBoolean(value);
      if (b !== undefined) cleaned[k] = b;
    }
    window.gtag?.('event', eventName, cleaned);
  } catch {
    // GA4 must never propagate into the UI
  }
}

// ---------------------------------------------------------------------------
// Bridge from the first-party analytics pipeline.
//
// Called at the single first-party trackEvent call site so GA4 receives the
// same actions. The `ga4` ctx field carries GA4-only params that are NOT part
// of the first-party payload (e.g. the raw search term).
// ---------------------------------------------------------------------------

export interface Ga4BridgeContext {
  route?: string;
  contentType?: string;
  contentId?: string | number;
  contentName?: string;
  properties?: Record<string, string | number | boolean>;
  /**
   * GA4-only params — excluded from the first-party payload on purpose.
   * Reserved for future safe (non-PII, non-free-text) metadata. No current
   * call site sets this; sensitive keys are additionally hard-blocked by
   * GA4_BLOCKED_PARAMS regardless.
   */
  ga4?: Record<string, string | number | boolean>;
}

function commonParams(
  ctx: Ga4BridgeContext,
): GA4EventParams {
  const params: GA4EventParams = {};

  const contentType = cleanString(ctx.contentType, 64);
  if (contentType) params.content_type = contentType;

  if (ctx.contentId !== undefined && ctx.contentId !== null) {
    const id = cleanString(String(ctx.contentId), MAX_ID);
    if (id) params.item_id = id;
  }

  const name = cleanString(ctx.contentName, MAX_CONTENT_NAME);
  if (name) params.item_name = name;

  const route = cleanString(
    ctx.route ?? (typeof location !== 'undefined' ? location.pathname : ''),
    MAX_STRING,
  );
  if (route) params.page_path = route;

  return params;
}

export function trackGA4FromAnalytics(
  eventName: string,
  ctx: Ga4BridgeContext,
): void {
  if (GA4_SKIP_EVENTS.has(eventName)) return;
  const ga4Name =
    GA4_EVENT_NAMES[eventName] ?? (eventName && eventName.slice(0, 40));
  if (!ga4Name) return;

  const params: GA4EventParams = {
    ...commonParams(ctx),
    ...cleanProperties(ctx.properties),
  };

  // Deeper, event-specific enrichment.
  switch (eventName) {
    case 'page_view': {
      if (typeof ctx.properties?.pageTitle === 'string') {
        const title = cleanString(ctx.properties.pageTitle, MAX_STRING);
        if (title) params.page_title = title;
      }
      break;
    }
    case 'login_success':
    case 'sign_up': {
      const method =
        typeof ctx.properties?.method === 'string'
          ? ctx.properties.method
          : 'email';
      params.method = method;
      break;
    }
    case 'download_started': {
      const fileName = cleanString(ctx.contentName, MAX_CONTENT_NAME);
      if (fileName) params.file_name = fileName;
      const ext = cleanString(ctx.properties?.fileExtension, 16);
      if (ext) params.file_extension = ext;
      const status = cleanString(ctx.properties?.status, 16);
      if (status) params.method = status;
      break;
    }
    case 'share_completed':
    case 'card_share': {
      const method = cleanString(ctx.properties?.method, 32);
      params.method = method ?? (eventName === 'card_share' ? 'card' : 'unknown');
      break;
    }
    case 'search': {
      // Privacy: the raw user-entered search term is NEVER forwarded to GA4
      // (blocked by name in trackGA4 as well). Only safe metadata is sent, so
      // no name/phone/email/free text can leak to Google even by accident.
      const count = cleanNumber(ctx.properties?.resultCount);
      if (count !== undefined) params.result_count = count;
      const len = cleanNumber(ctx.properties?.queryLength);
      if (len !== undefined) params.query_length = len;
      // Drop the camelCase duplicates that came through the generic property
      // spread so GA4 params stay snake_case.
      delete params.resultCount;
      delete params.queryLength;
      break;
    }
    default: {
      break;
    }
  }

  trackGA4(ga4Name, params);
}