import { describe, expect, it } from 'vitest';
import { changePasswordSchema } from '../src/validators/auth.validator.js';

const request = (body: Record<string, string>) => ({ body, params: {}, query: {} });

describe('alteração segura de senha', () => {
  it('aceita uma nova senha com 12 caracteres e confirmação correta', () => {
    const result = changePasswordSchema.safeParse(
      request({
        currentPassword: 'senha-atual',
        newPassword: 'nova-senha-segura',
        confirmPassword: 'nova-senha-segura'
      })
    );
    expect(result.success).toBe(true);
  });

  it('recusa senha curta', () => {
    const result = changePasswordSchema.safeParse(
      request({ currentPassword: 'senha-atual', newPassword: 'curta123', confirmPassword: 'curta123' })
    );
    expect(result.success).toBe(false);
  });

  it('recusa confirmação diferente', () => {
    const result = changePasswordSchema.safeParse(
      request({
        currentPassword: 'senha-atual',
        newPassword: 'nova-senha-segura',
        confirmPassword: 'outra-senha-segura'
      })
    );
    expect(result.success).toBe(false);
  });
});
