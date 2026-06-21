import express from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Throttle login to slow down brute-force/password-guessing.
// Only FAILED attempts count, so normal users logging in are never penalized.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // per IP, per window
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a few minutes.' },
});

// Public route - no authentication required (but rate limited)
router.post('/login', loginLimiter, authController.login);

// Protected routes - require authentication and admin role
router.post('/users', authenticate, requireAdmin, authController.createUser);
router.get('/users', authenticate, requireAdmin, authController.getAllUsers);
router.get('/users/:id', authenticate, requireAdmin, authController.getUserById);
router.put('/users/:id', authenticate, requireAdmin, authController.updateUser);
router.delete('/users/:id', authenticate, requireAdmin, authController.deleteUser);

// Log routes - admin only
router.get('/logs', authenticate, requireAdmin, authController.getAllLogs);
router.get('/logs/user/:userId', authenticate, requireAdmin, authController.getLogsByUserId);

export default router;
