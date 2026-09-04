import { describe, expect, it } from 'vitest';
import { parseSystemBackup } from '../src/services/backup.service.js';

const validBackup = {
  format: 'LICITAGESTAO_BACKUP',
  version: 1,
  generatedAt: '2026-09-03T12:00:00.000Z',
  data: {
    users: [],
    companies: [],
    companyUsers: [],
    platforms: [],
    tenders: [],
    bids: [],
    documents: [],
    discounts: [],
    proposalLetterTemplates: [],
    emailMessages: []
  }
};

describe('validação do backup do sistema', () => {
  it('aceita um backup do LicitaGestão na versão suportada', () => {
    const parsed = parseSystemBackup(JSON.stringify(validBackup));
    expect(parsed.format).toBe('LICITAGESTAO_BACKUP');
    expect(parsed.version).toBe(1);
  });

  it('recusa arquivos de outro formato', () => {
    expect(() => parseSystemBackup(JSON.stringify({ ...validBackup, format: 'OUTRO_SISTEMA' }))).toThrow(
      'O arquivo não é um backup válido do LicitaGestão'
    );
  });

  it('recusa conteúdo que não seja JSON', () => {
    expect(() => parseSystemBackup('arquivo inválido')).toThrow(
      'O arquivo não é um backup válido do LicitaGestão'
    );
  });
});
