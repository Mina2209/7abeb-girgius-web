import { PrismaClient } from '@prisma/client';
import s3Service from './s3.service.js';
const prisma = new PrismaClient();

const includeRelations = { tags: true, author: true, type: true };

export const ImageService = {
  getAll: async ({ page = 1, limit = 20, where = {} } = {}) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.image.findMany({
        where,
        include: includeRelations,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.image.count({ where }),
    ]);
    return { data, total, page, limit };
  },

  getById: async (id) => {
    return prisma.image.findUnique({
      where: { id },
      include: includeRelations,
    });
  },

  create: async (data) => {
    return prisma.image.create({
      data: {
        title: data.title,
        imageUrl: data.imageUrl,
        ai: data.ai ?? false,
        published: data.published ?? false,
        author: data.authorId ? { connect: { id: data.authorId } } : undefined,
        type: data.typeId ? { connect: { id: data.typeId } } : undefined,
        tags: data.tags && data.tags.length > 0
          ? {
              connectOrCreate: data.tags.map(tag => ({
                where: { name: tag },
                create: { name: tag }
              }))
            }
          : undefined
      },
      include: includeRelations,
    });
  },

  update: async (id, data) => {
    const updateData = {
      title: data.title,
      imageUrl: data.imageUrl,
      ai: data.ai,
      published: data.published,
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
    };

    // Handle author
    if (data.authorId) {
      updateData.author = { connect: { id: data.authorId } };
    } else if (data.authorId === null) {
      updateData.author = { disconnect: true };
    }

    // Handle type
    if (data.typeId) {
      updateData.type = { connect: { id: data.typeId } };
    } else if (data.typeId === null) {
      updateData.type = { disconnect: true };
    }

    return prisma.image.update({
      where: { id },
      data: updateData,
      include: includeRelations,
    });
  },

  delete: async (id) => {
    const image = await prisma.image.findUnique({ where: { id } });
    if (!image) return null;

    // Delete S3 object if imageUrl contains a key
    if (image.imageUrl) {
      try {
        if (image.imageUrl.includes('key=')) {
          const parts = image.imageUrl.split('key=');
          const key = decodeURIComponent(parts[1] || '');
          if (key) {
            await s3Service.deleteObject(key);
          }
        }
      } catch (e) {
        console.error('Failed to delete image S3 object:', e.message || e);
      }
    }

    return prisma.image.delete({ where: { id } });
  },

  // --- Author management ---
  getAuthors: async () => {
    return prisma.imageAuthor.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { images: true } } },
    });
  },

  createAuthor: async (name) => {
    return prisma.imageAuthor.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  },

  deleteAuthor: async (id) => {
    const author = await prisma.imageAuthor.findUnique({
      where: { id },
      include: { _count: { select: { images: true } } },
    });
    if (!author) return { error: 'not_found' };
    if (author._count.images > 0) return { error: 'has_images', count: author._count.images };
    await prisma.imageAuthor.delete({ where: { id } });
    return { success: true };
  },

  // --- Type management ---
  getTypes: async () => {
    return prisma.imageType.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { images: true } } },
    });
  },

  createType: async (name) => {
    return prisma.imageType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  },

  deleteType: async (id) => {
    const type = await prisma.imageType.findUnique({
      where: { id },
      include: { _count: { select: { images: true } } },
    });
    if (!type) return { error: 'not_found' };
    if (type._count.images > 0) return { error: 'has_images', count: type._count.images };
    await prisma.imageType.delete({ where: { id } });
    return { success: true };
  },
};
