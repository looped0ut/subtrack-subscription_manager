import prisma from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { parseId, parsePagination, pageResult } from '../utils/http.js';
import { todayUTC, addDays } from '../utils/dates.js';
import {
  detailInclude,
  createSubscription,
  assertPlanAvailable,
  assertDates,
  buildLines,
  loadPlan,
} from '../services/subscriptionService.js';

const STATUSES = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'CLOSED'];

// ---------------- Read ----------------

export async function listSubscriptions(req, res) {
  const pagination = parsePagination(req.query);
  const { status, customerId, search } = req.query;

  const where = {};
  if (STATUSES.includes(status)) where.status = status;
  if (customerId) where.customerId = parseId(customerId);
  if (search) {
    where.OR = [
      { number: { contains: String(search), mode: 'insensitive' } },
      { customer: { name: { contains: String(search), mode: 'insensitive' } } },
    ];
  }

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true, billingFrequency: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.subscription.count({ where }),
  ]);

  res.json(pageResult(subscriptions, total, pagination));
}

export async function getSubscription(req, res) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: parseId(req.params.id) },
    include: detailInclude,
  });
  if (!subscription) throw new AppError('Subscription not found', 404);
  res.json({ subscription });
}

// ---------------- Create / edit / delete ----------------

export async function createManual(req, res) {
  const subscription = await createSubscription({ ...req.body, userId: req.user.id });
  res.status(201).json({ subscription });
}

export async function createFromTemplate(req, res) {
  const template = await prisma.quotationTemplate.findUnique({
    where: { id: parseId(req.params.templateId) },
    include: { lines: true },
  });
  if (!template) throw new AppError('Template not found', 404);
  if (!template.isActive) throw new AppError('This template is not active', 400);

  // A subscription has ONE plan, so we pick the template lines for one plan
  const planIds = [...new Set(template.lines.map((line) => line.planId))];
  const planId = req.body.planId ?? (planIds.length === 1 ? planIds[0] : null);
  if (!planId) {
    throw new AppError(`This template uses several plans (${planIds.join(', ')}). Send "planId" to choose one.`, 400);
  }
  if (!planIds.includes(planId)) throw new AppError('The template has no lines for that plan', 400);

  const lines = template.lines
    .filter((line) => line.planId === planId)
    .map((line) => ({
      productId: line.productId,
      variantOptionId: line.variantOptionId,
      taxId: line.taxId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    }));

  const { customerId, startDate, expiryDate, paymentTermsDays, notes } = req.body;
  const subscription = await createSubscription({
    customerId, planId, startDate, expiryDate, paymentTermsDays, notes,
    templateId: template.id, lines, userId: req.user.id,
  });
  res.status(201).json({ subscription });
}

export async function updateSubscription(req, res) {
  const id = parseId(req.params.id);
  const existing = await prisma.subscription.findUnique({ where: { id }, include: { plan: true } });
  if (!existing) throw new AppError('Subscription not found', 404);
  if (existing.status !== 'DRAFT') {
    throw new AppError('Only a DRAFT subscription can be edited', 400);
  }

  const { lines, planId, customerId, ...rest } = req.body;
  const data = { ...rest };

  if (customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new AppError('Customer not found', 404);
    data.customerId = customerId;
  }

  const planChanged = planId && planId !== existing.planId;
  if (planChanged && !lines) throw new AppError('Send the lines again when you change the plan', 400);

  assertDates(rest.startDate ?? existing.startDate, rest.expiryDate ?? existing.expiryDate);

  if (lines) {
    const plan = planChanged ? await loadPlan(planId) : await loadPlan(existing.planId);
    assertPlanAvailable(plan);
    const built = await buildLines(plan, lines);
    data.planId = plan.id;
    data.totalAmount = built.totalAmount;
    data.lines = { deleteMany: {}, create: built.lines };
  }

  const subscription = await prisma.subscription.update({ where: { id }, data, include: detailInclude });
  res.json({ subscription });
}

export async function deleteSubscription(req, res) {
  const id = parseId(req.params.id);
  const existing = await prisma.subscription.findUnique({ where: { id } });
  if (!existing) throw new AppError('Subscription not found', 404);
  if (existing.status !== 'DRAFT') throw new AppError('Only a DRAFT subscription can be deleted. Close it instead.', 400);

  await prisma.subscription.delete({ where: { id } });
  res.json({ message: 'Subscription deleted' });
}

// ---------------- Lifecycle actions ----------------

