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
