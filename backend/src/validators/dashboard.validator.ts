import { z } from 'zod';

export const dashboardSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({ companyId: z.string().uuid().optional() })
});
