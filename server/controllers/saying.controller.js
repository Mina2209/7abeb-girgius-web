import { SayingService } from '../services/saying.service.js';
import { normalizeArabic } from '../services/normalize.js';
import { logService } from '../services/log.service.js';

export const SayingController = {
  getAll: async (req, res) => {
    const PAGE_SIZE = 50;
    const MAX_SIZE = 100;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(MAX_SIZE, Math.max(1, parseInt(req.query.limit) || PAGE_SIZE));

    const searchRaw = req.query.search || req.query.q || '';
    if (!searchRaw) {
      const sayings = await SayingService.getAll();
      const start = (page - 1) * limit;
      return res.json(sayings.slice(start, start + limit));
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
    const start = (page - 1) * limit;
    res.json(filtered.slice(start, start + limit));
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

    if (rows.length > 1000) {
      return res.status(400).json({ error: 'Bulk import limited to 1000 rows per request' });
    }

    const REQUIRED_FIELDS = ['author', 'content'];
    const STRING_FIELDS = ['author', 'content', 'source', 'authorImage'];
    const MAX_LENGTHS = { author: 200, content: 5000, source: 200, authorImage: 500 };
    const validatedRows = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        return res.status(400).json({ error: `Row ${i + 1} must be an object` });
      }
      for (const field of REQUIRED_FIELDS) {
        if (!row[field] || typeof row[field] !== 'string' || !row[field].trim()) {
          return res.status(400).json({ error: `Row ${i + 1}: "${field}" is required and must be a non-empty string` });
        }
      }
      const clean = {};
      for (const field of STRING_FIELDS) {
        if (row[field] !== undefined && row[field] !== null) {
          if (typeof row[field] !== 'string') {
            return res.status(400).json({ error: `Row ${i + 1}: "${field}" must be a string` });
          }
          clean[field] = row[field].trim();
          if (MAX_LENGTHS[field] && clean[field].length > MAX_LENGTHS[field]) {
            return res.status(400).json({ error: `Row ${i + 1}: "${field}" must not exceed ${MAX_LENGTHS[field]} characters` });
          }
        }
      }
      if (row.tags !== undefined) {
        if (!Array.isArray(row.tags)) {
          return res.status(400).json({ error: `Row ${i + 1}: "tags" must be an array` });
        }
        clean.tags = row.tags.filter(t => typeof t === 'string').slice(0, 20);
      }
      validatedRows.push(clean);
    }

    const importedSayings = await SayingService.bulkImport(validatedRows);

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
