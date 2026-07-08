import { prisma } from './prisma.js';
import s3Service from './s3.service.js';
import { normalizeArabic } from './normalize.js';

const includeRelations = { tags: true, author: true, type: true };

// Build a Prisma `where` for image queries from the supported filters.
function buildImageWhere({ search, tags, artists, types, ai, ids, includeUnpublished } = {}) {
  const where = {};
  if (search && search.trim()) {
    const s = search.trim();
    // Free-text search matches the normalized title (indexed) OR a tag name.
    where.OR = [
      { titleNorm: { contains: normalizeArabic(s) } },
      { tags: { some: { name: { contains: s, mode: 'insensitive' } } } },
    ];
  }
  if (Array.isArray(tags) && tags.length) where.tags = { some: { name: { in: tags } } };
  if (Array.isArray(artists) && artists.length) where.author = { name: { in: artists } };
  if (Array.isArray(types) && types.length) where.type = { name: { in: types } };
  if (ai === 'yes' || ai === true) where.ai = true;
  else if (ai === 'no' || ai === false) where.ai = false;
  if (Array.isArray(ids) && ids.length) where.id = { in: ids };
  // Non-editors only ever see published images.
  if (!includeUnpublished) where.published = true;
  return where;
}

export const ImageService = {
  getAll: async ({ page = 1, limit = 20, search, tags, artists, types, ai, ids, sort, includeUnpublished } = {}) => {
    const where = buildImageWhere({ search, tags, artists, types, ai, ids, includeUnpublished });

    const orderBy =
      sort === 'date-asc' ? { createdAt: 'asc' }
      : sort === 'title-asc' ? { titleNorm: 'asc' }
      : sort === 'title-desc' ? { titleNorm: 'desc' }
      : { createdAt: 'desc' }; // default: newest first

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.image.findMany({ where, include: includeRelations, orderBy, skip, take: limit }),
      prisma.image.count({ where }),
    ]);
    return { data, total, page, limit };
  },

  // Return just the IDs of all images matching the filters (for "select all" across pages).
  getAllIds: async ({ search, tags, artists, types, ai, includeUnpublished } = {}) => {
    const where = buildImageWhere({ search, tags, artists, types, ai, includeUnpublished });
    const rows = await prisma.image.findMany({ where, select: { id: true } });
    return rows.map((r) => r.id);
  },

  // Faceted filter options: for each facet, the values still available given the OTHER
  // active filters (so each dropdown narrows as you select in the others). Computed in
  // the DB so it works with server-side pagination (no need to load all images).
  getFacets: async ({ search, tags, artists, types, ai, includeUnpublished } = {}) => {
    const whereExcl = (omit) =>
      buildImageWhere({
        search,
        tags: omit === 'tags' ? undefined : tags,
        artists: omit === 'artists' ? undefined : artists,
        types: omit === 'types' ? undefined : types,
        ai: omit === 'ai' ? undefined : ai,
        includeUnpublished,
      });

    const [tagRows, artistRows, typeRows, aiGroups] = await Promise.all([
      prisma.tag.findMany({ where: { images: { some: whereExcl('tags') } }, select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.imageAuthor.findMany({ where: { images: { some: whereExcl('artists') } }, select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.imageType.findMany({ where: { images: { some: whereExcl('types') } }, select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.image.groupBy({ by: ['ai'], where: whereExcl('ai') }),
    ]);

    return {
      tags: tagRows.map((r) => r.name),
      artists: artistRows.map((r) => r.name),
      types: typeRows.map((r) => r.name),
      ai: aiGroups.map((g) => (g.ai ? 'yes' : 'no')),
    };
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
        titleNorm: normalizeArabic(data.title || ''),
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
      titleNorm: data.title !== undefined ? normalizeArabic(data.title || '') : undefined,
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
  getAuthors: async ({ hasImages } = {}) => {
    const where = {};
    if (hasImages === 'true' || hasImages === true) {
      where.images = { some: {} };
    }
    return prisma.imageAuthor.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { images: true } } },
    });
  },

  getAuthorById: async (id) => {
    return prisma.imageAuthor.findUnique({
      where: { id },
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

  updateAuthor: async (id, data) => {
    const updateData = {};
    const allowedFields = ['name', 'bio', 'role', 'profileImage', 'facebook', 'instagram', 'website', 'email', 'specialty'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }
    return prisma.imageAuthor.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { images: true } } },
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
