import { describe, expect, it } from 'vitest';
import { reportSchema } from '../src/validators/report.validator.js';

const parse = (dateFrom: string, dateTo: string) =>
  reportSchema.parse({
    body: {},
    params: {},
    query: { dateFrom, dateTo }
  });

describe('validação do relatório operacional', () => {
  it('aceita um período válido e transforma as datas', () => {
    const parsed = parse('2026-09-01', '2026-09-30');

    expect(parsed.query.dateFrom).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    expect(parsed.query.dateTo).toEqual(new Date('2026-09-30T00:00:00.000Z'));
  });

  it('recusa data inicial maior que a data final', () => {
    expect(() => parse('2026-09-30', '2026-09-01')).toThrow('A data inicial não pode ser maior que a data final');
  });

  it('limita o relatório a no máximo 366 dias por consulta', () => {
    expect(() => parse('2025-01-01', '2026-01-02')).toThrow('Selecione um período de no máximo 366 dias');
  });
});
