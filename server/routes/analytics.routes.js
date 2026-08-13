import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AnalyticsController } from '../controllers/analytics.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Bounded public write endpoint: prevents a runaway/abusive browser from flooding
// the events table. 120 events/min per IP is far beyond normal usage.
const eventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many analytics events. Please try again shortly.' },
});

// Public write endpoint — anonymous visitors need to record usage.
router.post('/events', eventLimiter, AnalyticsController.record);

// All read/aggregation endpoints are admin-only.
router.use(authenticate);
router.use(requireAdmin);

router.get('/overview', AnalyticsController.overview);
router.get('/timeseries', AnalyticsController.timeseries);
router.get('/pages', AnalyticsController.topPages);
router.get('/content', AnalyticsController.topContent);
router.get('/social', AnalyticsController.topSocial);
router.get('/events', AnalyticsController.eventBreakdown);
router.get('/devices', AnalyticsController.deviceBreakdown);
router.get('/content-types', AnalyticsController.contentTypeBreakdown);
router.get('/recent', AnalyticsController.recentEvents);

export default router;
