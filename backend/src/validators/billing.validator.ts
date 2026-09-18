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

export const billingPixSchema = z.object({
  body: z.object({
    token: billingToken,
    plan: z.nativeEnum(SubscriptionPlan)
  }),
  params: z.object({}),
  query: z.object({})
});

export const billingCardSchema = z.object({
  body: z.object({
    token: billingToken,
    plan: z.nativeEnum(SubscriptionPlan),
    cardToken: z.string().trim().min(10).max(500),
    paymentMethodId: z.string().trim().min(2).max(80),
    paymentTypeId: z.enum(['credit_card', 'debit_card']),
    installments: z.coerce.number().int().min(1).max(24),
    payerEmail: z.string().trim().email().optional(),
    identification: z
      .object({
        type: z.string().trim().min(2).max(20).optional(),
        number: z.string().trim().min(5).max(30).optional()
      })
      .optional()
  }),
  params: z.object({}),
  query: z.object({})
});

// LICITAGESTAO_BILLING_TRANSPARENTE_V8_VALIDATOR
