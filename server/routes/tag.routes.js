import { Router } from 'express';
import { TagController } from '../controllers/tag.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Public GET routes
router.get('/', TagController.getAll);
router.get('/:id', TagController.getById);

// Protected routes - require ADMIN (specific paths before param routes)
router.put('/reorder/batch', authenticate, requireAdmin, TagController.reorder);
router.post('/', authenticate, requireAdmin, validate({ name: 'string:255', 'sectionId?': 'string:255', 'order?': 'number' }), TagController.create);
router.put('/:id', authenticate, requireAdmin, validate({ name: 'string:255', 'sectionId?': 'string:255', 'order?': 'number' }), TagController.update);
router.delete('/:id', authenticate, requireAdmin, TagController.delete);

export default router;
