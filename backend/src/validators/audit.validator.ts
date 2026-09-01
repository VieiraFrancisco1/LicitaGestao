import { z } from 'zod';

export const listAuditSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(30),
    action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'UPLOAD']).optional(),
    entityType: z.string().trim().max(80).optional(),
    search: z.string().trim().max(120).optional()
  })
});
