import { describe, expect, it } from 'vitest';
import { createTenderSchema, tenderFilterOptionsSchema } from '../src/validators/tender.validator.js';

const baseBody = {
  municipality: 'Boa Viagem',
  sessionDate: '2026-09-25',
  object: 'Contratação de empresa para execução de serviços de engenharia',
  proposalValidityDays: '60',
  estimatedValue: '3437508,84',
  requiresGuaranteeOnePercent: false,
  platformId: '11111111-1111-4111-8111-111111111111',
  platformLink: '',
  seobraLinks: ['https://seobra.example/lote-1', 'https://seobra.example/lote-2']
};

describe('validação de licitações V26', () => {
  it.each([
    ['3437508,84', 3437508.84],
    ['3437508.84', 3437508.84],
    ['3.437.508,84', 3437508.84],
    ['3,437,508.84', 3437508.84]
  ])('aceita valor global no formato %s', (estimatedValue, expected) => {
    const result = createTenderSchema.parse({ body: { ...baseBody, estimatedValue }, params: {}, query: {} });
    expect(result.body.estimatedValue).toBe(expected);
  });

  it('aceita Recursos e companyId nas opções de filtro', () => {
    const result = tenderFilterOptionsSchema.parse({
      body: {},
      params: {},
      query: {
        workflowStatus: 'RECURSO',
        companyId: '22222222-2222-4222-8222-222222222222',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30'
      }
    });

    expect(result.query.workflowStatus).toBe('RECURSO');
    expect(result.query.companyId).toBe('22222222-2222-4222-8222-222222222222');
  });
});
