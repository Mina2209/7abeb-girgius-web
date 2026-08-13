import { userActivityService, UserActivityValidationError } from '../services/userActivity.service.js';

// Controller for the admin user-activity / audit dashboard.
// The public write endpoint is intentionally bounded and never lets activity
// failures propagate to the website. All read endpoints are admin-only
// (enforced in the router via authenticate + requireAdmin).
export const AdminActivityController = {
  // POST /api/admin/activity/events — public, fire-and-forget from the browser.
  // req.user is attached by optionalAuthenticate when a valid JWT is present;
  // the server derives the identity — a client-supplied userId is ignored.
  record: async (req, res) => {
    try {
      await userActivityService.recordActivity(req.body, req.user?.id || null);
      res.status(200).json({ ok: true });
    } catch (err) {
      if (err instanceof UserActivityValidationError) {
        return res.status(400).json({ error: err.message });
      }
      // Unexpected DB error: swallow it so tracking can never break the website.
      console.error('User activity record failed (swallowed):', err);
      res.status(200).json({ ok: true });
    }
  },

  // GET /api/admin/activity
  list: async (req, res) => {
    res.json(await userActivityService.listActivities(req.query));
  },

  // GET /api/admin/activity/overview
  overview: async (req, res) => {
    res.json(await userActivityService.getOverview(req.query));
  },

  // GET /api/admin/activity/users
  users: async (req, res) => {
    res.json(await userActivityService.getUsers(req.query));
  },

  // GET /api/admin/activity/actions
  actions: async (req, res) => {
    res.json(await userActivityService.getActions(req.query));
  },

  // GET /api/admin/activity/recent
  recent: async (req, res) => {
    res.json(await userActivityService.getRecent(req.query));
  },
};
