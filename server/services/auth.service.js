import { prisma } from './prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '7d';

export const authService = {
  async login(username, password) {
    const user = await prisma.user.findUnique({ 
      where: { username },
      select: { id: true, username: true, email: true, password: true, role: true, full_name: true, church_name: true, church_role: true, services: true, avatar_url: true, tokenVersion: true, createdAt: true }
    });

    if (!user) {
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

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

  async updateUser(id, data) {
    const updateData = { ...data };

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
    await prisma.user.delete({ where: { id } });
  }
};