async function loadForAction(req) {
  const id = parseId(req.params.id);
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: { plan: true, template: { select: { validityDays: true } }, _count: { select: { lines: true } } },
  });
  if (!subscription) throw new AppError('Subscription not found', 404);
  return subscription;
}

function requireStatus(subscription, allowed, action) {
  if (!allowed.includes(subscription.status)) {
    throw new AppError(`Cannot ${action} while the subscription is ${subscription.status}`, 400);
  }
}

// One atomic UPDATE ... WHERE status IN (...) so two clicks can never double-apply
async function moveTo(id, fromStatuses, data) {
  const result = await prisma.subscription.updateMany({ where: { id, status: { in: fromStatuses } }, data });
  if (result.count === 0) throw new AppError('The status just changed. Reload and try again.', 409);
  return prisma.subscription.findUnique({ where: { id }, include: detailInclude });
}

export async function sendQuote(req, res) {
  const sub = await loadForAction(req);
  requireStatus(sub, ['DRAFT', 'QUOTATION'], 'send a quote');
  if (sub._count.lines === 0) throw new AppError('Add at least one line first', 400);

  const validityDays = sub.template?.validityDays ?? 30;
  const subscription = await moveTo(sub.id, ['DRAFT', 'QUOTATION'], {
    status: 'QUOTATION',
    quotationValidUntil: addDays(todayUTC(), validityDays),
  });
  res.json({ subscription });
}

export async function confirm(req, res) {
  const sub = await loadForAction(req);
  requireStatus(sub, ['QUOTATION'], 'confirm');
  if (sub.quotationValidUntil && sub.quotationValidUntil < todayUTC()) {
    throw new AppError('The quotation has expired. Send a new quote first.', 400);
  }
  const subscription = await moveTo(sub.id, ['QUOTATION'], { status: 'CONFIRMED' });
  res.json({ subscription });
}

export async function activate(req, res) {
  const sub = await loadForAction(req);
  requireStatus(sub, ['CONFIRMED'], 'activate');
  if (sub.expiryDate < todayUTC()) throw new AppError('This subscription is already past its expiry date', 400);

  // Billing starts from the start date
  const subscription = await moveTo(sub.id, ['CONFIRMED'], {
    status: 'ACTIVE',
    nextBillingDate: sub.startDate,
  });
  res.json({ subscription });
}

export async function pause(req, res) {
  const sub = await loadForAction(req);
  requireStatus(sub, ['ACTIVE'], 'pause');
  if (!sub.plan.allowPause) throw new AppError(`Plan "${sub.plan.name}" does not allow pausing`, 400);

  const subscription = await moveTo(sub.id, ['ACTIVE'], { status: 'PAUSED', pausedAt: new Date() });
  res.json({ subscription });
}

export async function resume(req, res) {
  const sub = await loadForAction(req);
  requireStatus(sub, ['PAUSED'], 'resume');

  // Paused days are credited (up to the plan's limit) by moving the dates forward
  const pausedDay = new Date(sub.pausedAt.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const pausedDays = Math.max(0, Math.round((todayUTC() - pausedDay) / 86400000));
  const credit = sub.plan.maxPauseDays ? Math.min(pausedDays, sub.plan.maxPauseDays) : pausedDays;

  const subscription = await moveTo(sub.id, ['PAUSED'], {
    status: 'ACTIVE',
    pausedAt: null,
    expiryDate: addDays(sub.expiryDate, credit),
    nextBillingDate: sub.nextBillingDate ? addDays(sub.nextBillingDate, credit) : null,
  });
  res.json({ subscription, creditedDays: credit });
}

export async function renew(req, res) {
  const sub = await loadForAction(req);
  requireStatus(sub, ['ACTIVE'], 'renew');
  if (req.body.expiryDate <= sub.expiryDate) {
    throw new AppError('The new expiry date must be after the current expiry date', 400);
  }
  const subscription = await moveTo(sub.id, ['ACTIVE'], { expiryDate: req.body.expiryDate });
  res.json({ subscription });
}

export async function close(req, res) {
  const sub = await loadForAction(req);
  requireStatus(sub, ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED'], 'close');

  const running = ['ACTIVE', 'PAUSED'].includes(sub.status);
  if (running && todayUTC() < sub.expiryDate && !sub.plan.allowEarlyClosure) {
    throw new AppError(`Plan "${sub.plan.name}" does not allow early closure`, 400);
  }

  const subscription = await moveTo(sub.id, [sub.status], {
    status: 'CLOSED',
    closedAt: new Date(),
    closedReason: req.body.reason ?? null,
    nextBillingDate: null,
    pausedAt: null,
  });
  res.json({ subscription });
}