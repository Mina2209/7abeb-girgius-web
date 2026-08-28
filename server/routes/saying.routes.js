import { Router } from 'express';
import { SayingController } from '../controllers/saying.controller.js';
import { authenticate, requireEditor } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Public GET routes
router.get('/', SayingController.getAll);
router.get('/:id', SayingController.getById);

// Protected routes - require authentication and editor/admin role
router.post('/', authenticate, requireEditor, validate({ author: 'string', content: 'string', authorImage: 'string?', source: 'string?', tags: 'array?' }), SayingController.create);
router.post('/bulk-import', authenticate, requireEditor, SayingController.bulkImport);
router.put('/:id', authenticate, requireEditor, validate({ author: 'string', content: 'string', authorImage: 'string?', source: 'string?', tags: 'array?' }), SayingController.update);
router.delete('/:id', authenticate, requireEditor, SayingController.delete);

export default router;
