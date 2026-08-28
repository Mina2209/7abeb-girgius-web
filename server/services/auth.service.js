import { prisma } from './prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '7d';

// Progressive delay configuration for failed login attempts
// Increases delay after each failed attempt to slow down brute-force attacks
const LOGIN_DELAY_CONFIG = {
  // Delay in milliseconds for each attempt level
  // Attempt 1: 0ms, Attempt 2: 1s, Attempt 3: 2s, etc.
  baseDelayMs: 1000,
  maxDelayMs: 30000, // Max 30 second delay
  // Reset failure count after this many seconds of inactivity
  failureWindowSeconds: 900, // 15 minutes
};

// In-memory store for login failure tracking
// In production, consider using Redis for distributed systems
const loginFailures = new Map();

function getFailureKey(username) {
  return `login:${username?.toLowerCase()}`;
}

function getFailureData(key) {
  const data = loginFailures.get(key);
  if (!data) return { count: 0, lastAttempt: 0 };

  // Reset if outside failure window
  const now = Date.now();
  if (now - data.lastAttempt > LOGIN_DELAY_CONFIG.failureWindowSeconds * 1000) {
    loginFailures.delete(key);
    return { count: 0, lastAttempt: 0 };
  }

  return data;
}

function recordFailure(username) {
  const key = getFailureKey(username);
  const data = getFailureData(key);
  data.count += 1;
  data.lastAttempt = Date.now();
  loginFailures.set(key, data);
  return data;
}

function clearFailures(username) {
  const key = getFailureKey(username);
  loginFailures.delete(key);
}

function getDelayForAttempt(attemptCount) {
  if (attemptCount <= 1) return 0;
  const delay = Math.min(
    LOGIN_DELAY_CONFIG.baseDelayMs * Math.pow(2, attemptCount - 2),
    LOGIN_DELAY_CONFIG.maxDelayMs
  );
  return delay;
}

export const authService = {
  async login(username, password) {
    // Check for progressive delay based on failed attempts
    const failureData = getFailureData(getFailureKey(username));
    if (failureData.count > 0) {
      const delay = getDelayForAttempt(failureData.count);
      if (delay > 0) {
        // Add delay to slow down brute-force attacks
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const user = await prisma.user.findUnique({ 
      where: { username },
      select: { id: true, username: true, email: true, password: true, role: true, full_name: true, church_name: true, church_role: true, services: true, avatar_url: true, tokenVersion: true, createdAt: true }
    });

    if (!user) {
      // Record failure even for non-existent users to prevent username enumeration timing
      recordFailure(username);
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      // Record failure for wrong password
      recordFailure(username);
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    // Clear failures on successful login
    clearFailures(username);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        church_name: user.church_name,
        church_role: user.church_role,
        services: user.services,
        avatar_url: user.avatar_url,
        created_at: user.createdAt,
      }
    };
  },

  async verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  },

  async register(username, email, password, full_name, church_name, church_role, services) {
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      throw new Error('البريد الإلكتروني مستخدم بالفعل');
    }

    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        throw new Error('البريد الإلكتروني مستخدم بالفعل');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'VIEWER',
        full_name,
        church_name,
        church_role,
        services: services || [],
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        full_name: true,
        church_name: true,
        church_role: true,
        services: true,
        avatar_url: true,
        createdAt: true,
      }
    });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return { token, user };
  },

  async createUser(username, password, role = 'EDITOR') {
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      throw new Error('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role
      },
      select: { id: true, username: true, role: true, createdAt: true }
    });

    return user;
  },

  async getAllUsers() {
    return await prisma.user.findMany({
      select: { 
        id: true, 
        username: true, 
        role: true, 
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getUserById(id) {
    return await prisma.user.findUnique({
      where: { id },
      select: { 
        id: true, 
        username: true, 
        role: true, 
        createdAt: true,
        updatedAt: true
      }
    });
  },

  async verifyPassword(userId, password) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) return false;
    return bcrypt.compare(password, user.password);
  },

  async updateUser(id, data, options = {}) {
    // Defensive strip: tokenVersion is ONLY incremented internally (on password change or role change),
    // never accepted from external callers.
    const { tokenVersion: _tv, id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = data;
    const updateData = { ...rest };

    // Check if role is being changed
    if (data.role) {
      const ALLOWED_ROLES = ['ADMIN', 'EDITOR', 'VIEWER'];
      if (!ALLOWED_ROLES.includes(data.role)) {
        throw new Error(`Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}`);
      }

      // Fetch current user to check if role actually changed
      const currentUser = await prisma.user.findUnique({
        where: { id },
        select: { role: true, tokenVersion: true },
      });

      if (currentUser && currentUser.role !== data.role) {
        // Last-admin guard: prevent demoting the last admin
        if (currentUser.role === 'ADMIN' && data.role !== 'ADMIN') {
          const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
          if (adminCount <= 1) {
            throw new Error('Cannot change the role of the last admin account');
          }
        }

        // Role changed - increment tokenVersion to invalidate existing JWTs
        // This prevents a demoted user from continuing to use their old token
        updateData.tokenVersion = { increment: 1 };
      }
    }

    // Check if password is being changed
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
      // Increment tokenVersion to invalidate all outstanding JWTs when password changes.
      // This covers both self-service (changePassword) and admin-initiated password resets.
      updateData.tokenVersion = { increment: 1 };
    }

    return await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, role: true, updatedAt: true }
    });
  },

  async getProfile(id) {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        full_name: true,
        church_name: true,
        church_role: true,
        services: true,
        avatar_url: true,
        createdAt: true,
        updatedAt: true,
        role: true,
      },
    });
  },

  async updateProfile(id, data) {
    // profile fields are stored as full_name/church_name/church_role/services/avatar_url in DB
    // If fields are not present in schema, Prisma will throw during runtime.
    const updateData = {
      ...(data.full_name !== undefined ? { full_name: data.full_name } : {}),
      ...(data.church_name !== undefined ? { church_name: data.church_name } : {}),
      ...(data.church_role !== undefined ? { church_role: data.church_role } : {}),
      ...(data.services !== undefined ? { services: data.services } : {}),
      ...(data.avatar_url !== undefined ? { avatar_url: data.avatar_url } : {}),
    };

    return await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        full_name: true,
        church_name: true,
        church_role: true,
        services: true,
        avatar_url: true,
        createdAt: true,
        updatedAt: true,
        role: true,
      },
    });
  },


  async deleteUser(id) {
    // Last-admin guard
    const user = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (user && user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        throw new Error('Cannot delete the last admin account');
      }
    }
    await prisma.user.delete({ where: { id } });
  },

  async getAdminCount() {
    return prisma.user.count({ where: { role: 'ADMIN' } });
  }
};
