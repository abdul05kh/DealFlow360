import { z } from 'zod';

export const EvaluateQuoteItemSchema = z
  .object({
    productId: z.string().min(1, 'Product ID is required'),
    quantity: z
      .number()
      .int('Quantity must be an integer')
      .positive('Quantity must be a positive integer'),
    discountPercent: z
      .number()
      .min(0, 'Discount percentage cannot be negative')
      .max(100, 'Discount percentage cannot exceed 100%'),
  })
  .strict('Unexpected payload fields detected. Server authority rejects client-supplied commercial or governance overrides.');

export const EvaluateQuoteSchema = z
  .object({
    customerId: z.string().min(1, 'Customer ID is required'),
    items: z
      .array(EvaluateQuoteItemSchema)
      .min(1, 'Quote must contain at least one line item'),
  })
  .strict('Unexpected payload fields detected. Server authority rejects client-supplied commercial or governance overrides.');

export const CreateQuoteSchema = z
  .object({
    customerId: z.string().min(1, 'Customer ID is required'),
    items: z
      .array(EvaluateQuoteItemSchema)
      .min(1, 'Quote must contain at least one line item'),
  })
  .strict('Unexpected payload fields detected. Server authority rejects client-supplied commercial or governance overrides.');

export const ApproveRejectQuoteSchema = z
  .object({
    reason: z.string().max(500, 'Reason cannot exceed 500 characters').optional(),
  })
  .strict('Unexpected payload fields detected. Server authority rejects client-supplied commercial or governance overrides.');

export type EvaluateQuoteInputDTO = z.infer<typeof EvaluateQuoteSchema>;
export type CreateQuoteInputDTO = z.infer<typeof CreateQuoteSchema>;
export type ApproveRejectQuoteInputDTO = z.infer<typeof ApproveRejectQuoteSchema>;
