import prisma from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { parseId } from '../utils/http.js';

export async function listTaxes(req, res) {
  const where = req.query.active === 'true' ? { isActive: true } : {};
  const taxes = await prisma.tax.findMany({ where, orderBy: { name: 'asc' } });
  res.json({ data: taxes });
}

export async function createTax(req, res) {
  const tax = await prisma.tax.create({ data: req.body });
  res.status(201).json({ tax });
}

export async function updateTax(req, res) {
  const id = parseId(req.params.id);
  const existing = await prisma.tax.findUnique({ where: { id } });
  if (!existing) throw new AppError('Tax not found', 404);

  const tax = await prisma.tax.update({ where: { id }, data: req.body });
  res.json({ tax });
}

export async function deleteTax(req, res) {
  const id = parseId(req.params.id);
  const existing = await prisma.tax.findUnique({ where: { id } });
  if (!existing) throw new AppError('Tax not found', 404);

  const [lines, templateLines] = await Promise.all([
    prisma.subscriptionLine.count({ where: { taxId: id } }),
    prisma.quotationTemplateLine.count({ where: { taxId: id } }),
  ]);
  if (lines + templateLines > 0) {
    throw new AppError('This tax is in use. Deactivate it instead of deleting it.', 409);
  }

  await prisma.tax.delete({ where: { id } });
  res.json({ message: 'Tax deleted' });
}