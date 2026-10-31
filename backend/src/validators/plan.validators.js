import { z } from 'zod';
import { dateOnly, positiveInt, optionalNotes, atLeastOne, atLeastOneMsg } from './common.js';

const planBase = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  billingFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  minQuantity: positiveInt.optional(),
  availableFrom: dateOnly,
  availableTo: dateOnly.nullable().optional(),
  autoRenew: z.boolean().optional(),
  allowEarlyClosure: z.boolean().optional(),
  allowPause: z.boolean().optional(),
  maxPauseDays: positiveInt.max(365).nullable().optional(),
  autoCloseOnExpiry: z.boolean().optional(),
  isActive: z.boolean().optional(),
  productIds: z.array(positiveInt).min(1, 'Select at least one product'),
});

export const createPlanSchema = planBase;
export const updatePlanSchema = planBase.partial().refine(atLeastOne, atLeastOneMsg);

// ---------- Quotation templates ----------
const templateLineSchema = z.object({
  productId: positiveInt,
  planId: positiveInt,
  variantOptionId: positiveInt.nullable().optional(),
  taxId: positiveInt.nullable().optional(),
  quantity: positiveInt,
  unitPrice: z.number().int().min(0).optional(), // leave out to use base price + variant extra
});

const templateBase = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  validityDays: positiveInt.max(365).optional(),
  notes: optionalNotes,
  isActive: z.boolean().optional(),
  lines: z.array(templateLineSchema).min(1, 'Add at least one line'),
});

export const createTemplateSchema = templateBase;
export const updateTemplateSchema = templateBase.partial().refine(atLeastOne, atLeastOneMsg);