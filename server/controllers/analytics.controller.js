import { analyticsService, AnalyticsValidationError } from '../services/analytics.service.js';

// Controller for first-party analytics. Read endpoints are admin-only (enforced in
// the router via requireAdmin). The public write endpoint is intentionally bounded
// and never lets analytics failures propagate to the website.
export const AnalyticsController = {
  // POST /api/analytics/events — public, fire-and-forget from the browser.
  record: async (req, res) => {
    try {
      await analyticsService.recordEvent(req.body);
      res.status(200).json({ ok: true });
    } catch (err) {
      if (err instanceof AnalyticsValidationError) {
        return res.status(400).json({ error: err.message });
      }
      // Unexpected DB error: swallow it so analytics can never break the website.
      console.error('Analytics record failed (swallowed):', err);
      res.status(200).json({ ok: true });
    }
  },

  // GET /api/analytics/overview
  overview: async (req, res) => {
    const data = await analyticsService.getOverview(req.query);
    res.json(data);
  },

  // GET /api/analytics/timeseries?metric=page_views|sessions|downloads|events
  timeseries: async (req, res) => {
    const data = await analyticsService.getTimeseries(req.query);
    res.json(data);
  },

  // GET /api/analytics/pages
  topPages: async (req, res) => {
    const data = await analyticsService.getTopPages(req.query);
    res.json(data);
  },

  // GET /api/analytics/content?event=download|favorite|view
  topContent: async (req, res) => {
    const data = await analyticsService.getTopContent(req.query);
    res.json(data);
  },

  // GET /api/analytics/social
  topSocial: async (req, res) => {
    const data = await analyticsService.getTopSocial(req.query);
    res.json(data);
  },

  // GET /api/analytics/events
  eventBreakdown: async (req, res) => {
    const data = await analyticsService.getEventBreakdown(req.query);
    res.json(data);
  },

  // GET /api/analytics/devices
  deviceBreakdown: async (req, res) => {
    const data = await analyticsService.getDeviceBreakdown(req.query);
    res.json(data);
  },

  // GET /api/analytics/content-types
  contentTypeBreakdown: async (req, res) => {
    const data = await analyticsService.getContentTypeBreakdown(req.query);
    res.json(data);
  },

  // GET /api/analytics/recent
  recentEvents: async (req, res) => {
    const data = await analyticsService.getRecentEvents(req.query);
    res.json(data);
  },
};
