import { z } from 'zod';

export const globalSearchSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({ q: z.string().trim().min(2).max(120) })
});
