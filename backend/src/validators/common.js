import { z } from 'zod';

// Accepts "YYYY-MM-DD" and turns it into a Date at UTC midnight
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid date')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

// Money in whole paise
export const paise = z
  .number()
  .int('Must be a whole number of paise')
  .min(0, 'Cannot be negative');

export const positiveInt = z.number().int('Must be a whole number').positive('Must be greater than 0');

export const optionalNotes = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((value) => (value === '' ? null : value));

export const atLeastOne = (data) => Object.keys(data).length > 0;
export const atLeastOneMsg = { message: 'Provide at least one field to update' };