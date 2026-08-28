import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { HymnController } from '../controllers/hymn.controller.js';
import { authenticate, requireEditor } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Per-IP rate limit for zip downloads: 10 per hour. Prevents S3/CPU abuse from
// repeated large bundle requests. The global limiter (500/15min) is too generous
// for this expensive endpoint.
const zipDownloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many download requests. Please try again later.' },
});

// Public GET routes
router.get('/', HymnController.getAll);
// Must be registered before '/:id' so '/zip' isn't captured as an id param.
router.get('/zip', zipDownloadLimiter, HymnController.downloadZip);
router.get('/:id', HymnController.getById);

// Protected routes - require authentication and editor/admin role
router.post('/', authenticate, requireEditor, validate({ title: 'string', files: 'array?', tags: 'array?' }), HymnController.create);
router.put('/:id', authenticate, requireEditor, validate({ title: 'string', files: 'array?', tags: 'array?' }), HymnController.update);
router.delete('/:id', authenticate, requireEditor, HymnController.delete);

export default router;