import { BackupService } from './backup.service.js';
import { logService } from './log.service.js';
import { logger } from './logger.js';

/**
 * Simple scheduler for automatic backups
 * Uses setInterval instead of node-cron to avoid additional dependencies
 */

// Activity logs older than this are pruned each backup cycle. Override via env.
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS) || 90;

let schedulerInterval = null;
let isRunning = false;

export const BackupScheduler = {
  /**
   * Start the automatic backup scheduler
   * @param {number} intervalHours - Hours between backups (default 24)
   * @param {number} keepCount - Number of backups to keep (default 7)
   */
  start(intervalHours = 24, keepCount = 7) {
    if (schedulerInterval) {
      logger.warn('Backup scheduler is already running');
      return;
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    logger.info('Starting backup scheduler', { intervalHours, keepCount });

    // Run backup immediately on start (optional - comment out if not needed)
    // this.runBackup(keepCount);

    // Schedule regular backups
    schedulerInterval = setInterval(() => {
      this.runBackup(keepCount);
    }, intervalMs);

    // Also schedule for a specific time (e.g., 3 AM daily)
    this.scheduleAtTime(3, 0, () => this.runBackup(keepCount));

    logger.info('Backup scheduler started');
  },

  /**
   * Schedule a task to run at a specific time each day
   * @param {number} hour - Hour (0-23)
   * @param {number} minute - Minute (0-59)
   * @param {Function} task - Task to run
   */
  scheduleAtTime(hour, minute, task) {
    const now = new Date();
    let scheduledTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      0,
      0
    );

    // If the time has already passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const msUntilScheduled = scheduledTime - now;

    logger.info('Next scheduled backup', { time: scheduledTime.toISOString() });

    setTimeout(() => {
      task();
      // Schedule for the next day
      setInterval(task, 24 * 60 * 60 * 1000);
    }, msUntilScheduled);
  },

  /**
   * Run a backup and cleanup old backups
   * @param {number} keepCount - Number of backups to keep
   */
  async runBackup(keepCount = 7) {
    if (isRunning) {
      logger.warn('Backup already in progress, skipping');
      return;
    }

    isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Automatic backup started');

      // Create backup
      const result = await BackupService.createBackup();
      logger.info('Backup created', { filename: result.filename, sizeKB: (result.size / 1024).toFixed(2) });

      // Cleanup old backups
      const deleted = await BackupService.cleanupOldBackups(keepCount);
      if (deleted.length > 0) {
        logger.info('Cleaned up old backups', { count: deleted.length });
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info('Automatic backup completed', { duration: `${duration}s` });

      return result;
    } catch (error) {
      logger.error('Automatic backup failed', { error: error.message });
      throw error;
    } finally {
      // Prune old activity logs each cycle, independent of backup success/failure.
      try {
        const removed = await logService.deleteOldLogs(LOG_RETENTION_DAYS);
        if (removed > 0) {
          logger.info('Pruned old activity logs', { removed, retentionDays: LOG_RETENTION_DAYS });
        }
      } catch (e) {
        logger.error('Log retention cleanup failed', { error: e.message });
      }
      isRunning = false;
    }
  },

  /**
   * Stop the backup scheduler
   */
  stop() {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
      logger.info('Backup scheduler stopped');
    }
  },
};

export default BackupScheduler;
