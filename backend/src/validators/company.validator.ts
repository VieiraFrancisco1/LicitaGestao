import { z } from 'zod';
import { isValidCnpj, onlyDigits } from '../utils/cnpj.js';

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const cnpj = z.string().transform(onlyDigits).refine(isValidCnpj, 'CNPJ inválido');

export const companyBody = z.object({
  legalName: z.string().trim().min(2).max(180),
  tradeName: optionalText(180),
  cnpj,
  email: z
    .union([z.string().trim().email(), z.literal('')])
    .optional()
    .nullable(),
  phone: optionalText(30),
  contactName: optionalText(120),
  observations: optionalText(2000),
  active: z.boolean().optional()
});

export const createCompanySchema = z.object({ body: companyBody, params: z.object({}), query: z.object({}) });

export const updateCompanySchema = z.object({
  body: companyBody.partial().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo'),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const companyIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const listCompaniesSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    search: z.string().trim().max(120).optional(),
    active: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20)
  })
});
