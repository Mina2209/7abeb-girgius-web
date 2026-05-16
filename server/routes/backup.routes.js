import { Router } from 'express';
import { BackupController } from '../controllers/backup.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All backup routes require admin authentication
router.use(authenticate);
router.use(requireAdmin);

// GET /api/backup - List all backups
router.get('/', BackupController.listBackups);

// GET /api/backup/status - Get backup system status
router.get('/status', BackupController.getStatus);

// POST /api/backup - Create a new backup
router.post('/', BackupController.createBackup);

// GET /api/backup/download - Get download URL for a backup (key passed as query param)
router.get('/download', BackupController.getDownloadUrl);

// DELETE /api/backup - Delete a backup (key passed as query param)
router.delete('/delete', BackupController.deleteBackup);

// POST /api/backup/cleanup - Clean up old backups
router.post('/cleanup', BackupController.cleanupBackups);

export default router;
