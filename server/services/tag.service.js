import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const TagService = {
  getAll: async () => {
    return prisma.tag.findMany({
      include: { hymns: true, sayings: true }
    });
  },

  getById: async (id) => {
    return prisma.tag.findUnique({
      where: { id },
      include: { hymns: true, sayings: true }
    });
  },

  create: async (data) => {
    return prisma.tag.create({
      data: { 
        name: data.name,
        category: data.category && data.category.trim() ? data.category.trim() : null
      },
      include: { hymns: true, sayings: true }
    });
  },

  update: async (id, data) => {
    return prisma.tag.update({
      where: { id },
      data: { 
        name: data.name,
        category: data.category !== undefined ? (data.category && data.category.trim() ? data.category.trim() : null) : undefined
      },
      include: { hymns: true, sayings: true }
    });
  },

  delete: async (id) => {
    return prisma.tag.delete({
      where: { id }
    });
  }
};
