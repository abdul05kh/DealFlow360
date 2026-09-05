import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().min(2, 'SKU must be at least 2 characters long').max(50),
  name: z.string().min(2, 'Product name must be at least 2 characters long').max(100),
  categoryId: z.string().min(1, 'Category ID is required'),
  sellingPrice: z.number().gt(0, 'Selling price must be greater than 0'),
  costPrice: z.number().gte(0, 'Cost price must be greater than or equal to 0'),
  isActive: z.boolean().optional().default(true),
}).strict();

export const updateProductSchema = z.object({
  sku: z.string().min(2).max(50).optional(),
  name: z.string().min(2).max(100).optional(),
  categoryId: z.string().min(1).optional(),
  sellingPrice: z.number().gt(0).optional(),
  costPrice: z.number().gte(0).optional(),
  isActive: z.boolean().optional(),
}).strict();

export const createCustomerTierSchema = z.object({
  code: z.string().min(2, 'Tier code must be at least 2 characters long').max(30),
  name: z.string().min(2, 'Tier name must be at least 2 characters long').max(100),
  maxOverallDiscount: z.number().min(0, 'Discount must be >= 0').max(100, 'Discount must be <= 100'),
  minMarginThreshold: z.number().min(0, 'Margin must be >= 0').max(100, 'Margin must be <= 100'),
}).strict();

export const updateCustomerTierSchema = z.object({
  code: z.string().min(2).max(30).optional(),
  name: z.string().min(2).max(100).optional(),
  maxOverallDiscount: z.number().min(0).max(100).optional(),
  minMarginThreshold: z.number().min(0).max(100).optional(),
}).strict();

export const createCustomerSchema = z.object({
  name: z.string().min(2, 'Customer name must be at least 2 characters long').max(100),
  tierId: z.string().min(1, 'Tier ID is required'),
  currency: z.string().optional().default('INR'),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE'),
}).strict();

export const updateCustomerSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  tierId: z.string().min(1).optional(),
  currency: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}).strict();

export const createProductCategorySchema = z.object({
  code: z.string().min(2, 'Category code must be at least 2 characters long').max(30),
  name: z.string().min(2, 'Category name must be at least 2 characters long').max(100),
  maxCategoryDiscount: z.number().min(0).max(100),
}).strict();

export const updateProductCategorySchema = z.object({
  code: z.string().min(2).max(30).optional(),
  name: z.string().min(2).max(100).optional(),
  maxCategoryDiscount: z.number().min(0).max(100).optional(),
}).strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateCustomerTierInput = z.infer<typeof createCustomerTierSchema>;
export type UpdateCustomerTierInput = z.infer<typeof updateCustomerTierSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateProductCategoryInput = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategoryInput = z.infer<typeof updateProductCategorySchema>;
