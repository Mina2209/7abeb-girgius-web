import { prisma } from './prisma.js';
import s3Service from './s3.service.js';
import { cache } from './cache.js';

const TAG_SELECT = { id: true, name: true };

const HYMNS_LIST_KEY = 'hymns:list';
const HYMNS_LIST_TTL = 30_000; // 30 seconds — hymn metadata is mostly static

// Optimized select for the list endpoint: only the fields the controller actually
// needs for display, filtering, sorting, and zip building. Drops `lyric` entirely
// (unused in listings) and trims `files` to the five scalars the controller reads.
const LIST_SELECT = {
  id: true,
  title: true,
  createdAt: true,
  updatedAt: true,
  tags: { select: TAG_SELECT },
  lyric: true,
  files: {
    select: {
      id: true,
      type: true,
      fileUrl: true,
      originalName: true,
      duration: true,
    },
  },
};

// Full include for the detail view — everything the client needs for a single hymn.
const DETAIL_INCLUDE = {
  tags: { select: TAG_SELECT },
  files: true,
  lyric: true,
};

export const HymnService = {
  getAll: async () => {
    const cached = cache.get(HYMNS_LIST_KEY);
    if (cached) return cached;

    const rows = await prisma.hymn.findMany({ select: LIST_SELECT });
    cache.set(HYMNS_LIST_KEY, rows, HYMNS_LIST_TTL);
    return rows;
  },

  getById: async (id) => {
    return prisma.hymn.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
  },

  create: async (data) => {
    const result = await prisma.hymn.create({
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
      include: DETAIL_INCLUDE,
    });
    cache.del(HYMNS_LIST_KEY);
    return result;
  },

  update: async (id, data) => {
    const result = await prisma.hymn.update({
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
      include: DETAIL_INCLUDE,
    });
    cache.del(HYMNS_LIST_KEY);
    return result;
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

    const result = await prisma.hymn.delete({ where: { id } });
    cache.del(HYMNS_LIST_KEY);
    return result;
  }
};
