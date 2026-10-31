import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export async function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Authentication required', 401);
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }

  // Always re-check the database so disabled users are blocked immediately
  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) {
    throw new AppError('Account not found or disabled', 401);
  }

  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  if (!roles.includes(req.user.role)) {
    throw new AppError('You do not have permission to do this', 403);
  }
  next();
};