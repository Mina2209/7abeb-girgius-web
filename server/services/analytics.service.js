import { prisma } from './prisma.js';

// ---------------------------------------------------------------------------
// Analytics service — first-party usage analytics.
//
// Recording:
//   - Whitelisted event names only.
//   - Payloads are sanitized (length caps, control-char stripping, JSON shape).
//   - Fails closed and silently: a bad event must never crash the app.
//
// Aggregation:
//   - All read queries run on the database (groupBy / raw SQL), never in memory.
//   - Date filtering is server-side via the createdAt index.
// ---------------------------------------------------------------------------

export const ANALYTICS_EVENTS = new Set([
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
]);

export const SOCIAL_EVENTS = ['facebook_click', 'youtube_click', 'email_click'];
export const PAGE_VIEW_EVENTS = ['page_view', 'card_page_view'];
export const DOWNLOAD_EVENTS = ['download_started', 'download_completed'];
export const SHARE_EVENTS = ['share_started', 'share_completed', 'card_share'];

const MAX_EVENT_NAME = 64;
const MAX_STRING = 500;
const MAX_ID_STRING = 100;
const MAX_PROPERTY_KEYS = 20;
const MAX_PROPERTY_STRING = 500;

// Reusable validation error (named so the controller can map it to HTTP 400).
export class AnalyticsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnalyticsValidationError';
    // Picked up by the centralized errorHandler -> HTTP 400.
    this.status = 400;
  }
}

export function isAnalyticsEnabled() {
  return process.env.ANALYTICS_ENABLED === 'true';
}

function sanitizeString(value, max = MAX_STRING) {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, max);
}

