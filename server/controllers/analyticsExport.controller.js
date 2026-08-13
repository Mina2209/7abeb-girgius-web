import { analyticsExportService, toCsv } from '../services/analyticsExport.service.js';
import { logService } from '../services/log.service.js';

// Admin-only export endpoints. Authorization is enforced in the router
// (authenticate + requireAdmin); the controller never trusts the client.
//
// Every handler resolves + validates the date range BEFORE touching the
// response, so validation errors reach the centralized errorHandler as HTTP 400
// (the JSON error body is sent before any streaming starts).

const CSV_HEADERS = {
  'Content-Type': 'text/csv; charset=utf-8',
  'Cache-Control': 'no-store',
};

function applyRangeHeaders(res, meta) {
  res.set({
    'X-Export-Timezone': 'UTC',
    'X-Export-Range': meta.label,
    'X-Export-From': meta.range.gte.toISOString(),
    'X-Export-To': meta.range.lte.toISOString(),
    'X-Export-Rows': String(meta.total ?? ''),
    ...(meta.truncated ? { 'X-Export-Truncated': 'true' } : {}),
  });
}

function setCsvDisposition(res, filename) {
  res.set({
    ...CSV_HEADERS,
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
}

function setJsonHeaders(res) {
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
}

// Only 'json' and 'csv' are valid for single-dataset exports (zip is reserved
// for the full export). Anything else -> 400 before any response is started.
function assertSingleFormat(query) {
  const format = query?.format;
  if (format === undefined || format === null || format === '') return 'csv';
  if (format !== 'csv' && format !== 'json') {
    const error = new Error(`Invalid export format: ${format}. Use csv or json.`);
    error.status = 400;
    throw error;
  }
  return format;
}

function isJson(query) {
  return assertSingleFormat(query) === 'json';
}

// Best-effort admin audit through the EXISTING Log system. Never throws, never
// creates UserActivity records, and never contaminates public analytics.
async function auditExport(req, entity, range) {
  try {
    if (req.user?.id) {
      await logService.createLog(
        req.user.id,
        'EXPORT',
        entity,
        null,
        `Exported ${entity} data (${range.label})`,
      );
    }
  } catch {
    // Audit logging must never break an export.
  }
}

async function streamCsv(res, generator, prepared, filename) {
  setCsvDisposition(res, filename);
  applyRangeHeaders(res, prepared);
  for await (const chunk of generator) {
    res.write(chunk, 'utf8');
  }
  res.end();
}

// Respond for the small buffered aggregate datasets: either JSON (with the same
// headers the CSV path sets) or a CSV built from { header, items }.
function sendAggregated(res, { header, items }, data, filename, query) {
  if (isJson(query)) {
    setJsonHeaders(res);
    applyRangeHeaders(res, data);
    res.json(data.payload);
    return;
  }
  setCsvDisposition(res, filename);
  applyRangeHeaders(res, data);
  const rows = items(data).map((it) => Object.values(it));
  res.send(toCsv(header, rows));
}

export const AnalyticsExportController = {
  // GET /api/admin/analytics/export/events
  events: async (req, res) => {
    const prepared = await analyticsExportService.prepareEvents(req.query);
    await auditExport(req, 'ANALYTICS_EVENTS', prepared);
    const filename = `analytics-events-${prepared.label}.csv`;

    if (isJson(req.query)) {
      setJsonHeaders(res);
      applyRangeHeaders(res, prepared);
      res.json(await analyticsExportService.getEventsJson(prepared));
      return;
    }
    await streamCsv(res, analyticsExportService.streamEventsCsv(prepared), prepared, filename);
  },

  // GET /api/admin/analytics/export/summary
  summary: async (req, res) => {
    const data = await analyticsExportService.getSummary(req.query);
    data.payload = {
      range: data.label,
      from: data.range.gte.toISOString(),
      to: data.range.lte.toISOString(),
      days: data.days,
    };
    await auditExport(req, 'ANALYTICS_SUMMARY', data);
    sendAggregated(
      res,
      {
        header: ['date', 'pageViews', 'uniqueVisitors', 'sessions', 'downloads', 'contentViews', 'searches', 'shares', 'favoritesAdded', 'favoritesRemoved', 'socialClicks', 'cardVisits', 'cardLinkClicks', 'cardSocialClicks'],
        items: (d) => d.days,
      },
      data,
      `analytics-summary-${data.label}.csv`,
      req.query,
    );
  },

  // GET /api/admin/analytics/export/pages
  pages: async (req, res) => {
    const data = await analyticsExportService.getTopPages(req.query);
    data.payload = {
      range: data.label,
      from: data.range.gte.toISOString(),
      to: data.range.lte.toISOString(),
      items: data.items,
    };
    await auditExport(req, 'ANALYTICS_TOP_PAGES', data);
    sendAggregated(
      res,
      {
        header: ['rank', 'route', 'views', 'uniqueVisitors'],
        items: (d) => d.items,
      },
      data,
      `top-pages-${data.label}.csv`,
      req.query,
    );
  },

  // GET /api/admin/analytics/export/content
  content: async (req, res) => {
    const data = await analyticsExportService.getTopContent(req.query);
    data.payload = {
      range: data.label,
      from: data.range.gte.toISOString(),
      to: data.range.lte.toISOString(),
      items: data.items,
    };
    await auditExport(req, 'ANALYTICS_TOP_CONTENT', data);
    sendAggregated(
      res,
      {
        header: ['rank', 'contentType', 'contentId', 'contentName', 'views', 'downloads', 'favorites'],
        items: (d) => d.items,
      },
      data,
      `top-content-${data.label}.csv`,
      req.query,
    );
  },

  // GET /api/admin/analytics/export/content-types
  contentTypes: async (req, res) => {
    const data = await analyticsExportService.getContentTypes(req.query);
    data.payload = {
      range: data.label,
      from: data.range.gte.toISOString(),
      to: data.range.lte.toISOString(),
      items: data.items,
    };
    await auditExport(req, 'ANALYTICS_CONTENT_TYPES', data);
    sendAggregated(
      res,
      {
        header: ['contentType', 'count', 'percentage'],
        items: (d) => d.items,
      },
      data,
      `content-types-${data.label}.csv`,
      req.query,
    );
  },

  // GET /api/admin/analytics/export/devices
  devices: async (req, res) => {
    const data = await analyticsExportService.getDevices(req.query);
    data.payload = {
      range: data.label,
      from: data.range.gte.toISOString(),
      to: data.range.lte.toISOString(),
      items: data.items,
    };
    await auditExport(req, 'ANALYTICS_DEVICES', data);
    sendAggregated(
      res,
      {
        header: ['deviceCategory', 'count', 'percentage'],
        items: (d) => d.items,
      },
      data,
      `devices-${data.label}.csv`,
      req.query,
    );
  },

  // GET /api/admin/analytics/export/social
  social: async (req, res) => {
    const data = await analyticsExportService.getSocial(req.query);
    data.payload = {
      range: data.label,
      from: data.range.gte.toISOString(),
      to: data.range.lte.toISOString(),
      items: data.items,
    };
    await auditExport(req, 'ANALYTICS_SOCIAL', data);
    sendAggregated(
      res,
      {
        header: ['platform', 'clicks', 'percentage'],
        items: (d) => d.items,
      },
      data,
      `social-${data.label}.csv`,
      req.query,
    );
  },

  // GET /api/admin/analytics/export/activity
  activity: async (req, res) => {
    const prepared = await analyticsExportService.prepareActivity(req.query);
    await auditExport(req, 'USER_ACTIVITY', prepared);
    const filename = `user-activity-${prepared.label}.csv`;

    if (isJson(req.query)) {
      setJsonHeaders(res);
      applyRangeHeaders(res, prepared);
      res.json(await analyticsExportService.getActivityJson(prepared));
      return;
    }
    await streamCsv(res, analyticsExportService.streamActivityCsv(prepared), prepared, filename);
  },

  // GET /api/admin/analytics/export/activity-summary
  activitySummary: async (req, res) => {
    const data = await analyticsExportService.getUserActivitySummary(req.query);
    data.payload = {
      range: data.label,
      from: data.range.gte.toISOString(),
      to: data.range.lte.toISOString(),
      items: data.items,
    };
    await auditExport(req, 'USER_ACTIVITY_SUMMARY', data);
    sendAggregated(
      res,
      {
        header: ['userId', 'visitorId', 'username', 'name', 'visitorType', 'firstActivityAt', 'lastActivityAt', 'totalActivities', 'views', 'downloads', 'searches', 'favoritesAdded', 'favoritesRemoved', 'shares', 'socialClicks', 'cardLinkClicks', 'cardSocialClicks', 'authActions'],
        items: (d) => d.items,
      },
      data,
      `activity-summary-${data.label}.csv`,
      req.query,
    );
  },

  // GET /api/admin/analytics/export/full
  full: async (req, res) => {
    if (req.query.format !== undefined && req.query.format !== '' && req.query.format !== 'zip') {
      const error = new Error(`Invalid export format: ${req.query.format}. The full export is only available as zip.`);
      error.status = 400;
      throw error;
    }
    const { stream, meta } = await analyticsExportService.buildFullZip(req.query);
    await auditExport(req, 'ANALYTICS_FULL', meta);
    res.set({
      'Content-Type': 'application/zip',
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="analytics-export-${meta.label}.zip"`,
      'X-Export-Timezone': 'UTC',
      'X-Export-Range': meta.label,
      'X-Export-From': meta.from.toISOString(),
      'X-Export-To': meta.to.toISOString(),
      ...(meta.truncated ? { 'X-Export-Truncated': 'true' } : {}),
    });
    stream.pipe(res);
  },
};
