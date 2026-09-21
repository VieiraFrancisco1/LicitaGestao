import { z } from 'zod';

const dateTime = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const companyParams = z.object({ companyId: z.string().uuid() });

export const workspaceCompanySchema = z.object({
  body: z.object({}),
  params: companyParams,
  query: z.object({})
});

export const agendaCreateSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(180),
    notes: z.string().trim().max(10000).nullable().optional(),
    eventDate: dateTime,
    tenderId: z.string().uuid().nullable().optional()
  }),
  params: companyParams,
  query: z.object({})
});

export const agendaUpdateSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1).max(180).optional(),
      notes: z.string().trim().max(10000).nullable().optional(),
      eventDate: dateTime.optional(),
      tenderId: z.string().uuid().nullable().optional()
    })
    .refine((value) => Object.keys(value).length > 0),
  params: companyParams.extend({ itemId: z.string().uuid() }),
  query: z.object({})
});

export const agendaDeleteSchema = z.object({
  body: z.object({}),
  params: companyParams.extend({ itemId: z.string().uuid() }),
  query: z.object({})
});

export const priorityCreateSchema = z.object({
  body: z.object({ tenderId: z.string().uuid() }),
  params: companyParams,
  query: z.object({})
});

export const priorityDeleteSchema = z.object({
  body: z.object({}),
  params: companyParams.extend({ tenderId: z.string().uuid() }),
  query: z.object({})
});

export const chatCreateSchema = z.object({
  body: z.object({
    content: z.string().trim().min(1).max(3000),
    mentionUserIds: z.array(z.string().uuid()).max(30).optional()
  }),
  params: companyParams,
  query: z.object({})
});


export const organizationChatSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({})
});

export const organizationChatCreateSchema = z.object({
  body: z.object({
    content: z.string().trim().min(1).max(3000),
    mentionUserIds: z.array(z.string().uuid()).max(100).optional()
  }),
  params: z.object({}),
  query: z.object({})
});
