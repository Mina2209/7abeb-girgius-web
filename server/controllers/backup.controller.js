import { BackupService } from '../services/backup.service.js';
import { logService } from '../services/log.service.js';

export const BackupController = {
  /**
   * POST /api/backup
   * Create a manual backup and upload to S3
   */
  createBackup: async (req, res) => {
    try {
      console.log('Manual backup requested by user:', req.user?.username);
      
      const result = await BackupService.createBackup();

      // Log the action (non-blocking, don't fail if logging fails)
      if (req.user?.id) {
        try {
          await logService.createLog(
            req.user.id,
            'CREATE',
            'BACKUP',
            result.key,
            `Created backup: ${result.filename}`
          );
        } catch (logError) {
          console.warn('Failed to log backup creation:', logError.message);
        }
      }

      res.json({
        success: true,
        message: 'Backup created successfully',
        backup: {
          filename: result.filename,
          key: result.key,
          size: result.size,
          timestamp: result.timestamp
        }
      });
    } catch (error) {
      console.error('Backup creation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create backup',
        message: error.message
      });
    }
  },

  /**
   * GET /api/backup
   * List all available backups
   */
  listBackups: async (req, res) => {
    try {
      const backups = await BackupService.listBackups();
      
      res.json({
        success: true,
        count: backups.length,
        backups: backups.map(b => ({
          ...b,
          sizeFormatted: formatBytes(b.size)
        }))
      });
    } catch (error) {
      console.error('Failed to list backups:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list backups',
        message: error.message
      });
    }
  },

  /**
   * GET /api/backup/download?key=...
   * Get a presigned URL to download a backup
   */
  getDownloadUrl: async (req, res) => {
    try {
      const key = req.query.key;
      
      if (!key) {
        return res.status(400).json({
          success: false,
          error: 'Missing key parameter'
        });
      }

      // Validate key is in backups folder
      if (!key.startsWith('backups/')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid backup key'
        });
      }

      const url = await BackupService.getDownloadUrl(key);

      // Log the action (non-blocking)
      if (req.user?.id) {
        try {
          await logService.createLog(
            req.user.id,
            'DOWNLOAD',
            'BACKUP',
            key,
            `Downloaded backup: ${key}`
          );
        } catch (logError) {
          console.warn('Failed to log backup download:', logError.message);
        }
      }

      res.json({
        success: true,
        url,
        expiresIn: 3600 // 1 hour
      });
    } catch (error) {
      console.error('Failed to get download URL:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get download URL',
        message: error.message
      });
    }
  },

  /**
   * DELETE /api/backup/delete?key=...
   * Delete a backup
   */
  deleteBackup: async (req, res) => {
    try {
      const key = req.query.key;
      
      if (!key) {
        return res.status(400).json({
          success: false,
          error: 'Missing key parameter'
        });
      }

      // Validate key is in backups folder
      if (!key.startsWith('backups/')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid backup key'
        });
      }

      await BackupService.deleteBackup(key);

      // Log the action (non-blocking)
      if (req.user?.id) {
        try {
          await logService.createLog(
            req.user.id,
            'DELETE',
            'BACKUP',
            key,
            `Deleted backup: ${key}`
          );
        } catch (logError) {
          console.warn('Failed to log backup deletion:', logError.message);
        }
      }

      res.json({
        success: true,
        message: 'Backup deleted successfully'
      });
    } catch (error) {
      console.error('Failed to delete backup:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete backup',
        message: error.message
      });
    }
  },

  /**
   * POST /api/backup/cleanup
   * Clean up old backups, keeping only the most recent N
   */
  cleanupBackups: async (req, res) => {
    try {
      const keepCount = parseInt(req.body.keepCount) || 7;
      const deleted = await BackupService.cleanupOldBackups(keepCount);

      // Log the action
      if (req.user && deleted.length > 0) {
        await logService.createLog(
          req.user.id,
          'CLEANUP',
          'BACKUP',
          null,
          `Cleaned up ${deleted.length} old backups`
        );
      }

      res.json({
        success: true,
        message: `Cleaned up ${deleted.length} old backups`,
        deleted
      });
    } catch (error) {
      console.error('Failed to cleanup backups:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup backups',
        message: error.message
      });
    }
  },

  /**
   * GET /api/backup/status
   * Get backup system status (for health checks)
   */
  getStatus: async (req, res) => {
    try {
      const backups = await BackupService.listBackups();
      const latestBackup = backups[0] || null;

      res.json({
        success: true,
        status: 'operational',
        totalBackups: backups.length,
        latestBackup: latestBackup ? {
          filename: latestBackup.filename,
          timestamp: latestBackup.lastModified,
          size: formatBytes(latestBackup.size)
        } : null
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        status: 'error',
        error: error.message
      });
    }
  }
};

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default BackupController;
