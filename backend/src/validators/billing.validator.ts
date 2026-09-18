import { SubscriptionPlan } from '@prisma/client';
import { z } from 'zod';

const billingToken = z.string().min(20).max(4000);

export const billingStatusSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({ token: billingToken })
});

export const billingCheckoutSchema = z.object({
  body: z.object({
    token: billingToken,
    plan: z.nativeEnum(SubscriptionPlan)
  }),
  params: z.object({}),
  query: z.object({})
});

export const billingReconcileSchema = z.object({
  body: z.object({
    token: billingToken,
    orderId: z.string().trim().min(6).max(180)
  }),
  params: z.object({}),
  query: z.object({})
});
