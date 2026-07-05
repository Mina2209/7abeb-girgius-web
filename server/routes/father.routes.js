import { Router } from 'express';
import { FatherController } from '../controllers/father.controller.js';
import { authenticate, requireEditor } from '../middleware/auth.js';

const router = Router();

router.get('/', FatherController.getAll);
router.get('/by-name/:name', FatherController.getByName);
router.get('/:id', FatherController.getById);

router.post('/', authenticate, requireEditor, FatherController.create);
router.put('/:id', authenticate, requireEditor, FatherController.update);
router.delete('/:id', authenticate, requireEditor, FatherController.delete);

export default router;
