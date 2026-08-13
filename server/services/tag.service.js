import { prisma } from './prisma.js';

const TAG_SELECT_BASIC = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
};

function tagFallbackQuery() {
  return prisma.tag.findMany({
    orderBy: { name: 'asc' },
    select: {
      ...TAG_SELECT_BASIC,
      _count: { select: { hymns: true, sayings: true, images: true } },
    },
  });
}

export const TagService = {
  getAll: async () => {
    try {
      return await prisma.tag.findMany({
        orderBy: [{ section: { order: 'asc' } }, { order: 'asc' }, { name: 'asc' }],
        include: {
          _count: { select: { hymns: true, sayings: true, images: true } },
          section: true,
        },
      });
    } catch {
      return tagFallbackQuery();
    }
  },

  getById: async (id) => {
    try {
      return await prisma.tag.findUnique({
        where: { id },
        include: {
          _count: { select: { hymns: true, sayings: true, images: true } },
          section: true,
        },
      });
    } catch {
      return prisma.tag.findUnique({
        where: { id },
        select: {
          ...TAG_SELECT_BASIC,
          _count: { select: { hymns: true, sayings: true, images: true } },
        },
      });
    }
  },

  create: async (data) => {
    try {
      let order = 0;
      if (data.sectionId) {
        const maxOrder = await prisma.tag.aggregate({
          where: { sectionId: data.sectionId },
          _max: { order: true },
        });
        order = (maxOrder._max.order ?? 0) + 1;
      }
      return await prisma.tag.create({
        data: {
          name: data.name,
          order,
          sectionId: data.sectionId || null,
        },
        include: {
          _count: { select: { hymns: true, sayings: true, images: true } },
          section: true,
        },
      });
    } catch {
      return prisma.tag.create({
        data: { name: data.name },
        select: {
          ...TAG_SELECT_BASIC,
          _count: { select: { hymns: true, sayings: true, images: true } },
        },
      });
    }
  },

  update: async (id, data) => {
    try {
      const updateData = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.sectionId !== undefined) {
        updateData.sectionId = data.sectionId || null;
        if (data.sectionId) {
          const maxOrder = await prisma.tag.aggregate({
            where: { sectionId: data.sectionId },
            _max: { order: true },
          });
          updateData.order = (maxOrder._max.order ?? 0) + 1;
        }
      }
      if (data.order !== undefined) updateData.order = data.order;
      return await prisma.tag.update({
        where: { id },
        data: updateData,
        include: {
          _count: { select: { hymns: true, sayings: true, images: true } },
          section: true,
        },
      });
    } catch {
      const updateData = {};
      if (data.name !== undefined) updateData.name = data.name;
      return prisma.tag.update({
        where: { id },
        data: updateData,
        select: {
          ...TAG_SELECT_BASIC,
          _count: { select: { hymns: true, sayings: true, images: true } },
        },
      });
    }
  },

  delete: async (id) => {
    return prisma.tag.delete({ where: { id } });
  },

  reorder: async (orderedIds) => {
    const updates = orderedIds.map((id, index) =>
      prisma.tag.update({
        where: { id },
        data: { order: index + 1 },
      })
    );
    await prisma.$transaction(updates);
  },
};
