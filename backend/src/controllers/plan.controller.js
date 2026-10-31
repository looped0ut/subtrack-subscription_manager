import prisma from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { parseId, parsePagination, pageResult } from '../utils/http.js';
import { todayUTC } from '../utils/dates.js';

const planInclude = {
  planProducts: { include: { product: { select: { id: true, name: true, salesPrice: true } } } },
  _count: { select: { subscriptions: true } },
};

function assertDates(from, to) {
  if (to && to < from) {
    throw new AppError('Availability end date must be on or after the start date', 400);
  }
}

async function validProductIds(ids) {
  const unique = [...new Set(ids)];
  const found = await prisma.product.count({ where: { id: { in: unique }, isActive: true } });
  if (found !== unique.length) {
    throw new AppError('One or more selected products do not exist or are inactive', 400);
  }
  return unique;
}

export async function listPlans(req, res) {
  const pagination = parsePagination(req.query);
  const { search, active, available } = req.query;

  const and = [];
  if (search) and.push({ name: { contains: String(search), mode: 'insensitive' } });
  if (active === 'true') and.push({ isActive: true });
  if (active === 'false') and.push({ isActive: false });
  if (available === 'true') {
    // Active AND today falls inside the availability window
    const today = todayUTC();
    and.push({ isActive: true, availableFrom: { lte: today } });
    and.push({ OR: [{ availableTo: null }, { availableTo: { gte: today } }] });
  }
  const where = and.length ? { AND: and } : {};

  const [plans, total] = await Promise.all([
    prisma.plan.findMany({
      where,
      include: planInclude,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.plan.count({ where }),
  ]);

  res.json(pageResult(plans, total, pagination));
}

export async function getPlan(req, res) {
  const plan = await prisma.plan.findUnique({
    where: { id: parseId(req.params.id) },
    include: planInclude,
  });
  if (!plan) throw new AppError('Plan not found', 404);
  res.json({ plan });
}

export async function createPlan(req, res) {
  const { productIds, ...data } = req.body;
  assertDates(data.availableFrom, data.availableTo);
  const ids = await validProductIds(productIds);

  const plan = await prisma.plan.create({
    data: { ...data, planProducts: { create: ids.map((productId) => ({ productId })) } },
    include: planInclude,
  });
  res.status(201).json({ plan });
}

export async function updatePlan(req, res) {
  const id = parseId(req.params.id);
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) throw new AppError('Plan not found', 404);

  const { productIds, ...data } = req.body;
  assertDates(
    data.availableFrom ?? existing.availableFrom,
    data.availableTo !== undefined ? data.availableTo : existing.availableTo
  );

  const updateData = { ...data };
  if (productIds) {
    const ids = await validProductIds(productIds);
    updateData.planProducts = { deleteMany: {}, create: ids.map((productId) => ({ productId })) };
  }

  const plan = await prisma.plan.update({ where: { id }, data: updateData, include: planInclude });
  res.json({ plan });
}

export async function deletePlan(req, res) {
  const id = parseId(req.params.id);
  const plan = await prisma.plan.findUnique({
    where: { id },
    include: { _count: { select: { subscriptions: true, quotationTemplateLines: true } } },
  });
  if (!plan) throw new AppError('Plan not found', 404);

  if (plan._count.subscriptions + plan._count.quotationTemplateLines > 0) {
    await prisma.plan.update({ where: { id }, data: { isActive: false } });
    return res.json({
      message: 'This plan is already in use, so it was deactivated instead of deleted.',
      deactivated: true,
    });
  }

  await prisma.plan.delete({ where: { id } });
  res.json({ message: 'Plan deleted', deactivated: false });
}