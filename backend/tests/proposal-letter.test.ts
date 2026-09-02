import { describe, expect, it } from 'vitest';
import { buildProposalPdf, DEFAULT_PROPOSAL_TEMPLATE } from '../src/services/proposal-letter.service.js';

describe('Carta Proposta', () => {
  it('mantém os campos essenciais no modelo padrão', () => {
    expect(DEFAULT_PROPOSAL_TEMPLATE).toContain('{{numero_licitacao}}');
    expect(DEFAULT_PROPOSAL_TEMPLATE).toContain('{{valor_global}}');
    expect(DEFAULT_PROPOSAL_TEMPLATE).toContain('{{prazo_execucao}}');
  });

  it('gera um arquivo PDF básico válido', () => {
    const pdf = buildProposalPdf('CARTA PROPOSTA\n\nValor: R$ 100.000,00\nPrazo: 180 dias');
    expect(pdf.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
    expect(pdf.toString('latin1')).toContain('%%EOF');
  });
});
