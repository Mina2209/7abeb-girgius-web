import { prisma } from './prisma.js';

export const TagSectionService = {
  getAll: async () => {
    try {
      return await prisma.tagSection.findMany({
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { tags: true } },
          tags: {
            orderBy: { order: 'asc' },
            include: { _count: { select: { hymns: true, sayings: true, images: true } } },
          },
        },
      });
    } catch {
      return [];
    }
  },

  getById: async (id) => {
    try {
      return await prisma.tagSection.findUnique({
        where: { id },
        include: { _count: { select: { tags: true } } },
      });
    } catch {
      return null;
    }
  },

  create: async (data) => {
    const maxOrder = await prisma.tagSection.aggregate({ _max: { order: true } });
    return prisma.tagSection.create({
      data: {
        name: data.name.trim(),
        order: (maxOrder._max.order ?? 0) + 1,
      },
    });
  },

  update: async (id, data) => {
    return prisma.tagSection.update({
      where: { id },
      data: { name: data.name?.trim() },
    });
  },

  delete: async (id) => {
    await prisma.tag.updateMany({
      where: { sectionId: id },
      data: { sectionId: null },
    });
    return prisma.tagSection.delete({ where: { id } });
  },

  reorder: async (orderedIds) => {
    const updates = orderedIds.map((id, index) =>
      prisma.tagSection.update({
        where: { id },
        data: { order: index + 1 },
      })
    );
    await prisma.$transaction(updates);
  },
};
