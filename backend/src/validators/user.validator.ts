import { UserRole } from '@prisma/client';
import { z } from 'zod';

export const createUserSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(120),
      email: z
        .string()
        .email()
        .transform((value) => value.trim().toLowerCase()),
      password: z.string().min(8).max(128),
      role: z.nativeEnum(UserRole),
      companyId: z.string().uuid().nullable().optional(),
      companyIds: z.array(z.string().uuid()).max(100).optional().default([]),
      active: z.boolean().optional()
    })
    .superRefine((value, ctx) => {
      if (value.role === UserRole.EMPRESA && !value.companyId) {
        ctx.addIssue({
          code: 'custom',
          path: ['companyId'],
          message: 'Usuário EMPRESA deve possuir uma empresa'
        });
      }
      if (value.role !== UserRole.EMPRESA && value.companyId) {
        ctx.addIssue({
          code: 'custom',
          path: ['companyId'],
          message: 'Somente usuário EMPRESA pode ser vinculado'
        });
      }
      if (value.role !== UserRole.FUNCIONARIO && value.companyIds.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['companyIds'],
          message: 'Somente funcionário recebe várias empresas'
        });
      }
    }),
  params: z.object({}),
  query: z.object({})
});

export const updateUserSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      email: z
        .string()
        .email()
        .transform((value) => value.trim().toLowerCase())
        .optional(),
      password: z.string().min(8).max(128).optional(),
      role: z.nativeEnum(UserRole).optional(),
      companyId: z.string().uuid().nullable().optional(),
      companyIds: z.array(z.string().uuid()).max(100).optional(),
      active: z.boolean().optional()
    })
    .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo'),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const userIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const listUsersSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    search: z.string().trim().max(120).optional(),
    role: z.nativeEnum(UserRole).optional(),
    active: z.enum(['true', 'false']).optional(),
    companyId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20)
  })
});
