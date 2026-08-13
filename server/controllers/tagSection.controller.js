import { TagSectionService } from '../services/tagSection.service.js';
import { logService } from '../services/log.service.js';

export const TagSectionController = {
  getAll: async (req, res) => {
    const sections = await TagSectionService.getAll();
    res.json(sections);
  },

  getById: async (req, res) => {
    const section = await TagSectionService.getById(req.params.id);
    if (!section) return res.status(404).json({ error: 'Section not found' });
    res.json(section);
  },

  create: async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Section name is required' });
    }
    const section = await TagSectionService.create({ name });

    if (req.user) {
      await logService.createLog(
        req.user.id,
        'CREATE',
        'TAG_SECTION',
        section.id,
        `Created section: ${section.name}`
      );
    }

    res.status(201).json(section);
  },

  update: async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Section name is required' });
    }
    const section = await TagSectionService.update(req.params.id, { name });

    if (req.user) {
      await logService.createLog(
        req.user.id,
        'UPDATE',
        'TAG_SECTION',
        section.id,
        `Updated section: ${section.name}`
      );
    }

    res.json(section);
  },

  delete: async (req, res) => {
    const section = await TagSectionService.getById(req.params.id);
    if (!section) return res.status(404).json({ error: 'Section not found' });

    await TagSectionService.delete(req.params.id);

    if (req.user) {
      await logService.createLog(
        req.user.id,
        'DELETE',
        'TAG_SECTION',
        req.params.id,
        `Deleted section: ${section.name}`
      );
    }

    res.status(204).send();
  },

  reorder: async (req, res) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }
    await TagSectionService.reorder(orderedIds);
    res.json({ success: true });
  },
};
