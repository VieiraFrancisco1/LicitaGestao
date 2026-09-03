import { describe, expect, it } from 'vitest';
import { dismissDeadlineSchema } from '../src/validators/deadline.validator.js';
import { gmailDismissAlertSchema } from '../src/validators/gmail.validator.js';

describe('validação da exclusão de notificações', () => {
  it('aceita o identificador válido de um aviso por e-mail', () => {
    const result = gmailDismissAlertSchema.safeParse({
      params: { messageId: '11111111-1111-4111-8111-111111111111' }
    });
    expect(result.success).toBe(true);
  });

  it('rejeita o identificador inválido de um aviso por e-mail', () => {
    const result = gmailDismissAlertSchema.safeParse({ params: { messageId: 'invalido' } });
    expect(result.success).toBe(false);
  });

  it('aceita uma chave válida de alerta de prazo', () => {
    const result = dismissDeadlineSchema.safeParse({
      body: { alertKey: 'SESSION:11111111-1111-4111-8111-111111111111:2026-09-03' }
    });
    expect(result.success).toBe(true);
  });

  it('rejeita uma chave de alerta vazia', () => {
    const result = dismissDeadlineSchema.safeParse({ body: { alertKey: '' } });
    expect(result.success).toBe(false);
  });
});
