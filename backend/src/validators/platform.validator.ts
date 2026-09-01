import { z } from 'zod';

const optionalUrl = z
  .union([z.string().trim().url(), z.literal('')])
  .optional()
  .nullable();

export const platformBody = z.object({
  name: z.string().trim().min(2).max(120),
  site: optionalUrl,
  observations: z.string().trim().max(2000).optional().nullable(),
  active: z.boolean().optional()
});

export const createPlatformSchema = z.object({
  body: platformBody,
  params: z.object({}),
  query: z.object({})
});

export const updatePlatformSchema = z.object({
  body: platformBody.partial().refine((value) => Object.keys(value).length > 0),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const platformIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const listPlatformsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    search: z.string().trim().max(120).optional(),
    active: z.enum(['true', 'false']).optional()
  })
});
