import { z } from 'zod';
import { registerSchema } from './auth.validators.js';

// Staff accounts need the same name / email / password rules as registration
export const createStaffSchema = registerSchema;

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });