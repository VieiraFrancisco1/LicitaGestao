import { z } from 'zod';

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
    discountedValue: z.preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.coerce.number().nonnegative().nullable()
    )
  }),
  params: z.object({ id: z.string().uuid(), discountId: z.string().uuid() }),
  query: z.object({})
});

export const deleteDiscountSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().uuid(), discountId: z.string().uuid() }),
  query: z.object({})
});
