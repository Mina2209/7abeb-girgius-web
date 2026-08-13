import { prisma } from './prisma.js';

const TAG_SELECT = { id: true, name: true };

export const SayingService = {
  getAll: async () => {
    return prisma.saying.findMany({
      include: { tags: { select: TAG_SELECT } }
    });
  },

  getById: async (id) => {
    return prisma.saying.findUnique({
      where: { id },
      include: { tags: { select: TAG_SELECT } }
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
      include: { tags: { select: TAG_SELECT } }
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
          set: [],
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
      include: { tags: { select: TAG_SELECT } }
    });
  },

  delete: async (id) => {
    return prisma.saying.delete({
      where: { id }
    });
  },

  bulkImport: async (rows) => {
    return prisma.$transaction(
      rows.map(row => {
        const tags = Array.isArray(row.tags)
          ? row.tags.filter(Boolean)
          : row.topic
            ? [row.topic]
            : [];

        return prisma.saying.create({
          data: {
            content: row.content,
            author: row.author,
            source: row.source || null,
            tags: tags.length > 0
              ? {
                  connectOrCreate: tags.map(tag => ({
                    where: { name: tag },
                    create: { name: tag }
                  }))
                }
              : undefined
          }
        });
      })
    );
  }
};
