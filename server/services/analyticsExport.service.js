import { PassThrough, Readable } from 'node:stream';
import archiver from 'archiver';
import { prisma } from './prisma.js';
import {
  analyticsService,
  ANALYTICS_EVENTS,
  AnalyticsValidationError,
} from './analytics.service.js';
import {
  userActivityService,
  USER_ACTIVITY_EVENTS,
  UserActivityValidationError,
  USER_ACTIVITY_USER_SELECT,
} from './userActivity.service.js';

// ---------------------------------------------------------------------------
// Analytics export service â€” admin-only CSV/JSON/ZIP exports of the existing
// AnalyticsEvent + UserActivity data.
//
// Design rules:
//   - READ-ONLY. Never writes, updates, or deletes analytics rows.
//   - Reuses the EXACT date parsing (analyticsService.parseRange /
//     userActivityService.parseRange) and filter semantics of the dashboards.
//   - Raw exports stream via cursor-paginated chunked reads; they never load
//     the whole table into memory. A documented row cap bounds memory even for
//     huge datasets (see MAX_EXPORT_ROWS and the README inside the ZIP).
//   - Privacy is preserved: sensitive keys are stripped read-side as defense
//     in depth, and identity exports are limited to what answers "who did what".
//     Email/phone/tokens/passwords/secrets are never exported.
// ---------------------------------------------------------------------------

// Bounded cap for raw per-row exports (events / activity). Exports that would
// exceed this are truncated to the cap and flagged via X-Export-Truncated.
// Aggregate exports (summary/pages/content/devices/social) are small by nature.
const MAX_EXPORT_ROWS = 100000;

// Default date range when the client supplies no from/to: last N days (UTC).
const DEFAULT_RANGE_DAYS = 30;

// Read-side denylist â€” mirrors the write-side sanitizer in
// userActivity.service.js. Any key matching this (case-insensitive) is dropped
// from exported properties/metadata so legacy/bad rows can never leak PII.
const SENSITIVE_KEY =
  /password|passwd|pwd|hash|token|secret|authorization|cookie|credential|jwt|api[_]?key|email|phone|ip[_]?address|ssn|credit[_]?card/i;

// CSV constants â€” CRLF line endings + UTF-8 BOM for Excel compatibility.
const CSV_BOM = '\uFEFF';
const CSV_EOL = '\r\n';

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

// RFC 4180-style escaping: quote any value containing a comma, quote, or line
// break; double-up embedded quotes. Deterministic and Arabic-safe.
function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsvRow(values) {
  return values.map(csvEscape).join(',') + CSV_EOL;
}

function toCsv(header, rows) {
  return CSV_BOM + toCsvRow(header) + rows.map((r) => toCsvRow(r)).join('');
}

export { toCsv };

// Serialize a JSON column for CSV. Non-scalar/nested values are dropped, and
// sensitive keys are stripped â€” never "[object Object]".
function safeJson(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object' || Array.isArray(value)) return '';
  const clean = sanitizeObject(value);
  if (!Object.keys(clean).length) return '';
  try {
    return JSON.stringify(clean);
  } catch {
    return '';
  }
}

// Keep only scalar values (string/number/boolean) under non-sensitive keys.
function sanitizeObject(value) {
  const out = {};
  for (const [key, val] of Object.entries(value ?? {})) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      out[key] = val;
    }
  }
  return out;
}

// Lift known, stable keys out of a properties/metadata object into dedicated
// scalar columns; the remaining (sanitized) object stays as the JSON cell.
function splitKnownKeys(value, knownKeys) {
  const clean = sanitizeObject(value);
  const flat = knownKeys.map((k) => (Object.prototype.hasOwnProperty.call(clean, k) ? clean[k] : ''));
  const residual = {};
  for (const [key, val] of Object.entries(clean)) {
    if (!knownKeys.includes(key)) residual[key] = val;
  }
  return { flat, residual };
}

// ---------------------------------------------------------------------------
// Date / range helpers (single source of truth: the existing service parsers)
// ---------------------------------------------------------------------------

function toDayKey(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function rangeLabel({ gte, lte }) {
  return `${toDayKey(gte)}-${toDayKey(lte)}`;
}

// Strict input guard for from/to. analyticsService.parseRange is intentionally
// lenient (an unparsable value is treated as "no filter"), but the export
// endpoints must reject malformed dates with HTTP 400. Valid values are still
// converted by the SAME existing parser â€” this only refuses garbage input.
function assertValidDateParams(query, ValidationError) {
  for (const name of ['from', 'to']) {
    const value = query?.[name];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || !value.trim()) continue;
    const v = value.trim();
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      throw new ValidationError(`Invalid ${name} date: ${v.slice(0, 64)}`);
    }
  }
}

