import { z } from 'zod';
import { dateOnly, positiveInt, optionalNotes, atLeastOne, atLeastOneMsg } from './common.js';

const lineSchema = z.object({
  productId: positiveInt,
  variantOptionId: positiveInt.nullable().optional(),
  taxId: positiveInt.nullable().optional(),
  quantity: positiveInt,
});

const subscriptionBase = z.object({
  customerId: positiveInt,
  planId: positiveInt,
  startDate: dateOnly,
  expiryDate: dateOnly,
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  notes: optionalNotes,
  lines: z.array(lineSchema).min(1, 'Add at least one line'),
});

export const createSubscriptionSchema = subscriptionBase;
export const updateSubscriptionSchema = subscriptionBase.partial().refine(atLeastOne, atLeastOneMsg);

export const fromTemplateSchema = z.object({
  customerId: positiveInt,
  planId: positiveInt.optional(), // only needed if the template mixes several plans
  startDate: dateOnly,
  expiryDate: dateOnly,
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  notes: optionalNotes,
});

export const renewSchema = z.object({ expiryDate: dateOnly });

export const closeSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});