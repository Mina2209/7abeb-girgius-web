import { Router } from 'express';
import { TagSectionController } from '../controllers/tagSection.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public GET routes
router.get('/', TagSectionController.getAll);
router.get('/:id', TagSectionController.getById);

// Protected routes - require ADMIN (specific paths before param routes)
router.put('/reorder/batch', authenticate, requireAdmin, TagSectionController.reorder);
router.post('/', authenticate, requireAdmin, TagSectionController.create);
router.put('/:id', authenticate, requireAdmin, TagSectionController.update);
router.delete('/:id', authenticate, requireAdmin, TagSectionController.delete);

export default router;
