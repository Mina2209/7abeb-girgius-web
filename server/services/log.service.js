import { prisma } from './prisma.js';

export const logService = {
  async createLog(userId, action, entity, entityId = null, details = null) {
    return await prisma.log.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details
      }
    });
  },

  async getAllLogs(filters = {}) {
    const { userId, entity, limit = 100, skip = 0 } = filters;

    const where = {};
    if (userId) where.userId = userId;
    if (entity) where.entity = entity;

    return await prisma.log.findMany({
      where,
      include: {
        user: {
          select: { username: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip
    });
  },

  /**
   * Delete logs older than `retentionDays`. Returns the number of rows removed.
   * Uses the Log.createdAt index added in the performance-indexes migration.
   */
  async deleteOldLogs(retentionDays = 90) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.log.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return result.count;
  },

  async getLogsByUserId(userId) {
    return await prisma.log.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }
};
