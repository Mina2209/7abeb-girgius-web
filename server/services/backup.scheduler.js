import { BackupService } from './backup.service.js';

/**
 * Simple scheduler for automatic backups
 * Uses setInterval instead of node-cron to avoid additional dependencies
 */

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
      console.log('Backup scheduler is already running');
      return;
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    console.log(`Starting backup scheduler: every ${intervalHours} hours, keeping ${keepCount} backups`);

    // Run backup immediately on start (optional - comment out if not needed)
    // this.runBackup(keepCount);

    // Schedule regular backups
    schedulerInterval = setInterval(() => {
      this.runBackup(keepCount);
    }, intervalMs);

    // Also schedule for a specific time (e.g., 3 AM daily)
    this.scheduleAtTime(3, 0, () => this.runBackup(keepCount));

    console.log('Backup scheduler started');
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

    console.log(`Next scheduled backup at: ${scheduledTime.toISOString()}`);

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
      console.log('Backup already in progress, skipping...');
      return;
    }

    isRunning = true;
    const startTime = Date.now();

    try {
      console.log('=== Automatic backup started ===');
      console.log(`Time: ${new Date().toISOString()}`);

      // Create backup
      const result = await BackupService.createBackup();
      console.log(`Backup created: ${result.filename}`);
      console.log(`Size: ${(result.size / 1024).toFixed(2)} KB`);

      // Cleanup old backups
      const deleted = await BackupService.cleanupOldBackups(keepCount);
      if (deleted.length > 0) {
        console.log(`Cleaned up ${deleted.length} old backups`);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`=== Automatic backup completed in ${duration}s ===`);

      return result;
    } catch (error) {
      console.error('=== Automatic backup failed ===');
      console.error(error.message);
      throw error;
    } finally {
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
      console.log('Backup scheduler stopped');
    }
  },

  /**
   * Check if scheduler is running
   */
  isActive() {
    return schedulerInterval !== null;
  },

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isActive: this.isActive(),
      isBackupRunning: isRunning
    };
  }
};

export default BackupScheduler;
