import { z } from 'zod';

export const GenerateBillingSchema = z
  .object({})
  .strict('Unexpected payload fields detected. Server authority rejects client-supplied billing or commercial overrides.');

export type GenerateBillingInputDTO = z.infer<typeof GenerateBillingSchema>;
