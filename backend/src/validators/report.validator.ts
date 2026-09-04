import { z } from 'zod';

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const reportSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z
    .object({
      companyId: z.string().uuid().optional(),
      dateFrom: date,
      dateTo: date
    })
    .superRefine((value, context) => {
      if (value.dateFrom.getTime() > value.dateTo.getTime()) {
        context.addIssue({
          code: 'custom',
          message: 'A data inicial não pode ser maior que a data final',
          path: ['dateTo']
        });
        return;
      }

      const days = Math.round((value.dateTo.getTime() - value.dateFrom.getTime()) / DAY_MS) + 1;
      if (days > MAX_RANGE_DAYS) {
        context.addIssue({
          code: 'custom',
          message: 'Selecione um período de no máximo 366 dias',
          path: ['dateTo']
        });
      }
    })
});
