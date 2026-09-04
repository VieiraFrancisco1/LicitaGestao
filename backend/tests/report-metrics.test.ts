import { describe, expect, it } from 'vitest';
import { buildOperationalSummary, type OperationalReportItem } from '../src/services/report-metrics.js';

const items: OperationalReportItem[] = [
  {
    tenderId: 'tender-a',
    sessionDate: '2026-09-10',
    noticeNumber: '001/2026',
    processNumber: 'PROC-A',
    municipality: 'Boa Viagem',
    state: 'CE',
    agency: 'Prefeitura A',
    platformName: 'BLL',
    spreadsheetReady: true,
    situation: 'PENDENTE',
    documents: 2
  },
  {
    tenderId: 'tender-a',
    sessionDate: '2026-09-10',
    noticeNumber: '001/2026',
    processNumber: 'PROC-A',
    municipality: 'Boa Viagem',
    state: 'CE',
    agency: 'Prefeitura A',
    platformName: 'BLL',
    spreadsheetReady: true,
    situation: 'ANEXADA',
    documents: 1
  },
  {
    tenderId: 'tender-b',
    sessionDate: '2026-08-22',
    noticeNumber: '002/2026',
    processNumber: 'PROC-B',
    municipality: 'Quixeramobim',
    state: 'CE',
    agency: 'Prefeitura B',
    platformName: 'M2A',
    spreadsheetReady: false,
    situation: 'PENDENTE',
    documents: 0
  }
];

describe('relatório operacional', () => {
  it('conta licitações distintas sem duplicar uma licitação com várias participações', () => {
    const summary = buildOperationalSummary(items);

    expect(summary.metrics).toEqual({
      tenders: 2,
      participations: 3,
      pendingAttachments: 2,
      spreadsheetsReady: 1,
      spreadsheetsPending: 1,
      documents: 3
    });
    expect(summary.rows).toHaveLength(2);
    expect(summary.rows.find((row) => row.id === 'tender-a')).toMatchObject({
      participations: 2,
      pendingAttachments: 1,
      documents: 3
    });
  });

  it('agrupa apenas volume operacional por mês, plataforma e município', () => {
    const summary = buildOperationalSummary(items);

    expect(summary.monthly).toEqual([
      { month: '2026-08', count: 1 },
      { month: '2026-09', count: 1 }
    ]);
    expect(summary.platforms).toEqual([
      { name: 'BLL', count: 1 },
      { name: 'M2A', count: 1 }
    ]);
    expect(summary.municipalities).toEqual([
      { name: 'Boa Viagem/CE', count: 1 },
      { name: 'Quixeramobim/CE', count: 1 }
    ]);
  });

  it('não inclui indicadores comerciais ou financeiros nas linhas do relatório', () => {
    const summary = buildOperationalSummary(items);
    const row = summary.rows[0]!;

    expect(row).not.toHaveProperty('companyName');
    expect(row).not.toHaveProperty('proposalValue');
    expect(row).not.toHaveProperty('winner');
    expect(row).not.toHaveProperty('successRate');
  });
});
