import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const execAsync = promisify(exec);

// S3 configuration
const region = process.env.AWS_REGION;
const bucket = process.env.AWS_S3_BUCKET;
const BACKUP_PREFIX = 'backups/';

// Database configuration from DATABASE_URL
function parseDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  
  // Format: postgresql://user:password@host:port/database
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) throw new Error('Invalid DATABASE_URL format');
  
  return {
    user: decodeURIComponent(match[1]),
    password: decodeURIComponent(match[2]), // Decode URL-encoded password
    host: match[3],
    port: match[4],
    database: match[5].split('?')[0] // Remove query params if any
  };
}

const s3 = new S3Client({ region });

export const BackupService = {
  /**
   * Create a database backup using pg_dump
   * @returns {Promise<{filename: string, filepath: string, size: number}>}
   */
  async createLocalBackup() {
    const db = parseDatabaseUrl();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${db.database}-${timestamp}.sql`;
    const backupDir = path.join(process.cwd(), 'backups');
    const filepath = path.join(backupDir, filename);

    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Set PGPASSWORD environment variable for pg_dump
    const env = { ...process.env, PGPASSWORD: db.password };

    // Run pg_dump
    const command = `pg_dump -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -F p -f "${filepath}"`;
    
    try {
      await execAsync(command, { env });
      
      const stats = fs.statSync(filepath);
      console.log(`Backup created: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
      
      return {
        filename,
        filepath,
        size: stats.size
      };
    } catch (error) {
      console.error('pg_dump failed:', error.message);
      throw new Error(`Backup failed: ${error.message}`);
    }
  },

  /**
   * Upload a backup file to S3
   * @param {string} filepath - Local file path
   * @param {string} filename - Filename for S3
   * @returns {Promise<{key: string, size: number}>}
   */
  async uploadToS3(filepath, filename) {
    const key = `${BACKUP_PREFIX}${filename}`;
    const fileContent = fs.readFileSync(filepath);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileContent,
      ContentType: 'application/sql',
      Metadata: {
        'backup-date': new Date().toISOString(),
        'backup-type': 'database'
      }
    });

    await s3.send(command);
    console.log(`Backup uploaded to S3: ${key}`);

    return {
      key,
      size: fileContent.length
    };
  },

  /**
   * Create backup and upload to S3
   * @param {boolean} keepLocal - Whether to keep local file after upload
   * @returns {Promise<{filename: string, key: string, size: number, timestamp: string}>}
   */
  async createBackup(keepLocal = false) {
    // Create local backup
    const { filename, filepath, size } = await this.createLocalBackup();

    // Upload to S3
    const { key } = await this.uploadToS3(filepath, filename);

    // Clean up local file unless keepLocal is true
    if (!keepLocal) {
      fs.unlinkSync(filepath);
      console.log(`Local backup file removed: ${filepath}`);
    }

    return {
      filename,
      key,
      size,
      timestamp: new Date().toISOString()
    };
  },

  /**
   * List all backups in S3
   * @returns {Promise<Array<{key: string, filename: string, size: number, lastModified: Date}>>}
   */
  async listBackups() {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: BACKUP_PREFIX
    });

    const response = await s3.send(command);
    
    if (!response.Contents) return [];

    return response.Contents
      .filter(obj => obj.Key.endsWith('.sql'))
      .map(obj => ({
        key: obj.Key,
        filename: obj.Key.replace(BACKUP_PREFIX, ''),
        size: obj.Size,
        lastModified: obj.LastModified
      }))
      .sort((a, b) => b.lastModified - a.lastModified); // Most recent first
  },

  /**
   * Get a presigned download URL for a backup
   * @param {string} key - S3 key of the backup
   * @param {number} expiresIn - URL expiration in seconds (default 1 hour)
   * @returns {Promise<string>}
   */
  async getDownloadUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });

    const url = await getSignedUrl(s3, command, { expiresIn });
    return url;
  },

  /**
   * Delete a backup from S3
   * @param {string} key - S3 key of the backup to delete
   */
  async deleteBackup(key) {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    });

    await s3.send(command);
    console.log(`Backup deleted from S3: ${key}`);
  },

  /**
   * Delete old backups, keeping only the most recent N backups
   * @param {number} keepCount - Number of backups to keep
   */
  async cleanupOldBackups(keepCount = 7) {
    const backups = await this.listBackups();
    
    if (backups.length <= keepCount) {
      console.log(`No backups to clean up (${backups.length} backups, keeping ${keepCount})`);
      return [];
    }

    const toDelete = backups.slice(keepCount);
    const deleted = [];

    for (const backup of toDelete) {
      await this.deleteBackup(backup.key);
      deleted.push(backup.filename);
    }

    console.log(`Cleaned up ${deleted.length} old backups`);
    return deleted;
  },

  /**
   * Restore database from a backup file
   * @param {string} filepath - Path to the backup file
   */
  async restoreFromFile(filepath) {
    const db = parseDatabaseUrl();
    const env = { ...process.env, PGPASSWORD: db.password };

    const command = `psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -f "${filepath}"`;
    
    try {
      await execAsync(command, { env });
      console.log('Database restored successfully');
    } catch (error) {
      console.error('Restore failed:', error.message);
      throw new Error(`Restore failed: ${error.message}`);
    }
  }
};

export default BackupService;
