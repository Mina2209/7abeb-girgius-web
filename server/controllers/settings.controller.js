import { settingsService } from '../services/settings.service.js';

export const settingsController = {
  async getSiteSettings(req, res) {
    const settings = await settingsService.getSingleton();
    return res.json({ settings });
  },

  async upsertSiteSettings(req, res) {
    const { settings } = req.body || {};
    await settingsService.upsert({
      default_book_cover: settings?.default_book_cover,
      site_sections_visibility: settings?.site_sections_visibility,
    });
    const updated = await settingsService.getSingleton();
    return res.json({ settings: updated });
  },

  async getPowerpointSettings(req, res) {
    const settings = await settingsService.getSingleton();
    return res.json({ settings });
  },

  async upsertPowerpointSettings(req, res) {
    const { settings } = req.body || {};
    await settingsService.upsert({
      powerpoint_data: settings?.powerpoint_data,
    });
    const updated = await settingsService.getSingleton();
    return res.json({ settings: updated });
  },
};

