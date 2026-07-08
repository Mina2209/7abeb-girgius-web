import { FatherService } from '../services/father.service.js';
import { logService } from '../services/log.service.js';

export const FatherController = {
  getAll: async (req, res) => {
    const fathers = await FatherService.getAll();
    res.json(fathers);
  },

  getById: async (req, res) => {
    const father = await FatherService.getById(req.params.id);
    if (!father) return res.status(404).json({ error: 'Father not found' });
    res.json(father);
  },

  getByName: async (req, res) => {
    const father = await FatherService.getByName(req.params.name);
    if (!father) return res.status(404).json({ error: 'Father not found' });
    res.json(father);
  },

  create: async (req, res, next) => {
    try {
      const father = await FatherService.create(req.body);

      if (req.user) {
        await logService.createLog(
          req.user.id,
          'CREATE',
          'FATHER',
          father.id,
          `Created father: ${father.name}`
        ).catch(err => console.error('[FatherController.create] log error:', err));
      }

      res.status(201).json(father);
    } catch (err) {
      console.error('[FatherController.create] error:', err);
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'هذا الاسم موجود مسبقاً' });
      }
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const father = await FatherService.update(req.params.id, req.body);

      if (req.user) {
        await logService.createLog(
          req.user.id,
          'UPDATE',
          'FATHER',
          father.id,
          `Updated father: ${father.name}`
        ).catch(() => {});
      }

      res.json(father);
    } catch (err) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'هذا الاسم موجود مسبقاً' });
      }
      next(err);
    }
  },

  delete: async (req, res) => {
    const { id } = req.params;
    const father = await FatherService.getById(id);

    await FatherService.delete(id);

    if (req.user) {
      await logService.createLog(
        req.user.id,
        'DELETE',
        'FATHER',
        id,
        `Deleted father: ${father?.name || id}`
      );
    }

    res.status(204).send();
  }
};
