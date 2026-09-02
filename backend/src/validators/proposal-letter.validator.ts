import { z } from 'zod';

export const proposalTemplateQuerySchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    municipality: z.string().trim().min(2).max(120),
    state: z.string().trim().length(2).optional()
  })
});

export const saveProposalTemplateSchema = z.object({
  body: z.object({
    municipality: z.string().trim().min(2).max(120),
    state: z.string().trim().length(2).optional().nullable(),
    bodyTemplate: z.string().trim().min(20).max(20000)
  }),
  params: z.object({}),
  query: z.object({})
});


export const importProposalPdfSchema = z.object({
  body: z.object({
    bidId: z.string().uuid()
  }),
  params: z.object({}),
  query: z.object({})
});
