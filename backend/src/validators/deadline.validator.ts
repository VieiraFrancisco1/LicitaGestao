import { z } from 'zod';

export const listDeadlineSchema = z.object({
  query: z.object({
    horizon: z.coerce.number().int().min(1).max(90).default(30),
    pastDays: z.coerce.number().int().min(0).max(90).default(30)
  })
});

export const readDeadlineSchema = z.object({
  body: z.object({ alertKey: z.string().min(1).max(220) })
});

export const deadlineTenderSchema = z.object({
  params: z.object({ tenderId: z.string().uuid() })
});
