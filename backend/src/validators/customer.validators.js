import { z } from 'zod';

const emptyToNull = (value) => (value === '' ? null : value);

const optionalText = (max) =>
  z.string().trim().max(max, `Must be at most ${max} characters`).optional().transform(emptyToNull);

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .or(z.literal(''))
  .optional()
  .transform(emptyToNull);

const optionalPhone = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{7,20}$/, 'Enter a valid phone number')
  .or(z.literal(''))
  .optional()
  .transform(emptyToNull);

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: optionalEmail,
  phone: optionalPhone,
  company: optionalText(100),
  address: optionalText(300),
});

export const updateCustomerSchema = createCustomerSchema.partial();