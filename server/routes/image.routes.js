import { Router } from 'express';
import { ImageController } from '../controllers/image.controller.js';
import { authenticate, requireEditor } from '../middleware/auth.js';

const router = Router();

// Meta endpoints (must be before /:id to avoid conflict)
router.get('/meta/authors', ImageController.getAuthors);
router.post('/meta/authors', authenticate, requireEditor, ImageController.createAuthor);
router.delete('/meta/authors/:id', authenticate, requireEditor, ImageController.deleteAuthor);
router.get('/meta/types', ImageController.getTypes);
router.post('/meta/types', authenticate, requireEditor, ImageController.createType);
router.delete('/meta/types/:id', authenticate, requireEditor, ImageController.deleteType);

// Public GET routes
router.get('/', ImageController.getAll);
router.get('/:id', ImageController.getById);

// Protected routes - require authentication and editor/admin role
router.post('/', authenticate, requireEditor, ImageController.create);
router.put('/:id', authenticate, requireEditor, ImageController.update);
router.delete('/:id', authenticate, requireEditor, ImageController.delete);

export default router;
