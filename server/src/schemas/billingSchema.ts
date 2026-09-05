import { z } from 'zod';

export const GenerateBillingSchema = z
  .object({})
  .strict('Unexpected payload fields detected. Server authority rejects client-supplied billing or commercial overrides.');

export const CancelSubscriptionSchema = z
  .object({})
  .strict('Unexpected payload fields detected. Server authority rejects client-supplied billing or commercial overrides.');

export const IssueCreditNoteSchema = z
  .object({
    amountMinor: z.number().int('Amount must be an integer').positive('Credit note amount must be positive'),
    reason: z.string().min(1, 'Reason is required').max(500, 'Reason cannot exceed 500 characters'),
  })
  .strict('Unexpected payload fields detected. Server authority rejects client-supplied billing or commercial overrides.');

export type GenerateBillingInputDTO = z.infer<typeof GenerateBillingSchema>;
export type CancelSubscriptionInputDTO = z.infer<typeof CancelSubscriptionSchema>;
export type IssueCreditNoteInputDTO = z.infer<typeof IssueCreditNoteSchema>;
