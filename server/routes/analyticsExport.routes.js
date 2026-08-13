import { Router } from 'express';
import { AnalyticsExportController } from '../controllers/analyticsExport.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

// Admin-only analytics data export. Backend authorization is authoritative —
// every endpoint requires a valid JWT AND the ADMIN role. These endpoints are
// never exposed publicly.
const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/events', AnalyticsExportController.events);
router.get('/summary', AnalyticsExportController.summary);
router.get('/pages', AnalyticsExportController.pages);
router.get('/content', AnalyticsExportController.content);
router.get('/content-types', AnalyticsExportController.contentTypes);
router.get('/devices', AnalyticsExportController.devices);
router.get('/social', AnalyticsExportController.social);
router.get('/activity', AnalyticsExportController.activity);
router.get('/activity-summary', AnalyticsExportController.activitySummary);
router.get('/full', AnalyticsExportController.full);

export default router;
