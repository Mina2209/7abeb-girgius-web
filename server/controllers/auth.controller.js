import { authService } from '../services/auth.service.js';
import { logService } from '../services/log.service.js';

export const authController = {

  async register(req, res) {
    try {
      const { username, email, password, full_name, church_name, church_role, services } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 50) {
        return res.status(400).json({ error: 'Username must be a string between 3 and 50 characters' });
      }

      if (password.length < 6 || password.length > 128) {
        return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
      }

      if (email !== undefined && email !== null) {
        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) {
          return res.status(400).json({ error: 'Invalid email format' });
        }
      }

      const PROFILE_FIELDS = ['full_name', 'church_name', 'church_role'];
      for (const field of PROFILE_FIELDS) {
        const val = req.body[field];
        if (val !== undefined && val !== null) {
          if (typeof val !== 'string') {
            return res.status(400).json({ error: `${field} must be a string` });
          }
          if (val.trim().length > 200) {
            return res.status(400).json({ error: `${field} must not exceed 200 characters` });
          }
        }
      }

      if (services !== undefined && services !== null) {
        if (!Array.isArray(services)) {
          return res.status(400).json({ error: 'services must be an array' });
        }
        if (services.length > 50) {
          return res.status(400).json({ error: 'services must not exceed 50 items' });
        }
        for (let i = 0; i < services.length; i++) {
          if (typeof services[i] !== 'string') {
            return res.status(400).json({ error: `services[${i}] must be a string` });
          }
          if (services[i].trim().length > 100) {
            return res.status(400).json({ error: `services[${i}] must not exceed 100 characters` });
          }
        }
      }

      const result = await authService.register(
        username.trim(), email?.trim() || null, password,
        full_name?.trim() || null, church_name?.trim() || null,
        church_role?.trim() || null, services || []
      );

      await logService.createLog(
        result.user.id,
        'REGISTER',
        'USER',
        result.user.id,
        `User ${username} registered`
      );

      res.status(201).json(result);
    } catch (error) {
      console.error('Register error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const result = await authService.login(username, password);
      
      // Log the login action
      await logService.createLog(
        result.user.id,
        'LOGIN',
        'USER',
        result.user.id,
        `User ${username} logged in`
      );

      res.json(result);
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({ error: error.message });
    }
  },

  async createUser(req, res) {
    try {
      const { username, password, role } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const ALLOWED_ROLES = ['ADMIN', 'EDITOR', 'VIEWER'];
      const roleValue = role || 'EDITOR';
      if (!ALLOWED_ROLES.includes(roleValue)) {
        return res.status(400).json({ error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}` });
      }

      if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 50) {
        return res.status(400).json({ error: 'Username must be a string between 3 and 50 characters' });
      }

      if (password.length < 6 || password.length > 128) {
        return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
      }

      const user = await authService.createUser(username.trim(), password, roleValue);
      
      // Log user creation by admin
      await logService.createLog(
        req.user.id,
        'CREATE',
        'USER',
        user.id,
        `Admin created user: ${username} with role ${role || 'EDITOR'}`
      );

      res.status(201).json(user);
    } catch (error) {
      console.error('Create user error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  async getAllUsers(req, res) {
    try {
      const users = await authService.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await authService.getUserById(id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async updateUser(req, res) {
    try {
      const { id } = req.params;

      // Explicit allowlist: only these fields may be set by an admin via this endpoint.
      // password is handled separately (hashes + bumps tokenVersion).
      // role is intentionally allowed — admin role management is a product requirement.
      // tokenVersion, id, createdAt, updatedAt, and relation fields are NEVER writable.
      const ADMIN_UPDATE_FIELDS = ['username', 'password', 'role'];
      const updates = {};
      for (const field of ADMIN_UPDATE_FIELDS) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (updates.role !== undefined) {
        const ALLOWED_ROLES = ['ADMIN', 'EDITOR', 'VIEWER'];
        if (!ALLOWED_ROLES.includes(updates.role)) {
          return res.status(400).json({ error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}` });
        }
      }

      const user = await authService.updateUser(id, updates, { requestingUserId: req.user.id });
      
      // Log user update by admin
      await logService.createLog(
        req.user.id,
        'UPDATE',
        'USER',
        id,
        `Admin updated user: ${user.username}`
      );

      res.json(user);
    } catch (error) {
      console.error('Update user error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Prevent admin from deleting themselves
      if (req.user.id === id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      // Get user details before deletion for logging
      const user = await authService.getUserById(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent deleting the last admin
      if (user.role === 'ADMIN') {
        const admins = await authService.getAdminCount();
        if (admins <= 1) {
          return res.status(400).json({ error: 'Cannot delete the last admin account' });
        }
      }

      await authService.deleteUser(id);
      
      // Log user deletion by admin
      await logService.createLog(
        req.user.id,
        'DELETE',
        'USER',
        id,
        `Admin deleted user: ${user?.username}`
      );

      res.status(204).send();
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  async getAllLogs(req, res) {
    try {
      const { userId, entity, limit, page } = req.query;
      const lim = limit ? parseInt(limit) : 100;
      const skip = page ? (Math.max(1, parseInt(page)) - 1) * lim : 0;
      const logs = await logService.getAllLogs({ userId, entity, limit: lim, skip });
      res.json(logs);
    } catch (error) {
      console.error('Get logs error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async getLogsByUserId(req, res) {
    try {
      const { userId } = req.params;
      const logs = await logService.getLogsByUserId(userId);
      res.json(logs);
    } catch (error) {
      console.error('Get user logs error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async getProfile(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const profile = await authService.getProfile(userId);
      if (!profile) return res.status(404).json({ error: 'User not found' });

      return res.json(profile);
    } catch (error) {
      console.error('Get profile error:', error);
      return res.status(400).json({ error: error.message || 'Failed to get profile' });
    }
  },

  async updateProfile(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const ALLOWED_PROFILE_FIELDS = ['full_name', 'church_name', 'church_role', 'avatar_url'];
      const updateData = {};

      for (const field of ALLOWED_PROFILE_FIELDS) {
        const val = req.body[field];
        if (val !== undefined) {
          if (typeof val !== 'string') {
            return res.status(400).json({ error: `${field} must be a string` });
          }
          if (val.trim().length > 200) {
            return res.status(400).json({ error: `${field} must not exceed 200 characters` });
          }
          updateData[field] = val.trim() || null;
        }
      }

      const { services } = req.body;
      if (services !== undefined) {
        if (!Array.isArray(services)) {
          return res.status(400).json({ error: 'services must be an array' });
        }
        if (services.length > 50) {
          return res.status(400).json({ error: 'services must not exceed 50 items' });
        }
        for (let i = 0; i < services.length; i++) {
          if (typeof services[i] !== 'string') {
            return res.status(400).json({ error: `services[${i}] must be a string` });
          }
          if (services[i].trim().length > 100) {
            return res.status(400).json({ error: `services[${i}] must not exceed 100 characters` });
          }
        }
        updateData.services = services.map(s => s.trim());
      }

      const updated = await authService.updateProfile(userId, updateData);

      await logService.createLog(
        userId,
        'UPDATE',
        'USER',
        userId,
        'User updated own profile'
      );

      return res.json(updated);
    } catch (error) {
      console.error('Update profile error:', error);
      return res.status(400).json({ error: error.message || 'Failed to update profile' });
    }
  },

  async changePassword(req, res) {

    try {
      const userId = req.user?.id;
      const { currentPassword, newPassword } = req.body;


      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'currentPassword and newPassword are required' });
      }
      if (String(newPassword).length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      // Read hashed password from DB and verify
      const user = await authService.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const isValidPassword = await authService.verifyPassword(userId, currentPassword);

      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Update password — authService.updateUser hashes it AND increments tokenVersion,
      // which invalidates all outstanding JWTs for this user.
      await authService.updateUser(userId, { password: newPassword });

      // Log action
      await logService.createLog(
        userId,
        'UPDATE',
        'USER',
        userId,
        'User changed own password'
      );

      return res.json({ ok: true });
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(400).json({ error: error.message || 'Failed to change password' });
    }
  }
};

