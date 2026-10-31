import prisma from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { parseId, parsePagination, pageResult } from '../utils/http.js';
import { getUnitPrice } from '../services/pricing.js';

const withVariants = {
  variants: { include: { options: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } },
};

// ---------------- Products ----------------

export async function listProducts(req, res) {
  const pagination = parsePagination(req.query);
  const { search, type, active } = req.query;

  const where = {};
  if (search) where.name = { contains: String(search), mode: 'insensitive' };
  if (['SOFTWARE', 'ADDON', 'SERVICE', 'OTHER'].includes(type)) where.type = type;
  if (active === 'true') where.isActive = true;
  if (active === 'false') where.isActive = false;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { _count: { select: { variants: true } } },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.product.count({ where }),
  ]);

  res.json(pageResult(products, total, pagination));
}

export async function getProduct(req, res) {
  const product = await prisma.product.findUnique({
    where: { id: parseId(req.params.id) },
    include: withVariants,
  });
  if (!product) throw new AppError('Product not found', 404);
  res.json({ product });
}

export async function createProduct(req, res) {
  const { variants = [], ...data } = req.body;

  // One call creates the product, its variants and their options together
  const product = await prisma.product.create({
    data: {
      ...data,
      variants: {
        create: variants.map((variant) => ({
          name: variant.name,
          options: { create: variant.options },
        })),
      },
    },
    include: withVariants,
  });

  res.status(201).json({ product });
}

export async function updateProduct(req, res) {
  const id = parseId(req.params.id);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError('Product not found', 404);

  const product = await prisma.product.update({ where: { id }, data: req.body, include: withVariants });
  res.json({ product });
}

export async function deleteProduct(req, res) {
  const id = parseId(req.params.id);
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          planProducts: true,
          subscriptionLines: true,
          quotationTemplateLines: true,
          invoiceLines: true,
          discountProducts: true,
        },
      },
    },
  });
  if (!product) throw new AppError('Product not found', 404);

  const usage = Object.values(product._count).reduce((sum, n) => sum + n, 0);
  if (usage > 0) {
    // Business rule: a product with history is deactivated, never destroyed
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    return res.json({
      message: 'This product is already in use, so it was deactivated instead of deleted.',
      deactivated: true,
    });
  }

  await prisma.product.delete({ where: { id } });
  res.json({ message: 'Product deleted', deactivated: false });
}

export async function productPrice(req, res) {
  const productId = parseId(req.params.id);
  const optionId = req.query.optionId ? parseId(req.query.optionId) : null;

  const { basePrice, extraPrice, unitPrice } = await getUnitPrice(productId, optionId);
  res.json({ productId, optionId, basePrice, extraPrice, unitPrice });
}

// ---------------- Variants and options ----------------

export async function createVariant(req, res) {
  const productId = parseId(req.params.id);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('Product not found', 404);

  const variant = await prisma.productVariant.create({
    data: { productId, name: req.body.name, options: { create: req.body.options } },
    include: { options: true },
  });
  res.status(201).json({ variant });
}

export async function updateVariant(req, res) {
  const id = parseId(req.params.id);
  const existing = await prisma.productVariant.findUnique({ where: { id } });
  if (!existing) throw new AppError('Variant not found', 404);

  const variant = await prisma.productVariant.update({
    where: { id },
    data: { name: req.body.name },
    include: { options: true },
  });
  res.json({ variant });
}

async function optionsInUse(where) {
  const [lines, templateLines] = await Promise.all([
    prisma.subscriptionLine.count({ where }),
    prisma.quotationTemplateLine.count({ where }),
  ]);
  return lines + templateLines > 0;
}

export async function deleteVariant(req, res) {
  const id = parseId(req.params.id);
  const existing = await prisma.productVariant.findUnique({ where: { id } });
  if (!existing) throw new AppError('Variant not found', 404);

  if (await optionsInUse({ variantOption: { variantId: id } })) {
    throw new AppError('Options of this variant are used by subscriptions or templates', 409);
  }

  await prisma.productVariant.delete({ where: { id } });
  res.json({ message: 'Variant deleted' });
}

export async function createOption(req, res) {
  const variantId = parseId(req.params.id);
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new AppError('Variant not found', 404);

  const option = await prisma.variantOption.create({ data: { ...req.body, variantId } });
  res.status(201).json({ option });
}

export async function updateOption(req, res) {
  const variantId = parseId(req.params.id);
  const optionId = parseId(req.params.optionId);

  const existing = await prisma.variantOption.findFirst({ where: { id: optionId, variantId } });
  if (!existing) throw new AppError('Option not found', 404);

  // Existing subscription lines keep the price they were saved with
  const option = await prisma.variantOption.update({ where: { id: optionId }, data: req.body });
  res.json({ option });
}

export async function deleteOption(req, res) {
  const variantId = parseId(req.params.id);
  const optionId = parseId(req.params.optionId);

  const existing = await prisma.variantOption.findFirst({ where: { id: optionId, variantId } });
  if (!existing) throw new AppError('Option not found', 404);

  if (await optionsInUse({ variantOptionId: optionId })) {
    throw new AppError('This option is used by subscriptions or templates', 409);
  }

  await prisma.variantOption.delete({ where: { id: optionId } });
  res.json({ message: 'Option deleted' });
}