import { LyricService } from '../services/lyric.service.js';
import { logService } from '../services/log.service.js';

export const LyricController = {
  /**
   * GET /api/lyrics
   * Get all lyrics
   */
  getAll: async (req, res) => {
    try {
      const lyrics = await LyricService.getAll();
      res.json(lyrics);
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      res.status(500).json({ error: 'Failed to fetch lyrics' });
    }
  },

  /**
   * GET /api/lyrics/search?q=query
   * Search across lyrics
   */
  search: async (req, res) => {
    try {
      const query = req.query.q || req.query.search || '';
      
      if (!query.trim()) {
        return res.json([]);
      }

      const results = await LyricService.search(query);
      res.json(results);
    } catch (error) {
      console.error('Error searching lyrics:', error);
      res.status(500).json({ error: 'Failed to search lyrics' });
    }
  },

  /**
   * GET /api/lyrics/:id
   * Get a single lyric by ID
   */
  getById: async (req, res) => {
    try {
      const lyric = await LyricService.getById(req.params.id);
      if (!lyric) {
        return res.status(404).json({ error: 'Lyric not found' });
      }
      res.json(lyric);
    } catch (error) {
      console.error('Error fetching lyric:', error);
      res.status(500).json({ error: 'Failed to fetch lyric' });
    }
  },

  /**
   * GET /api/lyrics/hymn/:hymnId
   * Get lyric for a specific hymn
   */
  getByHymnId: async (req, res) => {
    try {
      const lyric = await LyricService.getByHymnId(req.params.hymnId);
      res.json(lyric);
    } catch (error) {
      console.error('Error fetching lyric for hymn:', error);
      res.status(500).json({ error: 'Failed to fetch lyric for hymn' });
    }
  },

  /**
   * PUT /api/lyrics/hymn/:hymnId
   * Create or update lyric for a hymn (upsert)
   */
  upsert: async (req, res) => {
    try {
      const { hymnId } = req.params;
      const { content } = req.body;

      const lyric = await LyricService.upsert(hymnId, content);

      // Log the action if user is authenticated
      if (req.user) {
        try {
          await logService.createLog(
            req.user.id,
            lyric ? 'UPDATE' : 'DELETE',
            'LYRIC',
            hymnId,
            lyric ? `Updated lyric for hymn` : `Cleared lyric for hymn`
          );
        } catch (logError) {
          console.warn('Failed to log lyric action:', logError.message);
        }
      }

      res.json(lyric);
    } catch (error) {
      console.error('Error upserting lyric:', error);
      res.status(500).json({ error: 'Failed to update lyric' });
    }
  },

  /**
   * DELETE /api/lyrics/hymn/:hymnId
   * Delete lyric for a hymn
   */
  deleteByHymnId: async (req, res) => {
    try {
      await LyricService.deleteByHymnId(req.params.hymnId);

      // Log the action if user is authenticated
      if (req.user) {
        try {
          await logService.createLog(
            req.user.id,
            'DELETE',
            'LYRIC',
            req.params.hymnId,
            `Deleted lyric for hymn`
          );
        } catch (logError) {
          console.warn('Failed to log lyric deletion:', logError.message);
        }
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting lyric:', error);
      res.status(500).json({ error: 'Failed to delete lyric' });
    }
  }
};
