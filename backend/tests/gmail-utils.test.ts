import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  decryptSecret,
  detectPotentialConvocation,
  encryptSecret,
  extractGmailText
} from '../src/services/gmail-utils.js';

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
      detectPotentialConvocation({
        subject: 'Pregão 12/2026',
        text: 'Solicitamos apresentar documentos de habilitação.'
      }).detected
    ).toBe(true);
    expect(detectPotentialConvocation({ subject: 'Nota fiscal disponível' }).detected).toBe(false);
  });

  it.each([
    ['naoresponder@licitamaisbrasil.com.br', 'Licita+Brasil - Alteração do Edital'],
    ['naoresponder@licitamaisbrasil.com.br', 'Licita+Brasil - Resposta de Impugnação'],
    ['naoresponder@licitamaisbrasil.com.br', 'Nova Mensagem no Fórum do Processo - 001/2026'],
    ['avisos@bllcompras.com', 'Aviso de mudança de vencedor'],
    ['compras@m2atecnologia.com.br', 'Aviso de Prorrogação do certame Nº 003/2026'],
    ['compras@m2atecnologia.com.br', 'Aviso de anulação do certame'],
    ['compras@m2atecnologia.com.br', 'Aviso de esclarecimento'],
    ['compras@m2atecnologia.com.br', 'Aviso de revogação do certame']
  ])('identifica aviso de plataforma enviado por %s', (sender, subject) => {
    const result = detectPotentialConvocation({ sender, subject });
    expect(result.detected).toBe(true);
    expect(result.reason).toContain('Aviso da');
  });

  it('classifica aviso de licitação mesmo quando o remetente é desconhecido', () => {
    const result = detectPotentialConvocation({
      sender: 'contato@exemplo.com',
      subject: 'Aviso de revogação do certame Nº 002/2026-CE'
    });
    expect(result.detected).toBe(true);
    expect(result.reason).toContain('revogação do certame');
  });

  it('classifica conteúdo geral de licitação independentemente do remetente', () => {
    const result = detectPotentialConvocation({
      sender: 'pessoa@exemplo.com',
      subject: 'Informações importantes',
      text: 'Comunicado referente à licitação nº 001/2026.'
    });
    expect(result.detected).toBe(true);
  });

  it('classifica esclarecimento de remetente desconhecido quando há contexto de edital', () => {
    const result = detectPotentialConvocation({
      sender: 'pessoa@exemplo.com',
      subject: 'Esclarecimento',
      text: 'Resposta referente ao edital da concorrência eletrônica nº 10/2026.'
    });
    expect(result.detected).toBe(true);
    expect(result.reason).toContain('esclarecimento');
  });

  it.each([
    {
      sender: 'news@shein.com',
      subject: 'Você foi convocada para aproveitar nossas ofertas',
      text: 'Use seu cupom antes que a promoção termine.'
    },
    {
      sender: 'loja@exemplo.com',
      subject: 'Prorrogação da promoção',
      text: 'A oferta continua disponível por mais dois dias.'
    },
    {
      sender: 'atendimento@exemplo.com',
      subject: 'Esclarecimento sobre seu pedido',
      text: 'Confira as informações da sua compra.'
    }
  ])('não classifica mensagem comercial: $subject', (message) => {
    expect(detectPotentialConvocation(message).detected).toBe(false);
  });

  it('extrai conteúdo textual base64url de mensagem do Gmail', () => {
    const data = Buffer.from('Empresa convocada para apresentar proposta').toString('base64url');
    expect(extractGmailText({ mimeType: 'text/plain', body: { data } })).toContain('Empresa convocada');
  });
});
