import express from 'express';
import { settingsController } from '../controllers/settings.controller.js';
import { authenticate, requireEditor } from '../middleware/auth.js';

const router = express.Router();

// Site settings (singleton)
router.get('/site', settingsController.getSiteSettings);
router.put('/site', authenticate, requireEditor, settingsController.upsertSiteSettings);

// Powerpoint data settings (singleton)
router.get('/powerpoint', settingsController.getPowerpointSettings);
router.put('/powerpoint', authenticate, requireEditor, settingsController.upsertPowerpointSettings);

// Liturgy page settings (singleton)
router.get('/liturgy', settingsController.getLiturgySettings);
router.put('/liturgy', authenticate, requireEditor, settingsController.upsertLiturgySettings);

export default router;

