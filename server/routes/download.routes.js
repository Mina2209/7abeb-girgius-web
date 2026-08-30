import { Router } from 'express';
import { settingsService } from '../services/settings.service.js';

const router = Router();

// Stable, shareable download link. Always points to /liturgy/download regardless of
// the current target, and server-side redirects to whatever the admin set as the
// download_link in the liturgy settings — so the target can change without breaking
// any shared/bookmarked URL.
router.get('/liturgy/download', async (_req, res) => {
  try {
    const settings = await settingsService.getSingleton();
    const link = settings?.liturgy_data?.download_link;
    if (typeof link === 'string' && /^https?:\/\//i.test(link)) {
      return res.redirect(302, link);
    }
    return res.status(404).json({ error: 'Download link not configured' });
  } catch (err) {
    console.error('[download] Failed to resolve liturgy download link:', err.message);
    return res.status(500).json({ error: 'Failed to resolve download link' });
  }
});

export default router;