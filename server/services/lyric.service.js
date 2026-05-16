import { PrismaClient } from '@prisma/client';
import { normalizeArabic } from './normalize.js';

const prisma = new PrismaClient();

export const LyricService = {
  /**
   * Get all lyrics
   */
  getAll: async () => {
    return prisma.lyric.findMany({
      include: { hymn: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' }
    });
  },

  /**
   * Get a single lyric by ID
   */
  getById: async (id) => {
    return prisma.lyric.findUnique({
      where: { id },
      include: { hymn: { select: { id: true, title: true } } }
    });
  },

  /**
   * Get lyric for a specific hymn (one lyric per hymn)
   */
  getByHymnId: async (hymnId) => {
    return prisma.lyric.findUnique({
      where: { hymnId }
    });
  },

  /**
   * Create or update lyric for a hymn (upsert)
   */
  upsert: async (hymnId, content) => {
    if (!content || content.trim() === '') {
      // If content is empty, delete the lyric if it exists
      await prisma.lyric.deleteMany({ where: { hymnId } });
      return null;
    }

    return prisma.lyric.upsert({
      where: { hymnId },
      create: {
        hymnId,
        content
      },
      update: {
        content
      },
      include: { hymn: { select: { id: true, title: true } } }
    });
  },

  /**
   * Delete lyric by hymn ID
   */
  deleteByHymnId: async (hymnId) => {
    return prisma.lyric.deleteMany({ where: { hymnId } });
  },

  /**
   * Full-text search across lyrics content
   * Uses PostgreSQL's to_tsvector/to_tsquery for efficient searching
   */
  search: async (query) => {
    if (!query || query.trim() === '') {
      return [];
    }

    const normalizedQuery = normalizeArabic(query);
    
    try {
      // Use raw SQL for full-text search with the GIN index
      const results = await prisma.$queryRaw`
        SELECT l.*, h.title as "hymnTitle"
        FROM "Lyric" l
        JOIN "Hymn" h ON l."hymnId" = h.id
        WHERE l.search_vector @@ plainto_tsquery('simple', ${normalizedQuery})
        ORDER BY ts_rank(l.search_vector, plainto_tsquery('simple', ${normalizedQuery})) DESC
      `;
      return results;
    } catch (error) {
      // Fallback to ILIKE if full-text search fails (e.g., search_vector doesn't exist)
      console.warn('Full-text search failed, falling back to ILIKE:', error.message);
      return prisma.lyric.findMany({
        where: {
          content: {
            contains: normalizedQuery,
            mode: 'insensitive'
          }
        },
        include: { hymn: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' }
      });
    }
  }
};
