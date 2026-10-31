import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { sendMail } from '../utils/mailer.js';

const publicUserSelect = { id: true, name: true, email: true, role: true };

function signToken(user) {
  // JWT "sub" must be a string
  return jwt.sign({ sub: String(user.id), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function register(req, res) {
  const { name, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('This email is already registered', 409);

  const passwordHash = await bcrypt.hash(password, 10);

  // Public registration ALWAYS creates a CUSTOMER (role is never taken from the request)
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'CUSTOMER',
      customer: { create: { name, email } },
    },
    select: publicUserSelect,
  });

  res.status(201).json({ token: signToken(user), user });
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false;
  // Same message for "no such user" and "wrong password" so attackers learn nothing
  if (!user || !passwordOk) throw new AppError('Invalid email or password', 401);
  if (!user.isActive) throw new AppError('This account has been disabled', 403);

  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: signToken(safeUser), user: safeUser });
}

export async function me(req, res) {
  res.json({ user: req.user });
}

export async function forgotPassword(req, res) {
  const { email } = req.body;
  const genericReply = {
    message: 'If that email is registered, a password reset link has been sent.',
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return res.json(genericReply);

  // Raw token goes in the email; only its hash is stored in the database
  const rawToken = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetTokenHash: hashToken(rawToken),
      resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  const link = `${env.frontendUrl}/reset-password?token=${rawToken}`;
  try {
    await sendMail({
      to: user.email,
      subject: 'Reset your SubTrack password',
      text: `Hi ${user.name},\n\nUse this link to reset your password (valid for 1 hour):\n${link}\n\nIf you did not request this, ignore this email.`,
    });
  } catch (error) {
    console.error('Failed to send reset email:', error.message);
  }

  res.json(genericReply);
}

export async function resetPassword(req, res) {
  const { token, password } = req.body;

  const user = await prisma.user.findFirst({
    where: { resetTokenHash: hashToken(token), resetTokenExpires: { gt: new Date() } },
  });
  if (!user) throw new AppError('Reset link is invalid or has expired', 400);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      resetTokenHash: null,
      resetTokenExpires: null,
    },
  });

  res.json({ message: 'Password updated. You can now log in.' });
}