import { GmailAccessRequestStatus } from '@prisma/client';
import { z } from 'zod';

export const organizationStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ active: z.boolean() }),
  query: z.object({})
});

export const gmailAccessRequestsQuerySchema = z.object({
  params: z.object({}),
  body: z.object({}),
  query: z.object({ status: z.nativeEnum(GmailAccessRequestStatus).optional() })
});

export const reviewGmailAccessRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    note: z.string().trim().max(500).nullable().optional()
  }),
  query: z.object({})
});

export const supportSettingsSchema = z.object({
  params: z.object({}),
  body: z.object({
    supportName: z.string().trim().min(2).max(120),
    supportWhatsapp: z.string().trim().max(30).optional()
  }),
  query: z.object({})
});


export const organizationDeleteSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    confirmation: z.string().trim().email().max(180)
  }),
  query: z.object({})
}); // LICITAGESTAO_SUPERADMIN_DELETE_V22
