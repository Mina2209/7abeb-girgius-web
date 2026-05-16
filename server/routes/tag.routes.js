import { Router } from 'express';
import { TagController } from '../controllers/tag.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public GET routes
router.get('/', TagController.getAll);
router.get('/:id', TagController.getById);

// Protected routes - require authentication and ADMIN role only (editors cannot edit tags)
router.post('/', authenticate, requireAdmin, TagController.create);
router.put('/:id', authenticate, requireAdmin, TagController.update);
router.delete('/:id', authenticate, requireAdmin, TagController.delete);

export default router;
