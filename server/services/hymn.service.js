import { prisma } from './prisma.js';
import s3Service from './s3.service.js';

const TAG_SELECT = { id: true, name: true };

const INCLUDE_WITH_TAGS = {
  tags: { select: TAG_SELECT },
  files: true,
  lyric: true,
};

function selectTags(result) {
  if (!result) return result;
  return {
    ...result,
    tags: (result.tags || []).map(t => ({ id: t.id, name: t.name })),
  };
}

export const HymnService = {
  getAll: async () => {
    return prisma.hymn.findMany({ include: INCLUDE_WITH_TAGS });
  },

  getById: async (id) => {
    return prisma.hymn.findUnique({
      where: { id },
      include: INCLUDE_WITH_TAGS,
    });
  },

  create: async (data) => {
    return prisma.hymn.create({
      data: {
        title: data.title,
        files: data.files && data.files.length > 0 ? { create: data.files } : undefined,
        tags: data.tags && data.tags.length > 0
          ? {
              connectOrCreate: data.tags.map(tag => ({
                where: { name: tag },
                create: { name: tag }
              }))
            }
          : undefined
      },
      include: INCLUDE_WITH_TAGS,
    });
  },

  update: async (id, data) => {
    return prisma.hymn.update({
      where: { id },
      data: {
        title: data.title,
        files: {
          deleteMany: {},
          create: (data.files ?? [])
        },
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
      include: INCLUDE_WITH_TAGS,
    });
  },

  delete: async (id) => {
    // Fetch hymn with files to remove uploaded files from S3
    const hymn = await prisma.hymn.findUnique({ where: { id }, include: { files: true } });
    if (!hymn) return null;

    for (const file of hymn.files || []) {
      // If fileUrl is a server download endpoint like /api/uploads/url?key=<key>
      try {
        if (file.fileUrl && file.fileUrl.includes('key=')) {
          const parts = file.fileUrl.split('key=');
          const key = decodeURIComponent(parts[1] || '');
          if (key) {
            try {
              await s3Service.deleteObject(key);
              continue;
            } catch (e) {
              console.error('Failed to delete s3 object by key:', e.message || e);
            }
          }
        }
      } catch (e) {
        // ignore
      }

      // As a fallback, if fileUrl contains the bucket name or an S3 URL, try to extract key
      try {
        const bucket = process.env.AWS_S3_BUCKET;
        if (file.fileUrl && bucket && file.fileUrl.includes(bucket)) {
          const urlParts = file.fileUrl.split('/');
          const maybeKey = urlParts.slice(urlParts.indexOf(bucket) + 1).join('/');
          if (maybeKey) {
            try {
              await s3Service.deleteObject(maybeKey);
              continue;
            } catch (e) {
              console.error('Failed to delete s3 object by inferred key:', e.message || e);
            }
          }
        }
      } catch (e) {
        // ignore
      }
      // otherwise nothing else to do for this file
    }

    return prisma.hymn.delete({ where: { id } });
  }
};
