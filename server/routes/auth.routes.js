import express from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public route - no authentication required
router.post('/login', authController.login);

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
