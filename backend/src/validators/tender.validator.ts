import { TenderListStatus } from '@prisma/client';
import { z } from 'zod';


const optionalHttpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === '' || /^https?:\/\//i.test(value), 'Informe um link começando com http:// ou https://')
  .optional();

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const tenderBody = z.object({
  modality: z.string().trim().max(80).optional(),
  noticeNumber: z.string().trim().max(120).optional(),
  processNumber: z.string().trim().max(120).optional(),
  municipality: z.string().trim().min(2).max(120),
  sessionDate: date,
  object: z.string().trim().min(5).max(10000),
  proposalValidityDays: z.coerce.number().int().min(1).max(3650),
  estimatedValue: z.coerce.number().positive(),
  requiresGuaranteeOnePercent: z.boolean(),
  platformId: z.string().uuid(),
  platformLink: optionalHttpUrl,
  seobraLink: optionalHttpUrl
});

export const createTenderSchema = z.object({ body: tenderBody, params: z.object({}), query: z.object({}) });

export const updateTenderSchema = z.object({
  body: tenderBody.partial().refine((value) => Object.keys(value).length > 0),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const tenderIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const listTendersSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    search: z.string().trim().max(180).optional(),
    municipality: z.string().trim().max(120).optional(),
    platformId: z.string().uuid().optional(),
    listStatus: z.nativeEnum(TenderListStatus).optional(),
    dateFrom: date.optional(),
    dateTo: date.optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['sessionDate', 'createdAt', 'municipality']).default('sessionDate'),
    direction: z.enum(['asc', 'desc']).default('asc')
  })
});

export const spreadsheetReadySchema = z.object({
  body: z.object({ ready: z.boolean() }),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const tenderListStatusSchema = z.object({
  body: z.object({ status: z.nativeEnum(TenderListStatus) }),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});
