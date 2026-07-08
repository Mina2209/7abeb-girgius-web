import { Router } from 'express';
import { FavoriteController } from '../controllers/favorite.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All favorites routes require authentication
router.get('/', authenticate, FavoriteController.getAll);
router.get('/:contentType', authenticate, FavoriteController.getByType);
router.post('/:contentType/:contentId/toggle', authenticate, FavoriteController.toggle);

export default router;
