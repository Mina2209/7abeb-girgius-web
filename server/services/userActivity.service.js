import { prisma } from './prisma.js';

// ---------------------------------------------------------------------------
// User activity / audit log service — SEPARATE concern from AnalyticsEvent.
//
// AnalyticsEvent  -> aggregate, anonymous-first statistics for the public
//                    Analytics dashboard.
// UserActivity    -> audit trail answering "which authenticated user did what,
//                    when, where" plus anonymous visitor activity.
//
// Recording:
//   - Whitelisted action names only.
//   - userId is ALWAYS server-derived from the JWT (req.user.id). A client-
//     supplied userId is never accepted.
//   - Metadata is sanitized (scalar values only, length caps, no search text,
//     no credentials, no arbitrary nested objects).
//   - Fails closed and silently: a bad event must never crash the app.
//
// Reads are admin-only (enforced in the router). All filtering/aggregation runs
// on the database; list queries are indexed and server-side paginated.
// ---------------------------------------------------------------------------

export const USER_ACTIVITY_EVENTS = new Set([
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

// Safe user info exposed to the admin dashboard only. Never password/tokens.
export const USER_ACTIVITY_USER_SELECT = {
  id: true,
  username: true,
  full_name: true,
  email: true,
};

const MAX_ACTION = 64;
const MAX_STRING = 500;
const MAX_ID_STRING = 100;
const MAX_CONTENT_NAME = 300;
const MAX_METADATA_KEYS = 20;
const MAX_METADATA_STRING = 500;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

// Metadata keys that are never stored — defense in depth against a malicious
// client trying to smuggle credentials/PII into the audit log. Case-insensitive.
const SENSITIVE_METADATA_KEY =
  /password|passwd|pwd|hash|token|secret|authorization|cookie|credential|jwt|api[_]?key|email|phone|ip[_]?address|ssn|credit[_]?card/i;

// Reusable validation error (named so the controller can map it to HTTP 400).
export class UserActivityValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserActivityValidationError';
    // Picked up by the centralized errorHandler -> HTTP 400.
    this.status = 400;
  }
}

function isUserActivityEnabled() {
  // Default ON (audit trail is a security feature); explicit 'false' disables.
  return process.env.USER_ACTIVITY_ENABLED !== 'false';
}

function sanitizeString(value, max = MAX_STRING) {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, max);
}

