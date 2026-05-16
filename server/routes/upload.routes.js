import { Router } from 'express';
import { authenticate, requireEditor } from '../middleware/auth.js';
import UploadController from '../controllers/upload.controller.js';

const router = Router();

// All upload routes require authentication
// bind controller methods to routes
router.post('/presign', authenticate, requireEditor, UploadController.presign);
router.get('/url', UploadController.url); // Public - for viewing files
router.delete('/:key', authenticate, requireEditor, UploadController.remove);

// multipart - require authentication
router.post('/multipart/initiate', authenticate, requireEditor, UploadController.initiateMultipart);
router.post('/multipart/presign-part', authenticate, requireEditor, UploadController.presignPart);
router.post('/multipart/complete', authenticate, requireEditor, UploadController.completeMultipart);
router.post('/multipart/abort', authenticate, requireEditor, UploadController.abortMultipart);

export default router;
