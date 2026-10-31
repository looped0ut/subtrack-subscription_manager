import prisma from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { todayUTC } from '../utils/dates.js';
import { getUnitPrice } from './pricing.js';
import { calcLine } from './money.js';
import { nextNumber } from './sequence.js';

export const detailInclude = {
  customer: { select: { id: true, name: true, email: true } },
  plan: true,
  template: { select: { id: true, name: true, validityDays: true } },
  lines: {
    include: {
      product: { select: { id: true, name: true } },
      variantOption: { select: { id: true, value: true, extraPrice: true } },
      tax: { select: { id: true, name: true, rateBps: true } },
    },
    orderBy: { id: 'asc' },
  },
  _count: { select: { invoices: true } },
};

export function assertPlanAvailable(plan) {
  const today = todayUTC();
  const open = plan.isActive && plan.availableFrom <= today && (!plan.availableTo || plan.availableTo >= today);
  if (!open) throw new AppError(`Plan "${plan.name}" is not available for sale today`, 400);
}

export function assertDates(startDate, expiryDate) {
  if (expiryDate <= startDate) throw new AppError('Expiry date must be after the start date', 400);
}

// Validates every line against the plan and calculates prices and the per-cycle total
export async function buildLines(plan, lines) {
  const built = [];
  let totalAmount = 0;

  for (const [index, line] of lines.entries()) {
    const label = `Line ${index + 1}`;

    if (!plan.planProducts.some((pp) => pp.productId === line.productId)) {
      throw new AppError(`${label}: this product is not part of plan "${plan.name}"`, 400);
    }
    if (line.quantity < plan.minQuantity) {
      throw new AppError(`${label}: plan "${plan.name}" needs a quantity of at least ${plan.minQuantity}`, 400);
    }

    const { product, unitPrice } = await getUnitPrice(line.productId, line.variantOptionId ?? null);
    if (!product.isActive) throw new AppError(`${label}: product "${product.name}" is inactive`, 400);

    let taxRateBps = 0;
    if (line.taxId) {
      const tax = await prisma.tax.findUnique({ where: { id: line.taxId } });
      if (!tax || !tax.isActive) throw new AppError(`${label}: tax is not available`, 400);
      taxRateBps = tax.rateBps;
    }

    const price = line.unitPrice ?? unitPrice; // only template lines carry a saved price
    totalAmount += calcLine(line.quantity, price, taxRateBps).total;

    built.push({
      productId: line.productId,
      variantOptionId: line.variantOptionId ?? null,
      taxId: line.taxId ?? null,
      taxRateBps,
      quantity: line.quantity,
      unitPrice: price,
    });
  }

  return { lines: built, totalAmount };
}

export async function loadPlan(planId) {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: { planProducts: true } });
  if (!plan) throw new AppError('Plan not found', 404);
  return plan;
}

export async function createSubscription({
  customerId, planId, startDate, expiryDate, paymentTermsDays, notes, templateId = null, lines, userId,
}) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new AppError('Customer not found', 404);

  const plan = await loadPlan(planId);
  assertPlanAvailable(plan);
  assertDates(startDate, expiryDate);
  const built = await buildLines(plan, lines);

  // Number + subscription + lines are saved together or not at all
  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, 'subscription', 'SUB');
    return tx.subscription.create({
      data: {
        number,
        customerId,
        planId,
        templateId,
        startDate,
        expiryDate,
        paymentTermsDays,
        notes,
        totalAmount: built.totalAmount,
        createdById: userId,
        lines: { create: built.lines },
      },
      include: detailInclude,
    });
  });
}