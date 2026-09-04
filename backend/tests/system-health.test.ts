import { describe, expect, it } from 'vitest';
import { summarizeEmailHealth } from '../src/services/system-health.service.js';

const now = new Date('2026-09-04T12:00:00.000Z');

describe('monitoramento do sistema', () => {
  it('considera operacional uma conta sincronizada recentemente', () => {
    const result = summarizeEmailHealth({
      configured: true,
      pollingIntervalMs: 120_000,
      now,
      integrations: [{ lastSuccessfulSyncAt: new Date('2026-09-04T11:58:30.000Z'), lastError: null }]
    });
    expect(result.status).toBe('OPERATIONAL');
    expect(result.connectedAccounts).toBe(1);
  });

  it('sinaliza conta com erro ou sincronização atrasada', () => {
    const withError = summarizeEmailHealth({
      configured: true,
      pollingIntervalMs: 90_000,
      now,
      integrations: [{ lastSuccessfulSyncAt: now, lastError: 'Falha temporária' }]
    });
    const delayed = summarizeEmailHealth({
      configured: true,
      pollingIntervalMs: 90_000,
      now,
      integrations: [{ lastSuccessfulSyncAt: new Date('2026-09-04T11:30:00.000Z'), lastError: null }]
    });
    expect(withError.status).toBe('WARNING');
    expect(withError.accountsWithError).toBe(1);
    expect(delayed.status).toBe('WARNING');
    expect(delayed.delayedAccounts).toBe(1);
  });

  it('distingue integração não configurada de integração sem conta', () => {
    const notConfigured = summarizeEmailHealth({
      configured: false,
      pollingIntervalMs: 90_000,
      now,
      integrations: []
    });
    const withoutAccount = summarizeEmailHealth({
      configured: true,
      pollingIntervalMs: 90_000,
      now,
      integrations: []
    });
    expect(notConfigured.status).toBe('NOT_CONFIGURED');
    expect(withoutAccount.status).toBe('WARNING');
  });
});