// Only scalar values are allowed inside `properties`; anything nested is dropped.
function sanitizeProperties(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out = {};
  let count = 0;
  for (const [key, val] of Object.entries(value)) {
    if (count >= MAX_PROPERTY_KEYS) break;
    if (typeof val === 'string') {
      const s = sanitizeString(val, MAX_PROPERTY_STRING);
      if (s !== undefined) {
        out[sanitizeString(key, 64)] = s;
        count += 1;
      }
    } else if (typeof val === 'number' && Number.isFinite(val)) {
      out[sanitizeString(key, 64)] = val;
      count += 1;
    } else if (typeof val === 'boolean') {
      out[sanitizeString(key, 64)] = val;
      count += 1;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

export const analyticsService = {
  /**
   * Validate + sanitize + persist one analytics event.
   * Returns null when analytics is disabled. Throws AnalyticsValidationError
   * for unknown/malformed events. Never rejects on database hiccups at the
   * caller level (the controller swallows unexpected errors).
   */
  async recordEvent(raw) {
    if (!isAnalyticsEnabled()) return null;

    const payload = raw && typeof raw === 'object' ? raw : {};
    const eventName = sanitizeString(payload.eventName, MAX_EVENT_NAME);
    if (!eventName) throw new AnalyticsValidationError('Event name is required');
    if (!ANALYTICS_EVENTS.has(eventName)) {
      throw new AnalyticsValidationError(`Unknown analytics event: ${eventName}`);
    }

    const data = {
      eventName,
      route: sanitizeString(payload.route, MAX_STRING),
      visitorId: sanitizeString(payload.visitorId, MAX_ID_STRING),
      sessionId: sanitizeString(payload.sessionId, MAX_ID_STRING),
      contentType: sanitizeString(payload.contentType, 64),
      contentId: sanitizeString(payload.contentId, MAX_ID_STRING),
      contentName: sanitizeString(payload.contentName, 300),
      deviceCategory: sanitizeString(payload.deviceCategory, 32),
      browserCategory: sanitizeString(payload.browserCategory, 32),
      language: sanitizeString(payload.language, 32),
      referrer: sanitizeString(payload.referrer, MAX_STRING),
      userId: sanitizeString(payload.userId, MAX_ID_STRING),
      properties: sanitizeProperties(payload.properties),
    };

    // Prisma ignores undefined; keep only defined keys.
    const clean = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    );

    return prisma.analyticsEvent.create({ data: clean });
  },

  // -------------------------------------------------------------------------
  // Query helpers
  // -------------------------------------------------------------------------

  parseRange(query) {
    const parse = (value, endOfDay = false) => {
      if (typeof value !== 'string' || !value.trim()) return null;
      let v = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        v = endOfDay ? `${v}T23:59:59.999Z` : `${v}T00:00:00.000Z`;
      }
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const gte = parse(query?.from);
    const lte = parse(query?.to, true);
    if (gte && lte && gte > lte) {
      throw new AnalyticsValidationError('Invalid date range: from must be before to');
    }
    return { gte, lte };
  },

  buildWhere({ from, to, eventNames, route, contentType }) {
    const { gte, lte } = this.parseRange({ from, to });
    const where = {};
    if (gte || lte) {
      where.createdAt = {};
      if (gte) where.createdAt.gte = gte;
      if (lte) where.createdAt.lte = lte;
    }
    if (Array.isArray(eventNames) && eventNames.length) {
      where.eventName = { in: eventNames };
    }
    if (route) where.route = route;
    if (contentType) where.contentType = contentType;
    return where;
  },

  async countEvents(where) {
    return prisma.analyticsEvent.count({ where });
  },

  // Distinct count over a nullable field (visitorId / sessionId).
  async countUnique(where, field) {
    const rows = await prisma.analyticsEvent.groupBy({ by: [field], where });
    return rows.filter((row) => row[field]).length;
  },

  async countEventsIn(where, eventNames) {
    return this.countEvents({ ...where, eventName: { in: eventNames } });
  },

  // -------------------------------------------------------------------------
  // Aggregations
  // -------------------------------------------------------------------------

  async getOverview({ from, to }) {
    const where = this.buildWhere({ from, to });
    const [totalEvents, pageViews, uniqueVisitors, sessions, downloads, favorites, socialClicks, shares, searches] =
      await Promise.all([
        this.countEvents(where),
        this.countEventsIn(where, PAGE_VIEW_EVENTS),
        this.countUnique(where, 'visitorId'),
        this.countUnique(where, 'sessionId'),
        this.countEventsIn(where, DOWNLOAD_EVENTS),
        this.countEventsIn(where, ['favorite_added']),
        this.countEventsIn(where, SOCIAL_EVENTS),
        this.countEventsIn(where, SHARE_EVENTS),
        this.countEventsIn(where, ['search']),
      ]);
    return {
      totalEvents,
      pageViews,
      uniqueVisitors,
      sessions,
      downloads,
      favorites,
      socialClicks,
      shares,
      searches,
      from: from || null,
      to: to || null,
    };
  },

  async getTimeseries({ from, to, metric = 'page_views' }) {
    const { gte, lte } = this.parseRange({ from, to });
    // Prisma's $queryRawUnsafe rejects JS Date objects; bind ISO strings instead.
    // 9999-12-31 is the practical upper bound — the JS max date (+275760) breaks
    // Postgres' timestamp parser.
    const gteVal = (gte ?? new Date(0)).toISOString();
    const lteVal = (lte ?? new Date('9999-12-31T23:59:59.999Z')).toISOString();

    let rows;
    const baseWhere = '("createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp)';
    if (metric === 'sessions') {
      rows = await prisma.$queryRawUnsafe(
        `SELECT date_trunc('day', "createdAt")::date AS day, COUNT(DISTINCT "sessionId") AS count
         FROM "AnalyticsEvent" WHERE ${baseWhere}
         GROUP BY day ORDER BY day ASC`,
        gteVal,
        lteVal,
      );
    } else if (metric === 'downloads') {
      rows = await prisma.$queryRawUnsafe(
        `SELECT date_trunc('day', "createdAt")::date AS day, COUNT(*) AS count
         FROM "AnalyticsEvent" WHERE ${baseWhere} AND "eventName" IN ('download_started','download_completed')
         GROUP BY day ORDER BY day ASC`,
        gteVal,
        lteVal,
      );
    } else if (metric === 'events') {
      rows = await prisma.$queryRawUnsafe(
        `SELECT date_trunc('day', "createdAt")::date AS day, COUNT(*) AS count
         FROM "AnalyticsEvent" WHERE ${baseWhere}
         GROUP BY day ORDER BY day ASC`,
        gteVal,
        lteVal,
      );
    } else {
      rows = await prisma.$queryRawUnsafe(
        `SELECT date_trunc('day', "createdAt")::date AS day, COUNT(*) AS count
         FROM "AnalyticsEvent" WHERE ${baseWhere} AND "eventName" IN ('page_view','card_page_view')
         GROUP BY day ORDER BY day ASC`,
        gteVal,
        lteVal,
      );
    }

    const map = new Map(
      rows.map((row) => [this.toDayKey(row.day), Number(row.count)]),
    );

    // Fill calendar gaps (zero-count days) so charts are contiguous.
    // Do all day math in UTC to match date_trunc('day', ...) in Postgres and to
    // avoid the server's local timezone shifting the calendar boundaries.
    const output = [];
    if (gte) {
      const start = new Date(`${this.toDayKey(gte)}T00:00:00.000Z`);
      const end = new Date(`${this.toDayKey(lte ?? gte)}T00:00:00.000Z`);
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
        const key = d.toISOString().slice(0, 10);
        output.push({ date: key, count: map.get(key) ?? 0 });
      }
    } else {
      for (const [date, count] of map) output.push({ date, count });
      output.sort((a, b) => (a.date < b.date ? -1 : 1));
    }
    return output;
  },

  toDayKey(value) {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  },

  async getTopPages({ from, to, limit = 10 }) {
    const where = this.buildWhere({ from, to });
    where.eventName = { in: PAGE_VIEW_EVENTS };
    const total = await this.countEvents(where);
    const rows = await prisma.analyticsEvent.groupBy({
      by: ['route'],
      where,
      _count: { _all: true },
      orderBy: { _count: { route: 'desc' } },
      take: Math.min(50, Math.max(1, Number(limit) || 10)),
    });
    return rows
      .filter((row) => row.route)
      .map((row) => ({
        route: row.route,
        count: row._count._all,
        percentage: total > 0 ? Number((row._count._all / total) * 100).toFixed(1) : 0,
      }));
  },

  async getTopContent({ from, to, limit = 10, event }) {
    const eventNames =
      event === 'favorite'
        ? ['favorite_added']
        : event === 'view'
          ? ['content_view', 'hymn_view', 'powerpoint_view', 'image_view', 'saying_view', 'book_view']
          : DOWNLOAD_EVENTS;
    const where = this.buildWhere({ from, to });
    where.eventName = { in: eventNames };
    const rows = await prisma.analyticsEvent.groupBy({
      by: ['contentName', 'contentType', 'contentId'],
      where,
      _count: { _all: true },
      orderBy: { _count: { contentName: 'desc' } },
      take: Math.min(50, Math.max(1, Number(limit) || 10)),
    });
    return rows
      .filter((row) => row.contentName)
      .map((row) => ({
        contentName: row.contentName,
        contentType: row.contentType,
        contentId: row.contentId,
        count: row._count._all,
      }));
  },

  async getTopSocial({ from, to, limit = 10 }) {
    const where = this.buildWhere({ from, to });
    where.eventName = { in: SOCIAL_EVENTS };
    const rows = await prisma.analyticsEvent.groupBy({
      by: ['eventName'],
      where,
      _count: { _all: true },
      orderBy: { _count: { eventName: 'desc' } },
      take: Math.min(10, Math.max(1, Number(limit) || 10)),
    });
    return rows.map((row) => ({ platform: row.eventName, count: row._count._all }));
  },

  async getEventBreakdown({ from, to, limit = 20 }) {
    const where = this.buildWhere({ from, to });
    const rows = await prisma.analyticsEvent.groupBy({
      by: ['eventName'],
      where,
      _count: { _all: true },
      orderBy: { _count: { eventName: 'desc' } },
      take: Math.min(50, Math.max(1, Number(limit) || 20)),
    });
    return rows.map((row) => ({ event: row.eventName, count: row._count._all }));
  },

  async getDeviceBreakdown({ from, to }) {
    const where = this.buildWhere({ from, to });
    const rows = await prisma.analyticsEvent.groupBy({
      by: ['deviceCategory'],
      where,
      _count: { _all: true },
    });
    return rows
      .filter((row) => row.deviceCategory)
      .map((row) => ({ device: row.deviceCategory, count: row._count._all }));
  },

  async getContentTypeBreakdown({ from, to }) {
    const where = this.buildWhere({ from, to });
    const rows = await prisma.analyticsEvent.groupBy({
      by: ['contentType'],
      where,
      _count: { _all: true },
    });
    return rows
      .filter((row) => row.contentType)
      .map((row) => ({ contentType: row.contentType, count: row._count._all }));
  },

  async getRecentEvents({ from, to, limit = 50 }) {
    const where = this.buildWhere({ from, to });
    return prisma.analyticsEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, Number(limit) || 50)),
      select: {
        id: true,
        eventName: true,
        route: true,
        contentType: true,
        contentId: true,
        contentName: true,
        deviceCategory: true,
        createdAt: true,
        visitorId: true,
        userId: true,
      },
    });
  },
};
