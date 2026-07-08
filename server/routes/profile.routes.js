import express from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Protected: must be authenticated
router.get('/', authenticate, authController.getProfile);
router.put('/', authenticate, authController.updateProfile);

export default router;

