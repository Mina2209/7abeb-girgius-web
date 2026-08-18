import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────
const { settingsServiceMock } = vi.hoisted(() => ({
  settingsServiceMock: {
    getSingleton: vi.fn().mockResolvedValue({ default_book_cover: null, site_sections_visibility: {}, powerpoint_data: null }),
    upsert: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock('../services/settings.service.js', () => ({ settingsService: settingsServiceMock }));

// ── Imports ─────────────────────────────────────────────────────────────
import express from 'express';
import request from 'supertest';
import { settingsController } from '../controllers/settings.controller.js';

// ── App factory ─────────────────────────────────────────────────────────
function buildSiteApp() {
  const app = express();
  app.use(express.json());
  app.put('/site', settingsController.upsertSiteSettings);
  return app;
}

function buildPowerpointApp() {
  const app = express();
  app.use(express.json());
  app.put('/powerpoint', settingsController.upsertPowerpointSettings);
  return app;
}

// ── Tests ───────────────────────────────────────────────────────────────
describe('settings.controller – site settings validation', () => {
  beforeEach(() => {
    settingsServiceMock.upsert.mockClear();
    settingsServiceMock.getSingleton.mockResolvedValue({ default_book_cover: null, site_sections_visibility: {}, powerpoint_data: null });
  });

  it('accepts valid payload with known keys only', async () => {
    const res = await request(buildSiteApp())
      .put('/site')
      .send({ settings: { default_book_cover: '/img/cover.jpg', site_sections_visibility: { hymns: true } } });
    expect(res.status).toBe(200);
    expect(settingsServiceMock.upsert).toHaveBeenCalledOnce();
  });

  it('accepts null values for optional fields', async () => {
    const res = await request(buildSiteApp())
      .put('/site')
      .send({ settings: { default_book_cover: null, site_sections_visibility: null } });
    expect(res.status).toBe(200);
  });

  it('rejects unknown keys with 400', async () => {
    const res = await request(buildSiteApp())
      .put('/site')
      .send({ settings: { default_book_cover: '/x', evil_field: 'hack' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown fields/i);
    expect(res.body.error).toMatch(/evil_field/);
    expect(settingsServiceMock.upsert).not.toHaveBeenCalled();
  });

  it('rejects non-object settings (string)', async () => {
    const res = await request(buildSiteApp())
      .put('/site')
      .send({ settings: 'not-an-object' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be an object/i);
  });

  it('rejects non-object settings (array)', async () => {
    const res = await request(buildSiteApp())
      .put('/site')
      .send({ settings: [1, 2, 3] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be an object/i);
  });

  it('rejects missing settings entirely', async () => {
    const res = await request(buildSiteApp())
      .put('/site')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be an object/i);
  });

  it('rejects default_book_cover as a number', async () => {
    const res = await request(buildSiteApp())
      .put('/site')
      .send({ settings: { default_book_cover: 123 } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/default_book_cover must be a string/i);
  });

  it('rejects site_sections_visibility as a string', async () => {
    const res = await request(buildSiteApp())
      .put('/site')
      .send({ settings: { site_sections_visibility: 'bad' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/site_sections_visibility must be an object/i);
  });

  it('accepts empty settings object (no-op update)', async () => {
    const res = await request(buildSiteApp())
      .put('/site')
      .send({ settings: {} });
    expect(res.status).toBe(200);
  });
});

describe('settings.controller – powerpoint settings validation', () => {
  beforeEach(() => {
    settingsServiceMock.upsert.mockClear();
    settingsServiceMock.getSingleton.mockResolvedValue({ default_book_cover: null, site_sections_visibility: {}, powerpoint_data: null });
  });

  it('accepts valid powerpoint_data object', async () => {
    const res = await request(buildPowerpointApp())
      .put('/powerpoint')
      .send({ settings: { powerpoint_data: { slides: [] } } });
    expect(res.status).toBe(200);
  });

  it('rejects unknown key powerpoint endpoint', async () => {
    const res = await request(buildPowerpointApp())
      .put('/powerpoint')
      .send({ settings: { powerpoint_data: {}, extra: true } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown fields/i);
    expect(res.body.error).toMatch(/extra/);
  });

  it('rejects powerpoint_data as a string', async () => {
    const res = await request(buildPowerpointApp())
      .put('/powerpoint')
      .send({ settings: { powerpoint_data: 'nope' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/powerpoint_data must be an object/i);
  });

  it('rejects cross-endpoint field injection', async () => {
    // Trying to set default_book_cover through the powerpoint endpoint
    const res = await request(buildPowerpointApp())
      .put('/powerpoint')
      .send({ settings: { default_book_cover: '/evil' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown fields/i);
  });
});
