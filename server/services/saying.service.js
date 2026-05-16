import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const SayingService = {
  getAll: async () => {
    return prisma.saying.findMany({
      include: { tags: true }
    });
  },

  getById: async (id) => {
    return prisma.saying.findUnique({
      where: { id },
      include: { tags: true }
    });
  },

  create: async (data) => {
    return prisma.saying.create({
      data: {
        author: data.author,
        authorImage: data.authorImage,
        source: data.source,
        content: data.content,
        tags: data.tags && data.tags.length > 0
          ? {
              connectOrCreate: data.tags.map(tag => ({
                where: { name: tag },
                create: { name: tag }
              }))
            }
          : undefined
      },
      include: { tags: true }
    });
  },

  update: async (id, data) => {
    return prisma.saying.update({
      where: { id },
      data: {
        author: data.author,
        authorImage: data.authorImage,
        source: data.source,
        content: data.content,
        tags: {
          set: [], // clear old
          ...(data.tags && data.tags.length > 0
            ? {
                connectOrCreate: data.tags.map(tag => ({
                  where: { name: tag },
                  create: { name: tag }
                }))
              }
            : {})
        }
      },
      include: { tags: true }
    });
  },

  delete: async (id) => {
    return prisma.saying.delete({
      where: { id }
    });
  }
};
