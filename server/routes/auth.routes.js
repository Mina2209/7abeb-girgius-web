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

// Public routes - no authentication required
// Fix #2: Registration rate limiter to prevent mass account creation.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // per IP, per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

// Throttle password reset requests to prevent abuse / lockout flooding.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // per IP, per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات استعادة كلمة المرور كثيرة جداً. يرجى المحاولة لاحقاً.' },
});

router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);

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
