import { describe, expect, it } from 'vitest';
import { buildProposalPdf, DEFAULT_PROPOSAL_TEMPLATE } from '../src/services/proposal-letter.service.js';
import { brlInWords, convertExtractedLetterToTemplate } from '../src/utils/proposal-pdf.js';

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

  it('converte texto extraído de uma carta antiga em modelo reutilizável', () => {
    const converted = convertExtractedLetterToTemplate(
      'CONCORRÊNCIA ELETRÔNICA Nº 005/2026\nPROCESSO ADMINISTRATIVO: 12345/2026\nOBJETO: Pavimentação de ruas\nVALOR GLOBAL DA PROPOSTA: R$ 875.000,00\nPRAZO DE EXECUÇÃO: 8 meses\nVALIDADE DA PROPOSTA: 60 dias\nRB EMPREENDIMENTOS LTDA - CNPJ 12.345.678/0001-90',
      {
        municipality: 'Cascavel',
        companyLegalName: 'RB EMPREENDIMENTOS LTDA',
        cnpj: '12.345.678/0001-90'
      }
    );
    expect(converted.bodyTemplate).toContain('{{numero_licitacao}}');
    expect(converted.bodyTemplate).toContain('{{processo_administrativo}}');
    expect(converted.bodyTemplate).toContain('{{objeto}}');
    expect(converted.bodyTemplate).toContain('{{valor_global}}');
    expect(converted.bodyTemplate).toContain('{{prazo_execucao}}');
    expect(converted.bodyTemplate).toContain('{{validade_proposta}}');
    expect(converted.bodyTemplate).toContain('{{empresa_razao_social}}');
    expect(converted.bodyTemplate).toContain('{{cnpj}}');
  });

  it('gera o valor da baixa por extenso', () => {
    expect(brlInWords(875000)).toContain('oitocentos e setenta e cinco mil reais');
  });
});
