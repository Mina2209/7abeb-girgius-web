import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AdminActivityController } from '../controllers/adminActivity.controller.js';
import { authenticate, optionalAuthenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Bounded public write endpoint: prevents a runaway/abusive browser from flooding
// the UserActivity table. 120 events/min per IP is far beyond normal usage.
const activityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many activity events. Please try again shortly.' },
});

// Public write endpoint — anonymous visitors need to record their activity.
// optionalAuthenticate attaches req.user when a valid JWT is present so the
// server can derive the authenticated identity; it never rejects anonymous users.
router.post('/events', activityLimiter, optionalAuthenticate, AdminActivityController.record);

// All read endpoints are admin-only. Backend authorization is authoritative —
// frontend route guards are never relied on for security.
router.use(authenticate);
router.use(requireAdmin);

router.get('/', AdminActivityController.list);
router.get('/overview', AdminActivityController.overview);
router.get('/users', AdminActivityController.users);
router.get('/actions', AdminActivityController.actions);
router.get('/recent', AdminActivityController.recent);

export default router;
