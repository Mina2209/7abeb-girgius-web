import { Router } from 'express';
import { LyricController } from '../controllers/lyric.controller.js';
import { authenticate, requireEditor } from '../middleware/auth.js';

const router = Router();

// Public GET routes
router.get('/', LyricController.getAll);
router.get('/search', LyricController.search);
router.get('/hymn/:hymnId', LyricController.getByHymnId);
router.get('/:id', LyricController.getById);

// Protected routes - require authentication and editor/admin role
router.put('/hymn/:hymnId', authenticate, requireEditor, LyricController.upsert);
router.delete('/hymn/:hymnId', authenticate, requireEditor, LyricController.deleteByHymnId);

export default router;
