import express from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Protected: must be authenticated
router.put('/password', authenticate, authController.changePassword);

export default router;