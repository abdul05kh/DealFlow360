import { z } from 'zod';

export const UserRoleEnum = z.enum([
  'SALES_REP',
  'SALES_MANAGER',
  'OPERATIONS_MANAGER',
  'ADMIN',
  'CUSTOMER',
]);

export const PublicSignupRoleEnum = z.enum(['SALES_REP', 'CUSTOMER']);

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long').max(100),
  email: z.string().email('Invalid email address').transform((val) => val.trim().toLowerCase()),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  role: z.enum(['SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER', 'ADMIN', 'CUSTOMER']).optional().default('SALES_REP'),
  customerId: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').transform((val) => val.trim().toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
