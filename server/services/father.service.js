import { prisma } from './prisma.js';

export const FatherService = {
  getAll: async () => prisma.father.findMany({ orderBy: { name: 'asc' } }),
  getById: async (id) => prisma.father.findUnique({ where: { id } }),
  getByName: async (name) => prisma.father.findFirst({ where: { name } }),
  create: async (data) => prisma.father.create({ data }),
  update: async (id, data) => prisma.father.update({ where: { id }, data }),
  delete: async (id) => prisma.father.delete({ where: { id } }),
};
