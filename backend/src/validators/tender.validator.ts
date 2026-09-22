import { TenderListStatus } from '@prisma/client';
import { z } from 'zod';


const optionalHttpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === '' || /^https?:\/\//i.test(value), 'Informe um link começando com http:// ou https://')
  .optional();


const flexibleMoney = z.preprocess((raw) => {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return raw;

  let value = raw.trim().replace(/\s/g, '').replace(/^R\$/i, '');
  if (!value) return raw;
  if (!/^[0-9.,]+$/.test(value)) return raw;

  const lastDot = value.lastIndexOf('.');
  const lastComma = value.lastIndexOf(',');
  const separatorIndex = Math.max(lastDot, lastComma);

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';
    value = value.split(thousandsSeparator).join('');
    value = value.replace(decimalSeparator, '.');
  } else if (separatorIndex >= 0) {
    const separator = value[separatorIndex]!;
    const parts = value.split(separator);
    const fraction = parts.at(-1) ?? '';
    const hasMultipleSeparators = parts.length > 2;
    const looksLikeThousands = fraction.length === 3 && (hasMultipleSeparators || parts[0]!.length <= 3);

    if (looksLikeThousands) value = parts.join('');
    else if (hasMultipleSeparators) value = `${parts.slice(0, -1).join('')}.${fraction}`;
    else value = value.replace(separator, '.');
  }

  return Number(value);
}, z.number().positive());

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const tenderBody = z.object({
  modality: z.string().trim().max(80).optional(),
  noticeNumber: z.string().trim().max(120).optional(),
  processNumber: z.string().trim().max(120).optional(),
  executionTerm: z.string().trim().max(120).optional(),
  isPreQualification: z.boolean().optional(), // LICITAGESTAO_PREQUAL_ALL_EMAILS_V1_VALIDATOR
  municipality: z.string().trim().min(1, 'Informe a cidade').max(120),
  sessionDate: date,
  object: z.string().trim().min(1, 'Informe o objeto').max(10000),
  proposalValidityDays: z.coerce.number().int().min(1).max(3650),
  estimatedValue: flexibleMoney,
  requiresGuaranteeOnePercent: z.boolean(),
  platformId: z.string().trim().uuid('Selecione uma plataforma válida'),
  platformLink: optionalHttpUrl,
  seobraLink: optionalHttpUrl,
  seobraLinks: z.array(optionalHttpUrl.unwrap()).max(20).optional()
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
    companyId: z.string().uuid().optional(),
    workflowStatus: z.enum(['PENDENTE', 'ANEXADA', 'INICIADA', 'SUSPENSA', 'CONVOCADA', 'RECURSO']).optional(), // LICITAGESTAO_WORKFLOW_CITY_LAYOUT_V3_VALIDATOR
    dateFrom: date.optional(),
    dateTo: date.optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['sessionDate', 'createdAt', 'municipality']).default('sessionDate'),
    direction: z.enum(['asc', 'desc']).default('asc')
  })
});

export const tenderFilterOptionsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    workflowStatus: z.enum(['PENDENTE', 'ANEXADA', 'INICIADA', 'SUSPENSA', 'CONVOCADA', 'RECURSO']).optional(),
    companyId: z.string().uuid().optional(),
    dateFrom: date.optional(),
    dateTo: date.optional()
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


export const spreadsheetResponsibilitySchema = z.object({
  body: z.object({ responsible: z.boolean() }),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const spreadsheetNotesSchema = z.object({
  body: z.object({ notes: z.string().trim().max(10000).nullable() }),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});
