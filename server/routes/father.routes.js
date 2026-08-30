import { Router } from 'express';
import { FatherController } from '../controllers/father.controller.js';
import { authenticate, requireEditor } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', FatherController.getAll);
router.get('/by-name/:name', FatherController.getByName);
router.get('/:id', FatherController.getById);

router.post('/', authenticate, requireEditor, validate({ name: 'string:255', 'title?': 'string:255', 'bio?': 'string:10000', 'profileImage?': 'string:2000' }), FatherController.create);
  router.put('/:id', authenticate, requireEditor, validate({ name: 'string:255', 'title?': 'string:255', 'bio?': 'string:10000', 'profileImage?': 'string:2000' }), FatherController.update);
router.delete('/:id', authenticate, requireEditor, FatherController.delete);

export default router;
