import { ImageService } from '../services/image.service.js';
import { logService } from '../services/log.service.js';

// Parse a comma-separated query param into a trimmed array (or undefined).
function csv(v) {
  return v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : undefined;
}

// Extract the supported image filters from a request (incl. editor visibility of unpublished).
function parseImageFilters(req) {
  return {
    search: req.query.search || req.query.q || '',
    tags: csv(req.query.tags),
    artists: csv(req.query.artists ?? req.query.artist),
    types: csv(req.query.types ?? req.query.type),
    ai: req.query.ai || undefined,
    ids: csv(req.query.ids),
    includeUnpublished: !!(req.user && (req.user.role === 'ADMIN' || req.user.role === 'EDITOR')),
  };
}

export const ImageController = {
  getAll: async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const sort = req.query.sort || undefined;
      // All filtering, sorting and pagination run in the database (server-side).
      const result = await ImageService.getAll({ page, limit, sort, ...parseImageFilters(req) });
      res.json(result);
    } catch (err) {
      console.error('Error fetching images:', err);
      res.status(500).json({ error: 'Failed to fetch images' });
    }
  },

  // Faceted filter options for the current selection (each facet excludes its own filter).
  getFacets: async (req, res) => {
    try {
      const { search, tags, artists, types, ai, includeUnpublished } = parseImageFilters(req);
      const facets = await ImageService.getFacets({ search, tags, artists, types, ai, includeUnpublished });
      res.json(facets);
    } catch (err) {
      console.error('Error fetching image facets:', err);
      res.status(500).json({ error: 'Failed to fetch image facets' });
    }
  },

  // Returns all image IDs matching the current filters (used by "select all" across pages).
  getIds: async (req, res) => {
    try {
      const { search, tags, artists, types, ai, includeUnpublished } = parseImageFilters(req);
      const ids = await ImageService.getAllIds({ search, tags, artists, types, ai, includeUnpublished });
      res.json(ids);
    } catch (err) {
      console.error('Error fetching image ids:', err);
      res.status(500).json({ error: 'Failed to fetch image ids' });
    }
  },

  getById: async (req, res) => {
    try {
      const image = await ImageService.getById(req.params.id);
      if (!image) return res.status(404).json({ error: 'Image not found' });
      res.json(image);
    } catch (err) {
      console.error('Error fetching image:', err);
      res.status(500).json({ error: 'Failed to fetch image' });
    }
  },

  create: async (req, res) => {
    try {
      const image = await ImageService.create(req.body);

      if (req.user) {
        await logService.createLog(
          req.user.id,
          'CREATE',
          'IMAGE',
          image.id,
          `Created image: ${image.title}`
        );
      }

      res.status(201).json(image);
    } catch (err) {
      console.error('Error creating image:', err);
      res.status(500).json({ error: 'Failed to create image' });
    }
  },

  update: async (req, res) => {
    try {
      const image = await ImageService.update(req.params.id, req.body);

      if (req.user) {
        await logService.createLog(
          req.user.id,
          'UPDATE',
          'IMAGE',
          image.id,
          `Updated image: ${image.title}`
        );
      }

      res.json(image);
    } catch (err) {
      console.error('Error updating image:', err);
      res.status(500).json({ error: 'Failed to update image' });
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const image = await ImageService.getById(id);

      await ImageService.delete(id);

      if (req.user) {
        await logService.createLog(
          req.user.id,
          'DELETE',
          'IMAGE',
          id,
          `Deleted image: ${image?.title || id}`
        );
      }

      res.status(204).send();
    } catch (err) {
      console.error('Error deleting image:', err);
      res.status(500).json({ error: 'Failed to delete image' });
    }
  },

  // --- Meta endpoints for Author/Type dropdowns ---

  getAuthors: async (req, res) => {
    try {
      const authors = await ImageService.getAuthors({ hasImages: req.query.hasImages });
      res.json(authors);
    } catch (err) {
      console.error('Error fetching authors:', err);
      res.status(500).json({ error: 'Failed to fetch authors' });
    }
  },

  createAuthor: async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Author name is required' });
      }
      const author = await ImageService.createAuthor(name.trim());
      res.status(201).json(author);
    } catch (err) {
      console.error('Error creating author:', err);
      res.status(500).json({ error: 'Failed to create author' });
    }
  },

  getAuthorById: async (req, res) => {
    try {
      const author = await ImageService.getAuthorById(req.params.id);
      if (!author) return res.status(404).json({ error: 'Author not found' });
      res.json(author);
    } catch (err) {
      console.error('Error fetching author:', err);
      res.status(500).json({ error: 'Failed to fetch author' });
    }
  },

  updateAuthor: async (req, res) => {
    try {
      const AUTHOR_UPDATE_FIELDS = ['name', 'bio', 'role', 'profileImage', 'facebook', 'instagram', 'website', 'email', 'specialty'];
      const updates = {};
      for (const field of AUTHOR_UPDATE_FIELDS) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }
      if (req.body.socialMedia && typeof req.body.socialMedia === 'object') {
        for (const key of ['facebook', 'instagram', 'website', 'email']) {
          if (req.body.socialMedia[key] !== undefined) {
            updates[key] = req.body.socialMedia[key];
          }
        }
      }
      if (!updates.name || typeof updates.name !== 'string' || !updates.name.trim()) {
        return res.status(400).json({ error: 'Author name is required' });
      }
      updates.name = updates.name.trim();
      if (updates.name.length > 200) {
        return res.status(400).json({ error: 'Author name must not exceed 200 characters' });
      }

      const author = await ImageService.updateAuthor(req.params.id, updates);

      if (req.user) {
        const { logService } = await import('../services/log.service.js');
        await logService.createLog(
          req.user.id,
          'UPDATE',
          'AUTHOR',
          author.id,
          `Updated author: ${author.name}`
        );
      }

      res.json(author);
    } catch (err) {
      console.error('Error updating author:', err);
      res.status(500).json({ error: 'Failed to update author' });
    }
  },

  getTypes: async (req, res) => {
    try {
      const types = await ImageService.getTypes();
      res.json(types);
    } catch (err) {
      console.error('Error fetching types:', err);
      res.status(500).json({ error: 'Failed to fetch types' });
    }
  },

  createType: async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Type name is required' });
      }
      const type = await ImageService.createType(name.trim());
      res.status(201).json(type);
    } catch (err) {
      console.error('Error creating type:', err);
      res.status(500).json({ error: 'Failed to create type' });
    }
  },

  deleteAuthor: async (req, res) => {
    try {
      const result = await ImageService.deleteAuthor(req.params.id);
      if (result.error === 'not_found') return res.status(404).json({ error: 'Author not found' });
      if (result.error === 'has_images') return res.status(400).json({ error: `لا يمكن حذف المؤلف لأنه مرتبط بـ ${result.count} صورة` });
      res.status(204).send();
    } catch (err) {
      console.error('Error deleting author:', err);
      res.status(500).json({ error: 'Failed to delete author' });
    }
  },

  deleteType: async (req, res) => {
    try {
      const result = await ImageService.deleteType(req.params.id);
      if (result.error === 'not_found') return res.status(404).json({ error: 'Type not found' });
      if (result.error === 'has_images') return res.status(400).json({ error: `لا يمكن حذف النوع لأنه مرتبط بـ ${result.count} صورة` });
      res.status(204).send();
    } catch (err) {
      console.error('Error deleting type:', err);
      res.status(500).json({ error: 'Failed to delete type' });
    }
  },
};
