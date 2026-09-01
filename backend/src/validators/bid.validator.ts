import { BidProgress, BidSituation } from '@prisma/client';
import { z } from 'zod';

const nullableNumber = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.coerce.number().nonnegative().nullable()
);

export const bidBody = z.object({
  tenderId: z.string().uuid(),
  companyId: z.string().uuid(),
  proposalValue: nullableNumber.optional(),
  progress: z.nativeEnum(BidProgress).default(BidProgress.NAO_INICIADA),
  situation: z.nativeEnum(BidSituation).default(BidSituation.PENDENTE),
  observations: z.string().trim().max(5000).optional().nullable()
});

export const createBidSchema = z.object({ body: bidBody, params: z.object({}), query: z.object({}) });

export const associateTenderSchema = z.object({
  body: bidBody.omit({ tenderId: true }),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const updateBidSchema = z.object({
  body: bidBody
    .pick({ proposalValue: true, progress: true, situation: true, observations: true })
    .partial()
    .refine((value) => Object.keys(value).length > 0),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const bidIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const listBidsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    search: z.string().trim().max(180).optional(),
    companyId: z.string().uuid().optional(),
    progress: z.nativeEnum(BidProgress).optional(),
    situation: z.nativeEnum(BidSituation).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['sessionDate', 'createdAt', 'municipality']).default('sessionDate'),
    direction: z.enum(['asc', 'desc']).default('asc')
  })
});