// Only scalar values are allowed inside `metadata`; anything nested is dropped
// and any key that could carry credentials/PII is never stored.
function sanitizeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out = {};
  let count = 0;
  for (const [key, val] of Object.entries(value)) {
    if (count >= MAX_METADATA_KEYS) break;
    if (SENSITIVE_METADATA_KEY.test(key)) continue;
    if (typeof val === 'string') {
      const s = sanitizeString(val, MAX_METADATA_STRING);
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

export const userActivityService = {
  // -------------------------------------------------------------------------
  // Recording
  // -------------------------------------------------------------------------

  /**
   * Validate + sanitize + persist one activity row.
   * @param {unknown} raw - request body.
   * @param {string|null} authenticatedUserId - server-derived from the JWT.
   *   The payload's own `userId` is NEVER used.
   * Returns null when recording is disabled. Throws UserActivityValidationError
   * for unknown/malformed actions. The controller swallows unexpected errors.
   */
  async recordActivity(raw, authenticatedUserId) {
    if (!isUserActivityEnabled()) return null;

    const payload = raw && typeof raw === 'object' ? raw : {};
    const action = sanitizeString(payload.action, MAX_ACTION);
    if (!action) throw new UserActivityValidationError('Activity action is required');
    if (!USER_ACTIVITY_EVENTS.has(action)) {
      throw new UserActivityValidationError(`Unknown activity action: ${action}`);
    }

    const data = {
      action,
      route: sanitizeString(payload.route, MAX_STRING),
      visitorId: sanitizeString(payload.visitorId, MAX_ID_STRING),
      sessionId: sanitizeString(payload.sessionId, MAX_ID_STRING),
      userId: authenticatedUserId || null,
      contentType: sanitizeString(payload.contentType, 64),
      contentId: sanitizeString(payload.contentId, MAX_ID_STRING),
      contentName: sanitizeString(payload.contentName, MAX_CONTENT_NAME),
      metadata: sanitizeMetadata(payload.metadata),
      deviceCategory: sanitizeString(payload.deviceCategory, 32),
      browserCategory: sanitizeString(payload.browserCategory, 32),
    };

    // Prisma ignores undefined; keep only defined keys.
    const clean = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    );

    return prisma.userActivity.create({ data: clean });
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
      if (Number.isNaN(d.getTime())) {
        throw new UserActivityValidationError(`Invalid date: ${v.slice(0, 64)}`);
      }
      return d;
    };
    const gte = parse(query?.from);
    const lte = parse(query?.to, true);
    if (gte && lte && gte > lte) {
      throw new UserActivityValidationError('Invalid date range: from must be before to');
    }
    return { gte, lte };
  },

  buildWhere({ from, to, action, userId, contentType }) {
    const { gte, lte } = this.parseRange({ from, to });
    const where = {};
    if (gte || lte) {
      where.createdAt = {};
      if (gte) where.createdAt.gte = gte;
      if (lte) where.createdAt.lte = lte;
    }
    if (action) {
      if (!USER_ACTIVITY_EVENTS.has(action)) {
        throw new UserActivityValidationError(`Unknown activity action: ${action}`);
      }
      where.action = action;
    }
    if (userId) {
      // Special server-side scopes used by the admin dashboard user filter:
      // 'authenticated' -> only rows tied to a registered account,
      // 'anonymous' / 'null' -> only anonymous visitor rows.
      if (userId === 'authenticated') {
        where.userId = { not: null };
      } else if (userId === 'anonymous' || userId === 'null') {
        where.userId = null;
      } else {
        const id = sanitizeString(userId, MAX_ID_STRING);
        if (id) where.userId = id;
      }
    }
    if (contentType) {
      // 'none' -> only rows without an attached content type (auth/social/card).
      if (contentType === 'none') {
        where.contentType = null;
      } else {
        const type = sanitizeString(contentType, 64);
        if (type) where.contentType = type;
      }
    }
    return where;
  },

  parsePagination(query) {
    const rawLimit = query?.limit;
    const rawPage = query?.page;
    let limit = DEFAULT_PAGE_SIZE;
    if (rawLimit !== undefined && rawLimit !== null && rawLimit !== '') {
      limit = Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
        throw new UserActivityValidationError(`Invalid limit: must be an integer between 1 and ${MAX_PAGE_SIZE}`);
      }
    }
    let page = 1;
    if (rawPage !== undefined && rawPage !== null && rawPage !== '') {
      page = Number(rawPage);
      if (!Number.isInteger(page) || page < 1) {
        throw new UserActivityValidationError('Invalid page: must be a positive integer');
      }
    }
    return { page, limit, skip: (page - 1) * limit };
  },

  buildUserSearch(search) {
    const term = sanitizeString(search, 100);
    if (!term) return null;
    return [
      { user: { username: { contains: term, mode: 'insensitive' } } },
      { user: { full_name: { contains: term, mode: 'insensitive' } } },
    ];
  },

  // Maps a row (with the `user` relation) to the safe admin-facing shape.
  toActivityView(row) {
    const { user, metadata, ...rest } = row;
    return {
      ...rest,
      // Read-side defense in depth: never echo credentials/PII even if a raw
      // DB row was written by a non-API path (e.g. direct Prisma or old seed).
      metadata: sanitizeMetadata(metadata),
      user: user
        ? { id: user.id, username: user.username, name: user.full_name, email: user.email }
        : null,
      visitorType: user ? 'authenticated' : 'anonymous',
    };
  },

  // -------------------------------------------------------------------------
  // Admin queries
  // -------------------------------------------------------------------------

  async listActivities({ from, to, action, userId, contentType, search, page, limit }) {
    const where = this.buildWhere({ from, to, action, userId, contentType });
    const userSearch = this.buildUserSearch(search);
    if (userSearch) where.OR = userSearch;
    const { page: p, limit: l, skip } = this.parsePagination({ page, limit });

    const [total, rows] = await Promise.all([
      prisma.userActivity.count({ where }),
      prisma.userActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
        include: { user: { select: USER_ACTIVITY_USER_SELECT } },
      }),
    ]);

    return {
      items: rows.map((row) => this.toActivityView(row)),
      page: p,
      limit: l,
      total,
      totalPages: Math.max(1, Math.ceil(total / l)),
    };
  },

  async getOverview({ from, to }) {
    const where = this.buildWhere({ from, to });
    const authenticatedWhere = { ...where, userId: { not: null } };
    const anonymousWhere = { ...where, userId: null };

    const [totalActivities, authenticatedActivities, anonymousActivities, uniqueUsers, uniqueVisitors] =
      await Promise.all([
        prisma.userActivity.count({ where }),
        prisma.userActivity.count({ where: authenticatedWhere }),
        prisma.userActivity.count({ where: anonymousWhere }),
        prisma.userActivity.groupBy({ by: ['userId'], where: authenticatedWhere })
          .then((rows) => rows.filter((row) => row.userId).length),
        prisma.userActivity.groupBy({ by: ['visitorId'], where: anonymousWhere })
          .then((rows) => rows.filter((row) => row.visitorId).length),
      ]);

    return {
      totalActivities,
      authenticatedActivities,
      anonymousActivities,
      uniqueUsers,
      uniqueVisitors,
      from: from || null,
      to: to || null,
    };
  },

  async getUsers({ from, to, search, limit = 25 }) {
    const where = this.buildWhere({ from, to });
    const authenticatedWhere = { ...where, userId: { not: null } };
    const anonymousWhere = { ...where, userId: null };
    const take = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(limit) || 25));

    const [userRows, anonymousCount] = await Promise.all([
      prisma.userActivity.groupBy({
        by: ['userId'],
        where: authenticatedWhere,
        _count: { _all: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
        orderBy: { _count: { userId: 'desc' } },
        take,
      }),
      prisma.userActivity.count({ where: anonymousWhere }),
    ]);

    const ids = userRows.map((row) => row.userId);
    const users = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: USER_ACTIVITY_USER_SELECT,
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    let items = userRows
      .filter((row) => row.userId)
      .map((row) => {
        const user = byId.get(row.userId);
        return {
          user: user
            ? { id: user.id, username: user.username, name: user.full_name, email: user.email }
            : null,
          activityCount: row._count._all,
          firstActivityAt: row._min?.createdAt ?? null,
          lastActivityAt: row._max?.createdAt ?? null,
        };
      });

    if (search) {
      const term = sanitizeString(search, 100);
      if (term) {
        items = items.filter(
          (item) =>
            item.user &&
            ((item.user.username || '').toLowerCase().includes(term.toLowerCase()) ||
              (item.user.name || '').toLowerCase().includes(term.toLowerCase())),
        );
      }
    }

    return { items, anonymousCount, totalAuthenticatedUsers: userRows.length };
  },

  async getActions({ from, to }) {
    const where = this.buildWhere({ from, to });
    const rows = await prisma.userActivity.groupBy({
      by: ['action'],
      where,
      _count: { _all: true },
      orderBy: { _count: { action: 'desc' } },
    });
    return rows.map((row) => ({ action: row.action, count: row._count._all }));
  },

  async getRecent({ limit = 25 }) {
    const take = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(limit) || 25));
    const rows = await prisma.userActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: { user: { select: USER_ACTIVITY_USER_SELECT } },
    });
    return rows.map((row) => this.toActivityView(row));
  },
};
