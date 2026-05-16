import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '7d';

export const authService = {
  async login(username, password) {
    const user = await prisma.user.findUnique({ 
      where: { username },
      select: { id: true, username: true, password: true, role: true }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
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

  async updateUser(id, data) {
    const updateData = { ...data };
    
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    return await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, role: true, updatedAt: true }
    });
  },

  async deleteUser(id) {
    await prisma.user.delete({ where: { id } });
  }
};
