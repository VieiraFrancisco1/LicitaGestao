import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, detectPotentialConvocation, encryptSecret, extractGmailText } from '../src/services/gmail-utils.js';

describe('integração Gmail', () => {
  it('cifra o refresh token sem armazenar o valor em texto puro', () => {
    const key = crypto.randomBytes(32).toString('base64');
    const encrypted = encryptSecret('refresh-token-secreto', key);
    expect(encrypted).not.toContain('refresh-token-secreto');
    expect(decryptSecret(encrypted, key)).toBe('refresh-token-secreto');
  });

  it('identifica termos explícitos de convocação sem IA', () => {
    expect(detectPotentialConvocation({ subject: 'Convocação - Pregão 12/2026' }).detected).toBe(true);
    expect(
      detectPotentialConvocation({ subject: 'Pregão 12/2026', text: 'Solicitamos apresentar documentos de habilitação.' }).detected
    ).toBe(true);
    expect(detectPotentialConvocation({ subject: 'Nota fiscal disponível' }).detected).toBe(false);
  });

  it('extrai conteúdo textual base64url de mensagem do Gmail', () => {
    const data = Buffer.from('Empresa convocada para apresentar proposta').toString('base64url');
    expect(extractGmailText({ mimeType: 'text/plain', body: { data } })).toContain('Empresa convocada');
  });
});
