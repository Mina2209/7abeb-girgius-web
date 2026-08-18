import { prisma } from './prisma.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const FatherService = {
  getAll: async ({ page = 1, limit = DEFAULT_LIMIT } = {}) => {
    const take = Math.min(MAX_LIMIT, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;
    return prisma.father.findMany({ orderBy: { name: 'asc' }, skip, take });
  },
  getById: async (id) => prisma.father.findUnique({ where: { id } }),
  getByName: async (name) => prisma.father.findFirst({ where: { name } }),
  create: async (data) => prisma.father.create({ data }),
  update: async (id, data) => prisma.father.update({ where: { id }, data }),
  delete: async (id) => prisma.father.delete({ where: { id } }),
};
