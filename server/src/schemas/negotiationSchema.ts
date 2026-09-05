import { z } from 'zod';

export const negotiationLineInputSchema = z
  .object({
    quoteLineId: z.string().min(1, 'Quote line ID is required'),
    requestedDiscount: z
      .number()
      .min(0, 'Discount cannot be negative')
      .max(100, 'Discount cannot exceed 100%'),
    customerNote: z.string().max(500).optional(),
  })
  .strict();

export const submitNegotiationSchema = z
  .object({
    customerNote: z.string().max(1000).optional(),
    lines: z
      .array(negotiationLineInputSchema)
      .min(1, 'Negotiation must contain at least one line item counter-offer'),
  })
  .strict();

export const respondNegotiationSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT']),
    managerReason: z.string().max(1000).optional(),
    customerResponseNote: z.string().max(1000).optional(),
  })
  .strict();

export type SubmitNegotiationInputDTO = z.infer<typeof submitNegotiationSchema>;
export type RespondNegotiationInputDTO = z.infer<typeof respondNegotiationSchema>;
