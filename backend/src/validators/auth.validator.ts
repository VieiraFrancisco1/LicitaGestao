import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email()
      .transform((value) => value.trim().toLowerCase()),
    password: z.string().min(8).max(128)
  }),
  params: z.object({}),
  query: z.object({})
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(8).max(128),
      newPassword: z.string().min(12, 'A nova senha deve possuir pelo menos 12 caracteres').max(128),
      confirmPassword: z.string().min(1)
    })
    .superRefine((value, ctx) => {
      if (value.newPassword !== value.confirmPassword) {
        ctx.addIssue({
          code: 'custom',
          path: ['confirmPassword'],
          message: 'A confirmação da senha não confere'
        });
      }
    }),
  params: z.object({}),
  query: z.object({})
});
