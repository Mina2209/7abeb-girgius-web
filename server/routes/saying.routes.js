import { Router } from 'express';
import { SayingController } from '../controllers/saying.controller.js';
import { authenticate, requireEditor } from '../middleware/auth.js';

const router = Router();

// Public GET routes
router.get('/', SayingController.getAll);
router.get('/:id', SayingController.getById);

// Protected routes - require authentication and editor/admin role
router.post('/', authenticate, requireEditor, SayingController.create);
router.put('/:id', authenticate, requireEditor, SayingController.update);
router.delete('/:id', authenticate, requireEditor, SayingController.delete);

export default router;
