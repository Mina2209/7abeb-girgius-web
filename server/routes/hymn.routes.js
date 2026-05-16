import { Router } from 'express';
import { HymnController } from '../controllers/hymn.controller.js';
import { authenticate, requireEditor } from '../middleware/auth.js';

const router = Router();

// Public GET routes
router.get('/', HymnController.getAll);
router.get('/:id', HymnController.getById);

// Protected routes - require authentication and editor/admin role
router.post('/', authenticate, requireEditor, HymnController.create);
router.put('/:id', authenticate, requireEditor, HymnController.update);
router.delete('/:id', authenticate, requireEditor, HymnController.delete);

export default router;
