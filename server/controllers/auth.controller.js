import { authService } from '../services/auth.service.js';
import { logService } from '../services/log.service.js';

export const authController = {
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
      const { userId, entity, limit } = req.query;
      const logs = await logService.getAllLogs({ userId, entity, limit: limit ? parseInt(limit) : 100 });
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
  }
};
