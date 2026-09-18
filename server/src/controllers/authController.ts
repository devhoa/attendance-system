import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../utils/auth.js';

async function ensureEmployeeProfileForUser(user: { email: string; role: string }) {
  if (user.role !== 'EMPLOYEE') {
    return null;
  }

  const normalizedEmail = String(user.email).trim().toLowerCase();
  const existingEmployee = await prisma.employee.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingEmployee) {
    return existingEmployee;
  }

  const baseName = normalizedEmail.split('@')[0] ?? 'Employee';
  const fullName = baseName
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Employee';

  return prisma.employee.create({
    data: {
      email: normalizedEmail,
      fullName,
      hourlyRate: 250000,
      isActive: true,
    },
  });
}

export async function register(req: Request, res: Response) {
  const { email, password, role } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    return res.status(409).json({ message: 'A user with this email already exists.' });
  }

  const normalizedRole = String(role ?? 'ADMIN').toUpperCase();
  const allowedRoles = ['ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'];

  if (!allowedRoles.includes(normalizedRole)) {
    return res.status(400).json({ message: 'Invalid role selected.' });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: passwordHash,
      role: normalizedRole as 'ADMIN' | 'MANAGER' | 'HR' | 'EMPLOYEE',
    },
  });

  if (user.role === 'EMPLOYEE') {
    await ensureEmployeeProfileForUser(user);
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  return res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await prisma.user.findUnique({
    where: { email: String(email).trim().toLowerCase() },
  });

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const isPasswordValid = await bcrypt.compare(String(password), user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  await ensureEmployeeProfileForUser(user);

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
}

export async function me(req: Request, res: Response) {
  const userId = (req as Request & { user?: { id: string } }).user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  return res.json({ user });
}