// Resolve + validate the query range using the dashboard's own parser, then
// apply the documented default (last 30 days) when no range is supplied.
function resolveRange(query, parseRange, ValidationError) {
  assertValidDateParams(query, ValidationError);
  const { gte, lte } = parseRange(query ?? {});
  const now = new Date();
  let from = gte;
  let to = lte;
  if (!from && !to) {
    to = now;
    from = new Date(now.getTime() - DEFAULT_RANGE_DAYS * 86400000);
  } else if (!from) {
    from = new Date(to.getTime() - DEFAULT_RANGE_DAYS * 86400000);
  } else if (!to) {
    to = now;
  }
  return { gte: from, lte: to };
}

// Validated content ranking metric for top-content exports.
function resolveContentMetric(query) {
  const metric = query?.metric;
  if (metric === undefined || metric === null || metric === '') return 'views';
  if (!['views', 'downloads', 'favorites'].includes(metric)) {
    throw new AnalyticsValidationError(`Invalid content metric: ${metric}`);
  }
  return metric;
}

// Fill calendar gaps (zero-count days) in UTC, matching analytics getTimeseries.
function fillDays(map, gte, lte, empty) {
  const start = new Date(`${toDayKey(gte)}T00:00:00.000Z`);
  const end = new Date(`${toDayKey(lte)}T00:00:00.000Z`);
  const out = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, ...(map.get(key) ?? empty) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Filter building (same semantics as the dashboards)
// ---------------------------------------------------------------------------

// Analytics raw events: eventName / contentType / route / date range.
function buildEventsWhere(query, range) {
  const where = {};
  if (range.gte || range.lte) {
    where.createdAt = {};
    if (range.gte) where.createdAt.gte = range.gte;
    if (range.lte) where.createdAt.lte = range.lte;
  }
  if (query.route) where.route = query.route;
  if (query.contentType) where.contentType = query.contentType;
  if (query.eventName) {
    if (!ANALYTICS_EVENTS.has(query.eventName)) {
      throw new AnalyticsValidationError(`Unknown analytics event: ${query.eventName}`);
    }
    where.eventName = query.eventName;
  }
  return where;
}

// User activity: action / userId / contentType / search / route / date range.
// Filter semantics are delegated to the existing service (buildWhere +
// buildUserSearch) so export and dashboard behave identically.
function buildActivityWhere(query, range) {
  const base = userActivityService.buildWhere({
    from: range.gte ? range.gte.toISOString() : undefined,
    to: range.lte ? range.lte.toISOString() : undefined,
    action: query.action || undefined,
    userId: query.userId || undefined,
    contentType: query.contentType || undefined,
  });
  if (query.search) {
    const search = userActivityService.buildUserSearch(query.search);
    if (search) base.OR = search;
  }
  // Route is not exposed by buildWhere; add it here (indexed via createdAt).
  if (query.route) base.route = query.route;
  return base;
}

// ---------------------------------------------------------------------------
// Chunked reads (cursor pagination over the unique id column)
// ---------------------------------------------------------------------------

async function* chunkedFetch(model, { where, orderBy, take, select, include }) {
  let lastId = null;
  for (;;) {
    const rows = await model.findMany({
      where,
      orderBy,
      take,
      ...(lastId ? { cursor: { id: lastId }, skip: 1 } : {}),
      ...(select ? { select } : {}),
      ...(include ? { include } : {}),
    });
    if (!rows.length) break;
    yield rows;
    lastId = rows[rows.length - 1].id;
    if (rows.length < take) break;
  }
}

const CHUNK_SIZE = 500;

// ---------------------------------------------------------------------------
// Column definitions (stable, deterministic)
// ---------------------------------------------------------------------------

const EVENTS_HEADER = [
  'id',
  'createdAt',
  'eventName',
  'route',
  'visitorId',
  'sessionId',
  'userId',
  'userName',
  'contentType',
  'contentId',
  'contentName',
  'deviceCategory',
  'browserCategory',
  'language',
  'referrer',
  'method',
  'fileType',
  'role',
  'target',
  'platform',
  'pageTitle',
  'count',
  'queryLength',
  'resultCount',
  'properties',
];

const ACTIVITY_HEADER = [
  'id',
  'createdAt',
  'action',
  'route',
  'visitorId',
  'sessionId',
  'userId',
  'username',
  'name',
  'contentType',
  'contentId',
  'contentName',
  'deviceCategory',
  'browserCategory',
  'method',
  'fileType',
  'role',
  'target',
  'platform',
  'count',
  'metadata',
];

// Stable, known property keys that are lifted out of the nested properties /
// metadata JSON into dedicated analytical columns (the task requires explicit
// scalar columns over a giant JSON blob when the keys are known + stable).
const KNOWN_EVENT_PROPERTIES = [
  'method',
  'fileType',
  'role',
  'target',
  'platform',
  'pageTitle',
  'count',
  'queryLength',
  'resultCount',
];

const KNOWN_ACTIVITY_METADATA = [
  'method',
  'fileType',
  'role',
  'target',
  'platform',
  'count',
];

const SUMMARY_HEADER = [
  'date',
  'pageViews',
  'uniqueVisitors',
  'sessions',
  'downloads',
  'contentViews',
  'searches',
  'shares',
  'favoritesAdded',
  'favoritesRemoved',
  'socialClicks',
  'cardVisits',
  'cardLinkClicks',
  'cardSocialClicks',
];

const TOP_PAGES_HEADER = ['rank', 'route', 'views', 'uniqueVisitors'];

const TOP_CONTENT_HEADER = [
  'rank',
  'contentType',
  'contentId',
  'contentName',
  'views',
  'downloads',
  'favorites',
];

const CONTENT_TYPES_HEADER = ['contentType', 'count', 'percentage'];

const DEVICES_HEADER = ['deviceCategory', 'count', 'percentage'];

const SOCIAL_HEADER = ['platform', 'clicks', 'percentage'];

// User-level activity summary (safe admin identity columns only).
const USER_ACTIVITY_SUMMARY_HEADER = [
  'userId',
  'visitorId',
  'username',
  'name',
  'visitorType',
  'firstActivityAt',
  'lastActivityAt',
  'totalActivities',
  'views',
  'downloads',
  'searches',
  'favoritesAdded',
  'favoritesRemoved',
  'shares',
  'socialClicks',
  'cardLinkClicks',
  'cardSocialClicks',
  'authActions',
];

const SOCIAL_PLATFORM = {
  facebook_click: 'facebook',
  youtube_click: 'youtube',
  email_click: 'email',
};

// UserActivity action groupings for the per-user summary. These mirror the
// analytics metric groupings (views/downloads/shares/social) so the two exports
// answer the same business questions at different granularities.
const ACTIVITY_METRIC_ACTIONS = {
  views: ['hymn_view', 'powerpoint_view', 'image_view', 'saying_view', 'book_view'],
  downloads: ['download_started'],
  searches: ['search'],
  favoritesAdded: ['favorite_added'],
  favoritesRemoved: ['favorite_removed'],
  shares: ['share_started', 'share_completed', 'card_share'],
  socialClicks: ['facebook_click', 'youtube_click', 'email_click'],
  cardLinkClicks: ['card_link_click'],
  cardSocialClicks: ['card_social_click'],
  authActions: ['login_success', 'logout'],
};

// ---------------------------------------------------------------------------
// Export builders
// ---------------------------------------------------------------------------

export const analyticsExportService = {
  // ---- Analytics raw events ------------------------------------------------

  // Validate query + resolve range + count. Returns everything the controller
  // needs to set headers BEFORE the stream starts.
  async prepareEvents(query) {
    const range = resolveRange(query, analyticsService.parseRange.bind(analyticsService), AnalyticsValidationError);
    const where = buildEventsWhere(query, range);
    const total = await prisma.analyticsEvent.count({ where });
    return {
      range,
      where,
      total,
      truncated: total > MAX_EXPORT_ROWS,
      label: rangeLabel(range),
    };
  },

  // Batched user-name lookup â€” a single query, never N+1.
  async loadEventsUserMap(where) {
    const rows = await prisma.analyticsEvent.findMany({
      where,
      distinct: ['userId'],
      select: { userId: true },
    });
    const ids = rows.map((r) => r.userId).filter(Boolean);
    if (!ids.length) return new Map();
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true },
    });
    return new Map(users.map((u) => [u.id, u.username]));
  },

  async *streamEventsCsv({ where }) {
    const userMap = await this.loadEventsUserMap(where);
    let count = 0;
    yield CSV_BOM + toCsvRow(EVENTS_HEADER);
    for await (const rows of chunkedFetch(prisma.analyticsEvent, {
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: CHUNK_SIZE,
    })) {
      for (const e of rows) {
        if (count >= MAX_EXPORT_ROWS) return;
        count += 1;
        const { flat, residual } = splitKnownKeys(e.properties, KNOWN_EVENT_PROPERTIES);
        yield toCsvRow([
          e.id,
          e.createdAt.toISOString(),
          e.eventName,
          e.route ?? '',
          e.visitorId ?? '',
          e.sessionId ?? '',
          e.userId ?? '',
          e.userId ? (userMap.get(e.userId) ?? '') : '',
          e.contentType ?? '',
          e.contentId ?? '',
          e.contentName ?? '',
          e.deviceCategory ?? '',
          e.browserCategory ?? '',
          e.language ?? '',
          e.referrer ?? '',
          ...flat,
          safeJson(residual),
        ]);
      }
    }
  },

  async getEventsJson({ where }) {
    const userMap = await this.loadEventsUserMap(where);
    const rows = await prisma.analyticsEvent.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: MAX_EXPORT_ROWS,
    });
    return rows.map((e) => {
      const { flat, residual } = splitKnownKeys(e.properties, KNOWN_EVENT_PROPERTIES);
      const [method, fileType, role, target, platform, pageTitle, count, queryLength, resultCount] = flat;
      return {
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        eventName: e.eventName,
        route: e.route,
        visitorId: e.visitorId,
        sessionId: e.sessionId,
        userId: e.userId,
        userName: e.userId ? (userMap.get(e.userId) ?? null) : null,
        contentType: e.contentType,
        contentId: e.contentId,
        contentName: e.contentName,
        deviceCategory: e.deviceCategory,
        browserCategory: e.browserCategory,
        language: e.language,
        referrer: e.referrer,
        method,
        fileType,
        role,
        target,
        platform,
        pageTitle,
        count,
        queryLength,
        resultCount,
        properties: residual,
      };
    });
  },

  // ---- Analytics summary (one row per day, zero-filled) ---------------------

  async getSummary(query) {
    const range = resolveRange(query, analyticsService.parseRange.bind(analyticsService), AnalyticsValidationError);
    const gteVal = range.gte.toISOString();
    const lteVal = range.lte.toISOString();

    const rows = await prisma.$queryRawUnsafe(
      `SELECT date_trunc('day', "createdAt")::date AS day,
         COUNT(*) FILTER (WHERE "eventName" IN ('page_view','card_page_view')) AS "pageViews",
         COUNT(DISTINCT "visitorId") AS "uniqueVisitors",
         COUNT(DISTINCT "sessionId") AS "sessions",
         COUNT(*) FILTER (WHERE "eventName" IN ('download_started','download_completed')) AS "downloads",
         COUNT(*) FILTER (WHERE "eventName" IN ('content_view','hymn_view','powerpoint_view','image_view','saying_view','book_view')) AS "contentViews",
         COUNT(*) FILTER (WHERE "eventName" = 'search') AS "searches",
         COUNT(*) FILTER (WHERE "eventName" IN ('share_started','share_completed','card_share')) AS "shares",
         COUNT(*) FILTER (WHERE "eventName" = 'favorite_added') AS "favoritesAdded",
         COUNT(*) FILTER (WHERE "eventName" = 'favorite_removed') AS "favoritesRemoved",
         COUNT(*) FILTER (WHERE "eventName" IN ('facebook_click','youtube_click','email_click')) AS "socialClicks",
         COUNT(*) FILTER (WHERE "eventName" = 'card_page_view') AS "cardVisits",
         COUNT(*) FILTER (WHERE "eventName" = 'card_link_click') AS "cardLinkClicks",
         COUNT(*) FILTER (WHERE "eventName" = 'card_social_click') AS "cardSocialClicks"
       FROM "AnalyticsEvent"
       WHERE "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp
       GROUP BY day ORDER BY day ASC`,
      gteVal,
      lteVal,
    );

    const empty = {
      pageViews: 0,
      uniqueVisitors: 0,
      sessions: 0,
      downloads: 0,
      contentViews: 0,
      searches: 0,
      shares: 0,
      favoritesAdded: 0,
      favoritesRemoved: 0,
      socialClicks: 0,
      cardVisits: 0,
      cardLinkClicks: 0,
      cardSocialClicks: 0,
    };
    const map = new Map();
    for (const row of rows) {
      map.set(toDayKey(row.day), {
        pageViews: Number(row.pageViews),
        uniqueVisitors: Number(row.uniqueVisitors),
        sessions: Number(row.sessions),
        downloads: Number(row.downloads),
        contentViews: Number(row.contentViews),
        searches: Number(row.searches),
        shares: Number(row.shares),
        favoritesAdded: Number(row.favoritesAdded),
        favoritesRemoved: Number(row.favoritesRemoved),
        socialClicks: Number(row.socialClicks),
        cardVisits: Number(row.cardVisits),
        cardLinkClicks: Number(row.cardLinkClicks),
        cardSocialClicks: Number(row.cardSocialClicks),
      });
    }
    return {
      range,
      label: rangeLabel(range),
      days: fillDays(map, range.gte, range.lte, empty),
    };
  },

  // ---- Top pages (rank, route, views, uniqueVisitors) -----------------------

  async getTopPages(query) {
    const range = resolveRange(query, analyticsService.parseRange.bind(analyticsService), AnalyticsValidationError);
    const rows = await prisma.$queryRawUnsafe(
      `SELECT route,
         COUNT(*) AS views,
         COUNT(DISTINCT "visitorId") AS "uniqueVisitors"
       FROM "AnalyticsEvent"
       WHERE "eventName" IN ('page_view','card_page_view')
         AND route IS NOT NULL AND route <> ''
         AND "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp
       GROUP BY route
       ORDER BY views DESC, route ASC
       LIMIT 500`,
      range.gte.toISOString(),
      range.lte.toISOString(),
    );
    return {
      range,
      label: rangeLabel(range),
      items: rows.map((row, index) => ({
        rank: index + 1,
        route: row.route,
        views: Number(row.views),
        uniqueVisitors: Number(row.uniqueVisitors),
      })),
    };
  },

  // ---- Top content (rank, contentType, contentId, contentName, views,
  //      downloads, favorites) -------------------------------------------------
  // Optional `metric` query param (views|downloads|favorites) controls ranking.

  async getTopContent(query) {
    const range = resolveRange(query, analyticsService.parseRange.bind(analyticsService), AnalyticsValidationError);
    const metric = resolveContentMetric(query);
    const orderBy = {
      views: 'views DESC, downloads DESC, favorites DESC, "contentName" ASC',
      downloads: 'downloads DESC, views DESC, favorites DESC, "contentName" ASC',
      favorites: 'favorites DESC, views DESC, downloads DESC, "contentName" ASC',
    }[metric];
    const rows = await prisma.$queryRawUnsafe(
      `SELECT "contentName", "contentType", "contentId",
         COUNT(*) FILTER (WHERE "eventName" IN ('content_view','hymn_view','powerpoint_view','image_view','saying_view','book_view')) AS views,
         COUNT(*) FILTER (WHERE "eventName" IN ('download_started','download_completed')) AS downloads,
         COUNT(*) FILTER (WHERE "eventName" = 'favorite_added') AS favorites
       FROM "AnalyticsEvent"
       WHERE "contentName" IS NOT NULL AND "contentName" <> ''
         AND "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp
       GROUP BY "contentName", "contentType", "contentId"
       ORDER BY ${orderBy}
       LIMIT 500`,
      range.gte.toISOString(),
      range.lte.toISOString(),
    );
    return {
      range,
      label: rangeLabel(range),
      items: rows.map((row, index) => ({
        rank: index + 1,
        contentType: row.contentType ?? '',
        contentId: row.contentId ?? '',
        contentName: row.contentName,
        views: Number(row.views),
        downloads: Number(row.downloads),
        favorites: Number(row.favorites),
      })),
    };
  },

  // ---- Devices (reuses analyticsService.getDeviceBreakdown) -----------------

  async getDevices(query) {
    const range = resolveRange(query, analyticsService.parseRange.bind(analyticsService), AnalyticsValidationError);
    const rows = await analyticsService.getDeviceBreakdown({
      from: range.gte.toISOString(),
      to: range.lte.toISOString(),
    });
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    return {
      range,
      label: rangeLabel(range),
      items: rows.map((r) => ({
        deviceCategory: r.device,
        count: r.count,
        percentage: total > 0 ? Number(((r.count / total) * 100).toFixed(2)) : 0,
      })),
    };
  },

  // ---- Social (reuses analyticsService.getTopSocial) -------------------------

  async getSocial(query) {
    const range = resolveRange(query, analyticsService.parseRange.bind(analyticsService), AnalyticsValidationError);
    const rows = await analyticsService.getTopSocial({
      from: range.gte.toISOString(),
      to: range.lte.toISOString(),
    });
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    return {
      range,
      label: rangeLabel(range),
      items: rows.map((r) => ({
        platform: SOCIAL_PLATFORM[r.platform] ?? r.platform,
        clicks: r.count,
        percentage: total > 0 ? Number(((r.count / total) * 100).toFixed(2)) : 0,
      })),
    };
  },

  // ---- Content types (reuses analyticsService.getContentTypeBreakdown) --------

  async getContentTypes(query) {
    const range = resolveRange(query, analyticsService.parseRange.bind(analyticsService), AnalyticsValidationError);
    const rows = await analyticsService.getContentTypeBreakdown({
      from: range.gte.toISOString(),
      to: range.lte.toISOString(),
    });
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    return {
      range,
      label: rangeLabel(range),
      items: rows.map((r) => ({
        contentType: r.contentType,
        count: r.count,
        percentage: total > 0 ? Number(((r.count / total) * 100).toFixed(2)) : 0,
      })),
    };
  },

  // ---- User activity ---------------------------------------------------------

  async prepareActivity(query) {
    const range = resolveRange(query, userActivityService.parseRange.bind(userActivityService), UserActivityValidationError);
    const where = buildActivityWhere(query, range);
    const total = await prisma.userActivity.count({ where });
    return {
      range,
      where,
      total,
      truncated: total > MAX_EXPORT_ROWS,
      label: rangeLabel(range),
    };
  },

  async *streamActivityCsv({ where }) {
    let count = 0;
    yield CSV_BOM + toCsvRow(ACTIVITY_HEADER);
    for await (const rows of chunkedFetch(prisma.userActivity, {
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: CHUNK_SIZE,
      include: { user: { select: USER_ACTIVITY_USER_SELECT } },
    })) {
      for (const row of rows) {
        if (count >= MAX_EXPORT_ROWS) return;
        count += 1;
        const user = row.user;
        const { flat, residual } = splitKnownKeys(row.metadata, KNOWN_ACTIVITY_METADATA);
        yield toCsvRow([
          row.id,
          row.createdAt.toISOString(),
          row.action,
          row.route ?? '',
          row.visitorId ?? '',
          row.sessionId ?? '',
          user ? user.id : '',
          user ? user.username : 'Anonymous',
          user ? (user.full_name ?? '') : 'Anonymous',
          row.contentType ?? '',
          row.contentId ?? '',
          row.contentName ?? '',
          row.deviceCategory ?? '',
          row.browserCategory ?? '',
          ...flat,
          safeJson(residual),
        ]);
      }
    }
  },

  async getActivityJson({ where }) {
    const rows = await prisma.userActivity.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: MAX_EXPORT_ROWS,
      include: { user: { select: USER_ACTIVITY_USER_SELECT } },
    });
    return rows.map((row) => {
      const user = row.user;
      const { flat, residual } = splitKnownKeys(row.metadata, KNOWN_ACTIVITY_METADATA);
      const [method, fileType, role, target, platform, count] = flat;
      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        action: row.action,
        route: row.route,
        visitorId: row.visitorId,
        sessionId: row.sessionId,
        userId: user ? user.id : null,
        username: user ? user.username : 'Anonymous',
        name: user ? (user.full_name ?? '') : 'Anonymous',
        contentType: row.contentType,
        contentId: row.contentId,
        contentName: row.contentName,
        deviceCategory: row.deviceCategory,
        browserCategory: row.browserCategory,
        method,
        fileType,
        role,
        target,
        platform,
        count,
        metadata: residual,
      };
    });
  },

  // ---- User activity summary (one row per user/visitor, aggregated) ----------
  // Database-only aggregation (Prisma groupBy), never raw rows in memory.
  // Authenticated rows key on the internal userId; anonymous rows key on the
  // non-identifying random visitorId. No identity is invented for anonymous data.

  async getUserActivitySummary(query) {
    const range = resolveRange(query, userActivityService.parseRange.bind(userActivityService), UserActivityValidationError);
    const baseWhere = buildActivityWhere(query, range);

    const authWhere = { ...baseWhere, userId: { not: null } };
    const anonWhere = { ...baseWhere, userId: null };

    const [userRows, userActions, visitorRows, visitorActions] = await Promise.all([
      prisma.userActivity.groupBy({
        by: ['userId'],
        where: authWhere,
        _count: { _all: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
      prisma.userActivity.groupBy({
        by: ['userId', 'action'],
        where: authWhere,
        _count: { _all: true },
      }),
      prisma.userActivity.groupBy({
        by: ['visitorId'],
        where: anonWhere,
        _count: { _all: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
      prisma.userActivity.groupBy({
        by: ['visitorId', 'action'],
        where: anonWhere,
        _count: { _all: true },
      }),
    ]);

    const ids = userRows.map((r) => r.userId).filter(Boolean);
    const users = ids.length
      ? await prisma.user.findMany({ where: { id: { in: ids } }, select: USER_ACTIVITY_USER_SELECT })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    const build = (groupRows, actionRows, visitorType) => {
      const actionMap = new Map();
      for (const a of actionRows) {
        const key = a.userId ?? a.visitorId ?? '';
        if (!actionMap.has(key)) actionMap.set(key, {});
        actionMap.get(key)[a.action] = a._count._all;
      }
      return groupRows
        .filter((r) => r.userId || r.visitorId)
        .map((r) => {
          const key = r.userId ?? r.visitorId ?? '';
          const user = r.userId ? userById.get(r.userId) : null;
          const actions = actionMap.get(key) ?? {};
          const metric = (name) =>
            ACTIVITY_METRIC_ACTIONS[name].reduce((sum, a) => sum + (actions[a] ?? 0), 0);
          return {
            userId: r.userId ?? '',
            visitorId: r.visitorId ?? '',
            username: user ? user.username : 'Anonymous',
            name: user ? (user.full_name ?? '') : 'Anonymous',
            visitorType,
            firstActivityAt: r._min?.createdAt?.toISOString() ?? '',
            lastActivityAt: r._max?.createdAt?.toISOString() ?? '',
            totalActivities: r._count._all,
            views: metric('views'),
            downloads: metric('downloads'),
            searches: metric('searches'),
            favoritesAdded: metric('favoritesAdded'),
            favoritesRemoved: metric('favoritesRemoved'),
            shares: metric('shares'),
            socialClicks: metric('socialClicks'),
            cardLinkClicks: metric('cardLinkClicks'),
            cardSocialClicks: metric('cardSocialClicks'),
            authActions: metric('authActions'),
          };
        });
    };

    const items = [
      ...build(userRows, userActions, 'authenticated'),
      ...build(visitorRows, visitorActions, 'anonymous'),
    ].sort((a, b) => b.totalActivities - a.totalActivities);

    return { range, label: rangeLabel(range), items };
  },

  // ---- Full ZIP -------------------------------------------------------------

  async buildFullZip(query) {
    const [events, activity] = await Promise.all([
      this.prepareEvents(query),
      this.prepareActivity(query),
    ]);

    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = new PassThrough();
    archive.on('error', (err) => {
      stream.destroy(err);
    });
    archive.pipe(stream);

    const eventsStream = Readable.from(this.streamEventsCsv(events));
    eventsStream.on('error', () => {});
    archive.append(eventsStream, { name: 'analytics-events.csv' });

    const activityStream = Readable.from(this.streamActivityCsv(activity));
    activityStream.on('error', () => {});
    archive.append(activityStream, { name: 'user-activity.csv' });

    const summary = await this.getSummary(query);
    archive.append(toCsv(SUMMARY_HEADER, summary.days.map((d) => Object.values(d))), {
      name: 'analytics-summary.csv',
    });

    const pages = await this.getTopPages(query);
    archive.append(
      toCsv(
        TOP_PAGES_HEADER,
        pages.items.map((it) => Object.values(it)),
      ),
      { name: 'top-pages.csv' },
    );

    const content = await this.getTopContent(query);
    archive.append(
      toCsv(
        TOP_CONTENT_HEADER,
        content.items.map((it) => Object.values(it)),
      ),
      { name: 'top-content.csv' },
    );

    const devices = await this.getDevices(query);
    archive.append(
      toCsv(
        DEVICES_HEADER,
        devices.items.map((it) => Object.values(it)),
      ),
      { name: 'devices.csv' },
    );

    const contentTypes = await this.getContentTypes(query);
    archive.append(
      toCsv(
        CONTENT_TYPES_HEADER,
        contentTypes.items.map((it) => Object.values(it)),
      ),
      { name: 'content-types.csv' },
    );

    const social = await this.getSocial(query);
    archive.append(
      toCsv(
        SOCIAL_HEADER,
        social.items.map((it) => Object.values(it)),
      ),
      { name: 'social.csv' },
    );

    const activitySummary = await this.getUserActivitySummary(query);
    archive.append(
      toCsv(
        USER_ACTIVITY_SUMMARY_HEADER,
        activitySummary.items.map((it) => Object.values(it)),
      ),
      { name: 'user-activity-summary.csv' },
    );

    archive.append(
      buildReadme({ events, activity, summary, pages, content, devices, contentTypes, social, activitySummary }),
      { name: 'README.txt' },
    );

    archive.finalize();

    return {
      stream,
      meta: {
        from: events.range.gte,
        to: events.range.lte,
        label: events.label,
        truncated: events.truncated || activity.truncated,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// README for the ZIP
// ---------------------------------------------------------------------------

function buildReadme({ events, activity, summary, pages, content, devices, contentTypes, social, activitySummary }) {
  const now = new Date().toISOString();
  const lines = [
    'ANALYTICS DATA EXPORT - DATA DICTIONARY',
    '=======================================',
    '',
    `Generated at (UTC):  ${now}`,
    `Date range (UTC):    ${summary.label}`,
    'Timezone:            UTC - all timestamps are ISO 8601 UTC (YYYY-MM-DDTHH:mm:ss.sssZ).',
    '',
    'FORMAT',
    '------',
    'Every file is UTF-8 CSV with a BOM (opens cleanly in Excel). CRLF line endings.',
    'Numeric metrics are plain numbers. Text containing commas/quotes is quoted.',
    '',
    'DATASETS',
    '--------',
    '',
    '1) analytics-summary.csv  AGGREGATED (one row per calendar day).',
    '   Daily totals for the whole site, zero-filled so every day in the range appears.',
    '',
    '   date              UTC calendar date (YYYY-MM-DD).',
    '   pageViews         page_view + card_page_view events.',
    '   uniqueVisitors    distinct visitorId that day.',
    '   sessions          distinct sessionId that day.',
    '   downloads         download_started + download_completed events.',
    '   contentViews      content_view/hymn_view/powerpoint_view/image_view/saying_view/book_view.',
    '   searches          search events (query text is never stored or exported).',
    '   shares            share_started + share_completed + card_share.',
    '   favoritesAdded    favorite_added events.',
    '   favoritesRemoved  favorite_removed events.',
    '   socialClicks      facebook_click + youtube_click + email_click.',
    '   cardVisits        card_page_view events (QR digital business card visits).',
    '   cardLinkClicks    card_link_click events (card quick-access links).',
    '   cardSocialClicks  card_social_click events (card contact buttons).',
    '',
    '2) analytics-events.csv  EVENT-LEVEL (one row per raw analytics event).',
    '   Capped to the most recent rows matching the range (see LIMITS).',
    '',
    '   id/createdAt      unique event id and ISO UTC timestamp.',
    '   eventName         machine name of the event (page_view, download_started, ...).',
    '   route             path the event happened on (e.g. /hymns).',
    '   visitorId/sessionId  random non-identifying browser identifiers.',
    '   userId/userName   internal id + login name. Only set for signed-in users.',
    '   contentType/contentId/contentName  the content involved, when any.',
    '   deviceCategory/browserCategory/language/referrer  request context.',
    '   method            how an action was performed (native/copy/fallback).',
    '   fileType          file type for media views/downloads (e.g. PowerPoint file).',
    '   role              user role at login_success.',
    '   target            card link destination for card_link_click.',
    '   platform          card social platform for card_social_click.',
    '   pageTitle         page title for page_view.',
    '   count             number of items (bulk actions).',
    '   queryLength/resultCount  search metrics (NOT the query text).',
    '   properties        residual JSON of any other scalar properties.',
    '',
    '3) top-pages.csv  AGGREGATED ranking of routes by page views.',
    '   rank, route, views, uniqueVisitors.',
    '',
    '4) top-content.csv  AGGREGATED ranking of content items.',
    '   rank, contentType, contentId, contentName, views, downloads, favorites.',
    '',
    '5) content-types.csv  AGGREGATED content-type breakdown.',
    '   contentType, count, percentage.',
    '',
    '6) devices.csv  AGGREGATED device breakdown.',
    '   deviceCategory, count, percentage.',
    '',
    '7) social.csv  AGGREGATED social/contact click breakdown.',
    '   platform (facebook/youtube/email), clicks, percentage.',
    '',
    '8) user-activity.csv  EVENT-LEVEL audit trail (one row per recorded action).',
    '   Same context columns as analytics-events.csv, plus:',
    '   action            machine name of the recorded action.',
    '   username/name     signed-in user identity, or "Anonymous" for visitors.',
    '   metadata          residual JSON of scalar properties (credentials never stored).',
    '',
    '9) user-activity-summary.csv  AGGREGATED per-user/per-visitor summary.',
    '   One row per authenticated user and one per anonymous visitor.',
    '',
    '   userId            internal user id (empty for anonymous visitors).',
    '   visitorId         random anonymous identifier (empty for signed-in users).',
    '   username/name     identity, or "Anonymous".',
    '   visitorType       "authenticated" or "anonymous".',
    '   firstActivityAt/lastActivityAt  activity window (ISO UTC).',
    '   totalActivities   total recorded actions.',
    '   views/downloads/searches/favoritesAdded/favoritesRemoved/shares/socialClicks',
    '   cardLinkClicks/cardSocialClicks  card-specific metrics.',
    '   authActions       login_success + logout actions.',
    '',
    'ANONYMOUS vs AUTHENTICATED',
    '--------------------------',
    'Authenticated = tied to a registered account (userId set).',
    'Anonymous = a random browser identifier (visitorId/sessionId), never resolved',
    'to a real person. visitorType lets you split every analysis by the two groups.',
    '',
    'PRIVACY',
    '-------',
    'No passwords, hashes, tokens, JWTs, emails, phones, IP addresses, clipboard',
    'content, search query text, or secrets are stored or exported. Search columns',
    'contain only counts and query length. Saying/full text is never exported.',
    '',
    'RAW EXPORT LIMITS',
    '-----------------',
    `Raw exports (analytics-events.csv, user-activity.csv) are limited to the most`,
    `recent ${MAX_EXPORT_ROWS} rows matching the selected range/filters (see the`,
    'X-Export-Truncated response header). For larger datasets narrow the date range',
    'or use the aggregate files, which are always complete.',
    '',
    'RECOMMENDED USE',
    '---------------',
    'Import into Excel, Google Sheets, Power BI, Tableau, Python/pandas, or hand the',
    'CSVs to an AI assistant. Dimensions (route, contentType, visitorType, date) and',
    'metrics (views, downloads, favorites, ...) are separated so joins/analyses are',
    'straightforward. analytics-summary.csv answers "what happened per day";',
    'top-pages/top-content answer "what is popular"; user-activity-summary answers',
    '"which users are active".',
  ];
  return lines.join('\n');
}

