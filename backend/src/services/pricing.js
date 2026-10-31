import prisma from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';

// unitPrice = product base price + the selected variant option's extra price (all in paise)
export async function getUnitPrice(productId, optionId = null) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('Product not found', 404);

  if (!optionId) {
    return { product, option: null, basePrice: product.salesPrice, extraPrice: 0, unitPrice: product.salesPrice };
  }

  // The option must really belong to this product (prevents mixing prices between products)
  const option = await prisma.variantOption.findFirst({
    where: { id: optionId, variant: { productId } },
  });
  if (!option) throw new AppError('This variant option does not belong to the product', 400);

  return {
    product,
    option,
    basePrice: product.salesPrice,
    extraPrice: option.extraPrice,
    unitPrice: product.salesPrice + option.extraPrice,
  };
}