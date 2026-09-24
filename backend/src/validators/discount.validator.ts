import { z } from 'zod';

const flexibleMoney = z.preprocess((value) => {
  if (value === '' || value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;

  const raw = value.trim().replace(/\s+/g, '');
  if (!raw) return null;

  if (raw.includes(',') && raw.includes('.')) {
    return raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  }

  return raw.includes(',') ? raw.replace(',', '.') : raw;
}, z.coerce.number().nonnegative().nullable());

export const listDiscountsSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const createDiscountSchema = z.object({
  body: z.object({ tenderId: z.string().uuid() }),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const updateDiscountSchema = z.object({
  body: z.object({
    discountedValue: flexibleMoney
  }),
  params: z.object({ id: z.string().uuid(), discountId: z.string().uuid() }),
  query: z.object({})
});

export const deleteDiscountSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().uuid(), discountId: z.string().uuid() }),
  query: z.object({})
});
