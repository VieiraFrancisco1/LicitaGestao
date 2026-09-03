import { z } from 'zod';

export const outlookCompanyIdSchema = z.object({
  params: z.object({ companyId: z.string().uuid() })
});
