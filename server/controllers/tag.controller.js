import { TagService } from '../services/tag.service.js';
import { logService } from '../services/log.service.js';

export const TagController = {
  getAll: async (req, res) => {
    const tags = await TagService.getAll();
    res.json(tags);
  },

  getById: async (req, res) => {
    const tag = await TagService.getById(req.params.id);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    res.json(tag);
  },

  create: async (req, res) => {
    const tag = await TagService.create(req.body);
    
    if (req.user) {
      await logService.createLog(
        req.user.id,
        'CREATE',
        'TAG',
        tag.id,
        `Created tag: ${tag.name}`
      );
    }
    
    res.status(201).json(tag);
  },

  update: async (req, res) => {
    const tag = await TagService.update(req.params.id, req.body);
    
    if (req.user) {
      await logService.createLog(
        req.user.id,
        'UPDATE',
        'TAG',
        tag.id,
        `Updated tag: ${tag.name}`
      );
    }
    
    res.json(tag);
  },

  delete: async (req, res) => {
    const { id } = req.params;
    const tag = await TagService.getById(id);
    
    await TagService.delete(id);
    
    if (req.user) {
      await logService.createLog(
        req.user.id,
        'DELETE',
        'TAG',
        id,
        `Deleted tag: ${tag?.name || id}`
      );
    }
    
    res.status(204).send();
  },

  reorder: async (req, res) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }
    await TagService.reorder(orderedIds);
    res.json({ success: true });
  },
};
