import prisma from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { getUnitPrice } from './pricing.js';

export async function prepareTemplateLines(lines) {
  const prepared = [];

  for (const [index, line] of lines.entries()) {
    const label = `Line ${index + 1}`;

    const plan = await prisma.plan.findUnique({
      where: { id: line.planId },
      include: { planProducts: true },
    });
    if (!plan || !plan.isActive) throw new AppError(`${label}: plan is not available`, 400);

    if (!plan.planProducts.some((pp) => pp.productId === line.productId)) {
      throw new AppError(`${label}: this product is not part of plan "${plan.name}"`, 400);
    }
    if (line.quantity < plan.minQuantity) {
      throw new AppError(`${label}: plan "${plan.name}" needs a quantity of at least ${plan.minQuantity}`, 400);
    }

    const { product, unitPrice } = await getUnitPrice(line.productId, line.variantOptionId ?? null);
    if (!product.isActive) throw new AppError(`${label}: product "${product.name}" is inactive`, 400);

    if (line.taxId) {
      const tax = await prisma.tax.findUnique({ where: { id: line.taxId } });
      if (!tax || !tax.isActive) throw new AppError(`${label}: tax is not available`, 400);
    }

    prepared.push({
      productId: line.productId,
      planId: line.planId,
      variantOptionId: line.variantOptionId ?? null,
      taxId: line.taxId ?? null,
      quantity: line.quantity,
      unitPrice: line.unitPrice ?? unitPrice,
    });
  }

  return prepared;
}