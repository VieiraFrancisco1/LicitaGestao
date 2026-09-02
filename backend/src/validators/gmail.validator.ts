import { z } from 'zod';

const uuid = z.string().uuid();

export const gmailCompanyIdSchema = z.object({ params: z.object({ companyId: uuid }) });

export const gmailMessagesSchema = z.object({
  params: z.object({ companyId: uuid }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    convocationsOnly: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true')
  })
});

export const gmailReadAlertSchema = z.object({
  body: z.object({ messageId: uuid })
});
