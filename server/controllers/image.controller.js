import { ImageService } from '../services/image.service.js';
import { normalizeArabic } from '../services/normalize.js';
import { logService } from '../services/log.service.js';

export const ImageController = {
  getAll: async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const searchRaw = req.query.search || req.query.q || '';

      // Build Prisma where clause for server-side filtering
      const where = {};

      if (searchRaw) {
        const search = normalizeArabic(searchRaw);
        // Prisma doesn't support Arabic normalization natively,
        // so we fetch with pagination and filter in-memory for search
        const result = await ImageService.getAll({ page: 1, limit: 999999 });
        const filtered = result.data.filter(img => {
          const title = normalizeArabic(img.title || '');
          if (title.includes(search)) return true;
          const tagMatch = Array.isArray(img.tags) && img.tags.some(t => normalizeArabic(t.name || '').includes(search));
          if (tagMatch) return true;
          const authorMatch = img.author && normalizeArabic(img.author.name || '').includes(search);
          return authorMatch;
        });

        const total = filtered.length;
        const start = (page - 1) * limit;
        const data = filtered.slice(start, start + limit);
        return res.json({ data, total, page, limit });
      }

      const result = await ImageService.getAll({ page, limit, where });
      res.json(result);
    } catch (err) {
      console.error('Error fetching images:', err);
      res.status(500).json({ error: 'Failed to fetch images' });
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
      const authors = await ImageService.getAuthors();
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
