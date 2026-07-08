import { FavoriteService } from '../services/favorite.service.js';
import { logService } from '../services/log.service.js';

export const FavoriteController = {
  getAll: async (req, res) => {
    try {
      const favorites = await FavoriteService.getAll(req.user.id);
      res.json(favorites);
    } catch (err) {
      console.error('Error fetching favorites:', err);
      res.status(500).json({ error: 'Failed to fetch favorites' });
    }
  },

  getByType: async (req, res) => {
    try {
      const { contentType } = req.params;
      const ids = await FavoriteService.getContentIds(req.user.id, contentType);
      res.json(ids);
    } catch (err) {
      console.error('Error fetching favorites by type:', err);
      res.status(500).json({ error: 'Failed to fetch favorites' });
    }
  },

  toggle: async (req, res) => {
    try {
      const { contentType, contentId } = req.params;
      const result = await FavoriteService.toggle(req.user.id, contentType, contentId);

      if (req.user) {
        const action = result.favorited ? 'favorite_add' : 'favorite_remove';
        await logService.createLog(req.user.id, action, contentType.toUpperCase(), contentId, `${result.favorited ? 'Added' : 'Removed'} ${contentType} ${contentId}`);
      }

      res.json(result);
    } catch (err) {
      console.error('Error toggling favorite:', err);
      res.status(500).json({ error: 'Failed to toggle favorite' });
    }
  },
};
