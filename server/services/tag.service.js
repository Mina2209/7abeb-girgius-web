import { prisma } from './prisma.js';

export const TagService = {
  getAll: async () => {
    return prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { hymns: true, sayings: true, images: true } } }
    });
  },

  getById: async (id) => {
    return prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { hymns: true, sayings: true, images: true } } }
    });
  },

  create: async (data) => {
    return prisma.tag.create({
      data: { 
        name: data.name,
        category: data.category && data.category.trim() ? data.category.trim() : null
      },
      include: { _count: { select: { hymns: true, sayings: true, images: true } } }
    });
  },

  update: async (id, data) => {
    return prisma.tag.update({
      where: { id },
      data: { 
        name: data.name,
        category: data.category !== undefined ? (data.category && data.category.trim() ? data.category.trim() : null) : undefined
      },
      include: { _count: { select: { hymns: true, sayings: true, images: true } } }
    });
  },

  delete: async (id) => {
    return prisma.tag.delete({
      where: { id }
    });
  }
};
