import prisma from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { parseId, parsePagination, pageResult } from '../utils/http.js';

const customerInclude = { _count: { select: { subscriptions: true, invoices: true } } };

async function assertEmailFree(email, ignoreId) {
  if (!email) return;
  const clash = await prisma.customer.findFirst({
    where: { email, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
  });
  if (clash) throw new AppError('Another customer already uses this email', 409);
}

export async function listCustomers(req, res) {
  const pagination = parsePagination(req.query);
  const { search } = req.query;

  const where = search
    ? {
        OR: [
          { name: { contains: String(search), mode: 'insensitive' } },
          { email: { contains: String(search), mode: 'insensitive' } },
          { company: { contains: String(search), mode: 'insensitive' } },
          { phone: { contains: String(search) } },
        ],
      }
    : {};

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: customerInclude,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.customer.count({ where }),
  ]);

  res.json(pageResult(customers, total, pagination));
}

export async function getCustomer(req, res) {
  const customer = await prisma.customer.findUnique({
    where: { id: parseId(req.params.id) },
    include: customerInclude,
  });
  if (!customer) throw new AppError('Customer not found', 404);
  res.json({ customer });
}

export async function createCustomer(req, res) {
  await assertEmailFree(req.body.email);
  const customer = await prisma.customer.create({ data: req.body, include: customerInclude });
  res.status(201).json({ customer });
}

export async function updateCustomer(req, res) {
  const id = parseId(req.params.id);

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw new AppError('Customer not found', 404);

  await assertEmailFree(req.body.email, id);
  const customer = await prisma.customer.update({
    where: { id },
    data: req.body,
    include: customerInclude,
  });
  res.json({ customer });
}

export async function deleteCustomer(req, res) {
  const id = parseId(req.params.id);

  const customer = await prisma.customer.findUnique({ where: { id }, include: customerInclude });
  if (!customer) throw new AppError('Customer not found', 404);

  if (customer._count.subscriptions > 0 || customer._count.invoices > 0) {
    throw new AppError('This customer has subscriptions or invoices and cannot be deleted', 409);
  }
  if (customer.userId) {
    throw new AppError('This customer has a login account. Deactivate the account instead.', 409);
  }

  await prisma.customer.delete({ where: { id } });
  res.json({ message: 'Customer deleted' });
}