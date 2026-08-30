import { settingsService } from '../services/settings.service.js';

// Known keys for each settings endpoint. Unknown keys are rejected to prevent
// arbitrary data from being written to the database via mass-assignment.
const SITE_SETTINGS_KEYS = new Set(['default_book_cover', 'site_sections_visibility']);
const POWERPOINT_SETTINGS_KEYS = new Set(['powerpoint_data']);
const LITURGY_SETTINGS_KEYS = new Set(['liturgy_data']);

// Reject unknown keys and validate basic types for settings payloads.
function validateSettingsPayload(settings, allowedKeys, label) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return `${label}: settings must be an object`;
  }
  const unknown = Object.keys(settings).filter((k) => !allowedKeys.has(k));
  if (unknown.length > 0) {
    return `${label}: unknown fields rejected: ${unknown.join(', ')}`;
  }
  if ('default_book_cover' in settings && settings.default_book_cover !== null && typeof settings.default_book_cover !== 'string') {
    return `${label}: default_book_cover must be a string or null`;
  }
  if ('site_sections_visibility' in settings && settings.site_sections_visibility !== null && typeof settings.site_sections_visibility !== 'object') {
    return `${label}: site_sections_visibility must be an object or null`;
  }
  if ('powerpoint_data' in settings && settings.powerpoint_data !== null && typeof settings.powerpoint_data !== 'object') {
    return `${label}: powerpoint_data must be an object or null`;
  }
  if ('liturgy_data' in settings && settings.liturgy_data !== null && typeof settings.liturgy_data !== 'object') {
    return `${label}: liturgy_data must be an object or null`;
  }
  return null;
}

export const settingsController = {
  async getSiteSettings(req, res) {
    const settings = await settingsService.getSingleton();
    return res.json({ settings });
  },

  async upsertSiteSettings(req, res) {
    const { settings } = req.body || {};
    const error = validateSettingsPayload(settings, SITE_SETTINGS_KEYS, 'site');
    if (error) return res.status(400).json({ error });

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
    const error = validateSettingsPayload(settings, POWERPOINT_SETTINGS_KEYS, 'powerpoint');
    if (error) return res.status(400).json({ error });

    await settingsService.upsert({
      powerpoint_data: settings?.powerpoint_data,
    });
    const updated = await settingsService.getSingleton();
    return res.json({ settings: updated });
  },

  async getLiturgySettings(req, res) {
    const settings = await settingsService.getSingleton();
    return res.json({ settings });
  },

  async upsertLiturgySettings(req, res) {
    const { settings } = req.body || {};
    const error = validateSettingsPayload(settings, LITURGY_SETTINGS_KEYS, 'liturgy');
    if (error) return res.status(400).json({ error });

    await settingsService.upsert({
      liturgy_data: settings?.liturgy_data,
    });
    const updated = await settingsService.getSingleton();
    return res.json({ settings: updated });
  },
};

