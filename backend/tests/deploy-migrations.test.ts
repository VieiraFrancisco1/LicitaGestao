import { describe, expect, it } from 'vitest';
import {
  MAX_MIGRATION_ATTEMPTS,
  MIGRATION_RETRY_DELAYS_MS,
  isRetryableMigrationError
} from '../scripts/deploy-migrations.mjs';

describe('deploy de migrations', () => {
  it('repete erros temporarios de conexao ou bloqueio do Prisma', () => {
    expect(isRetryableMigrationError('Error: P1002')).toBe(true);
    expect(isRetryableMigrationError('Timed out trying to acquire a postgres advisory lock')).toBe(true);
  });

  it('nao repete erros permanentes de migration', () => {
    expect(isRetryableMigrationError('Error: P3009 failed migrations found')).toBe(false);
    expect(isRetryableMigrationError('Environment variable not found: DATABASE_URL')).toBe(false);
  });

  it('limita as tentativas e usa esperas progressivas', () => {
    expect(MAX_MIGRATION_ATTEMPTS).toBe(4);
    expect(MIGRATION_RETRY_DELAYS_MS).toEqual([5_000, 10_000, 20_000]);
  });
});
