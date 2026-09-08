import { UserRole } from '@prisma/client';
import { z } from 'zod';

const companyFields = z.object({
  role: z.nativeEnum(UserRole),
  companyId: z.string().uuid().nullable().optional(),
  companyIds: z.array(z.string().uuid()).max(100).optional().default([])
});

const validateCompanyRules = (value: z.infer<typeof companyFields>, ctx: z.RefinementCtx) => {
  if (value.role === UserRole.EMPRESA && !value.companyId) {
    ctx.addIssue({ code: 'custom', path: ['companyId'], message: 'Usuário EMPRESA deve possuir uma empresa' });
  }
  if (value.role !== UserRole.EMPRESA && value.companyId) {
    ctx.addIssue({ code: 'custom', path: ['companyId'], message: 'Somente usuário EMPRESA pode ser vinculado' });
  }
  if (value.role !== UserRole.FUNCIONARIO && value.companyIds.length > 0) {
    ctx.addIssue({ code: 'custom', path: ['companyIds'], message: 'Somente funcionário recebe várias empresas' });
  }
};

export const createUserSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(120),
      email: z.string().email().transform((value) => value.trim().toLowerCase()),
      password: z.string().min(12, 'A senha deve possuir pelo menos 12 caracteres').max(128),
      role: z.nativeEnum(UserRole),
      companyId: z.string().uuid().nullable().optional(),
      companyIds: z.array(z.string().uuid()).max(100).optional().default([]),
      active: z.boolean().optional()
    })
    .superRefine(validateCompanyRules),
  params: z.object({}),
  query: z.object({})
});

export const updateUserSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      email: z.string().email().transform((value) => value.trim().toLowerCase()).optional(),
      password: z.string().min(12, 'A senha deve possuir pelo menos 12 caracteres').max(128).optional(),
      role: z.nativeEnum(UserRole).optional(),
      companyId: z.string().uuid().nullable().optional(),
      companyIds: z.array(z.string().uuid()).max(100).optional(),
      active: z.boolean().optional()
    })
    .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo'),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({})
});

export const resetUserPasswordSchema = z.object({
  body: z
    .object({
      newPassword: z.string().min(12, 'A nova senha deve possuir pelo menos 12 caracteres').max(128),
      confirmPassword: z.string().min(1)
    })
    .superRefine((value, ctx) => {
      if (value.newPassword !== value.confirmPassword) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'A confirmação da senha não confere' });
      }
    }),
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
