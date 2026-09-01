import { DocumentCategory } from '@prisma/client';
import { z } from 'zod';

export const documentBidIdSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({ bidId: z.string().uuid() }),
  query: z.object({})
});

export const uploadDocumentSchema = z.object({
  body: z.object({ category: z.nativeEnum(DocumentCategory).default(DocumentCategory.OUTRO) }),
  params: z.object({ bidId: z.string().uuid() }),
  query: z.object({})
});

export const documentIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});
