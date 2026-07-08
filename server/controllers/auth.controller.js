import { authService } from '../services/auth.service.js';
import { logService } from '../services/log.service.js';

export const authController = {

  async register(req, res) {
    try {
      const { username, email, password, full_name, church_name, church_role, services } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const result = await authService.register(username, email, password, full_name, church_name, church_role, services);

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

      const user = await authService.createUser(username, password, role);
      
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
      const updates = req.body;

      const user = await authService.updateUser(id, updates);
      
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

      // Get user details before deletion for logging
      const user = await authService.getUserById(id);
      
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

      const { full_name, church_name, church_role, services, avatar_url } = req.body;

      const updateData = {
        ...(full_name !== undefined ? { full_name } : {}),
        ...(church_name !== undefined ? { church_name } : {}),
        ...(church_role !== undefined ? { church_role } : {}),
        ...(avatar_url !== undefined ? { avatar_url } : {}),
        ...(services !== undefined ? { services } : {}),
      };

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

      // Update password (authService.updateUser already hashes)
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

