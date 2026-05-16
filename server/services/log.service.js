import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    const { userId, entity, limit = 100 } = filters;
    
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
      take: limit
    });
  },

  async getLogsByUserId(userId) {
    return await prisma.log.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }
};
