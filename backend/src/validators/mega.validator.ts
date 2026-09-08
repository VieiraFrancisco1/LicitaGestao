import { z } from 'zod';

const companyId = z.string().uuid().optional();
const relativePath = z.string().max(1000).default('');

export const megaAccountConnectSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('Informe o e-mail da sua conta MEGA')
      .transform((value) => value.trim().toLowerCase()),
    password: z.string().min(1, 'Informe a senha da sua conta MEGA').max(256),
    rootFolder: z.string().trim().max(1000).optional().default('')
  }),
  params: z.object({}),
  query: z.object({})
});

export const megaBrowseSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    companyId,
    path: relativePath,
    refresh: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true')
  })
});

export const megaUploadSchema = z.object({
  body: z.object({
    companyId,
    path: relativePath
  }),
  params: z.object({}),
  query: z.object({})
});

export const megaFolderSchema = z.object({
  body: z.object({
    companyId,
    path: relativePath,
    name: z.string().trim().min(1).max(240)
  }),
  params: z.object({}),
  query: z.object({})
});

export const megaNodeSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().min(1).max(160) }),
  query: z.object({ companyId })
});

export const megaRenameSchema = z.object({
  body: z.object({ companyId, name: z.string().trim().min(1).max(240) }),
  params: z.object({ id: z.string().min(1).max(160) }),
  query: z.object({})
});

export const megaDeleteSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().min(1).max(160) }),
  query: z.object({ companyId })
});

export const megaCompanyLinkSchema = z.object({
  body: z.object({ path: z.string().max(1000) }),
  params: z.object({ companyId: z.string().uuid() }),
  query: z.object({})
});
