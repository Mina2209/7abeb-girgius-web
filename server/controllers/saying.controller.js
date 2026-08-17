import { SayingService } from '../services/saying.service.js';
import { normalizeArabic } from '../services/normalize.js';
import { logService } from '../services/log.service.js';

export const SayingController = {
  getAll: async (req, res) => {
    const searchRaw = req.query.search || req.query.q || '';
    if (!searchRaw) {
      const sayings = await SayingService.getAll();
      return res.json(sayings);
    }

    const search = normalizeArabic(searchRaw);
    const sayings = await SayingService.getAll();
    const filtered = sayings.filter(s => {
      const author = normalizeArabic(s.author || '');
      const content = normalizeArabic(s.content || '');
      const source = normalizeArabic(s.source || '');
      
      if (author.includes(search) || content.includes(search) || source.includes(search)) {
        return true;
      }
      
      const tagMatch = Array.isArray(s.tags) && s.tags.some(t => normalizeArabic(t.name || '').includes(search));
      return tagMatch;
    });
    res.json(filtered);
  },

  getById: async (req, res) => {
    const saying = await SayingService.getById(req.params.id);
    if (!saying) return res.status(404).json({ error: 'Saying not found' });
    res.json(saying);
  },

  create: async (req, res) => {
    const saying = await SayingService.create(req.body);
    
    // Log the action if user is authenticated
    if (req.user) {
      await logService.createLog(
        req.user.id,
        'CREATE',
        'SAYING',
        saying.id,
        `Created saying by: ${saying.author}`
      );
    }
    
    res.status(201).json(saying);
  },

  update: async (req, res) => {
    const saying = await SayingService.update(req.params.id, req.body);
    
    // Log the action if user is authenticated
    if (req.user) {
      await logService.createLog(
        req.user.id,
        'UPDATE',
        'SAYING',
        saying.id,
        `Updated saying by: ${saying.author}`
      );
    }
    
    res.json(saying);
  },

  delete: async (req, res) => {
    const { id } = req.params;
    const saying = await SayingService.getById(id);
    
    await SayingService.delete(id);
    
    // Log the action if user is authenticated
    if (req.user) {
      await logService.createLog(
        req.user.id,
        'DELETE',
        'SAYING',
        id,
        `Deleted saying by: ${saying?.author || id}`
      );
    }
    
    res.status(204).send();
  },

  bulkImport: async (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty rows data' });
    }

    // Fix #5: Cap bulk import at 1000 rows to prevent abuse.
    if (rows.length > 1000) {
      return res.status(400).json({ error: 'Bulk import limited to 1000 rows per request' });
    }

    const importedSayings = await SayingService.bulkImport(rows);

    if (req.user) {
      await logService.createLog(
        req.user.id,
        'CREATE',
        'SAYING',
        null,
        `Bulk imported ${importedSayings.length} sayings via Excel sheet.`
      );
    }

    res.status(201).json({ success: true, count: importedSayings.length });
  }
};
