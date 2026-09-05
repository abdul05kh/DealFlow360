import { z } from 'zod';

export const EvaluateFulfillmentSchema = z
  .object({
    quoteId: z.string().min(1, 'Quote ID is required'),
  })
  .strict('Unexpected payload fields detected. Server authority rejects client-supplied commercial or fulfillment overrides.');

export const ManualOverrideItemSchema = z
  .object({
    quoteLineId: z.string().min(1, 'Quote Line ID is required'),
    warehouseId: z.string().min(1, 'Warehouse ID is required'),
  })
  .strict('Unexpected payload fields detected. Server authority rejects client-supplied commercial or fulfillment overrides.');

export const AllocateFulfillmentSchema = z
  .object({
    quoteId: z.string().min(1, 'Quote ID is required'),
    manualOverrides: z.array(ManualOverrideItemSchema).optional(),
  })
  .strict('Unexpected payload fields detected. Server authority rejects client-supplied commercial or fulfillment overrides.');

export type EvaluateFulfillmentInputDTO = z.infer<typeof EvaluateFulfillmentSchema>;
export type ManualOverrideItemDTO = z.infer<typeof ManualOverrideItemSchema>;
export type AllocateFulfillmentInputDTO = z.infer<typeof AllocateFulfillmentSchema>;
