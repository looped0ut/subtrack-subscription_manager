import { z } from 'zod';

const atLeastOne = (data) => Object.keys(data).length > 0;
const atLeastOneMsg = { message: 'Provide at least one field to update' };

const paise = z.number().int('Must be a whole number of paise').min(0, 'Cannot be negative');

// ---------- Tax ----------
const taxBase = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50),
  rateBps: z.number().int('Must be a whole number').min(0).max(10000, 'Rate cannot exceed 100%'),
  isActive: z.boolean().optional(),
});
export const createTaxSchema = taxBase;
export const updateTaxSchema = taxBase.partial().refine(atLeastOne, atLeastOneMsg);

// ---------- Variants and options ----------
const optionBase = z.object({
  value: z.string().trim().min(1, 'Option name is required').max(50),
  extraPrice: paise.default(0),
});
export const createOptionSchema = optionBase;
export const updateOptionSchema = optionBase.partial().refine(atLeastOne, atLeastOneMsg);

const variantName = z.string().trim().min(1, 'Variant name is required').max(50);
export const createVariantSchema = z.object({
  name: variantName,
  options: z.array(optionBase).min(1, 'Add at least one option'),
});
export const updateVariantSchema = z.object({ name: variantName });

// ---------- Product ----------
const productBase = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(150),
  type: z.enum(['SOFTWARE', 'ADDON', 'SERVICE', 'OTHER']).default('SOFTWARE'),
  salesPrice: paise,
  costPrice: paise,
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v === '' ? null : v)),
  isActive: z.boolean().optional(),
});

export const createProductSchema = productBase.extend({
  variants: z.array(createVariantSchema).optional(),
});
export const updateProductSchema = productBase
  .partial()
  .refine(atLeastOne, atLeastOneMsg);