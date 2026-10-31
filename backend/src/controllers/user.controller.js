import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { parseId, parsePagination, pageResult } from '../utils/http.js';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
};

export async function listUsers(req, res) {
  const pagination = parsePagination(req.query);
  const { role, search } = req.query;

  const where = {};
  if (['ADMIN', 'STAFF', 'CUSTOMER'].includes(role)) where.role = role;
  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: 'insensitive' } },
      { email: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.user.count({ where }),
  ]);

  res.json(pageResult(users, total, pagination));
}

export async function createStaff(req, res) {
  const { name, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('This email is already registered', 409);

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10), role: 'STAFF' },
    select: userSelect,
  });

  res.status(201).json({ user });
}

export async function updateUser(req, res) {
  const id = parseId(req.params.id);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError('User not found', 404);

  if (id === req.user.id && req.body.isActive === false) {
    throw new AppError('You cannot deactivate your own account', 400);
  }

  const user = await prisma.user.update({
    where: { id },
    data: req.body,
    select: userSelect,
  });

  res.json({ user });
}