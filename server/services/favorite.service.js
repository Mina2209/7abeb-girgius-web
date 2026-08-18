import { prisma } from './prisma.js';

export const FavoriteService = {
  getAll: async (userId) => {
    return prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  getByContentType: async (userId, contentType) => {
    return prisma.favorite.findMany({
      where: { userId, contentType },
      select: { contentId: true },
    });
  },

  getContentIds: async (userId, contentType) => {
    const rows = await prisma.favorite.findMany({
      where: { userId, contentType },
      select: { contentId: true },
    });
    return rows.map((r) => r.contentId);
  },

  toggle: async (userId, contentType, contentId) => {
    const existing = await prisma.favorite.findUnique({
      where: { userId_contentType_contentId: { userId, contentType, contentId } },
    });
    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }
    await prisma.favorite.create({
      data: { userId, contentType, contentId },
    });
    return { favorited: true };
  },
};
