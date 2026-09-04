import crypto from 'node:crypto';
import { AppError } from '../utils/app-error.js';

const MAX_BODY_CHARS = 30_000;

export type GmailPayloadPart = {
  mimeType?: string;
  body?: { data?: string; attachmentId?: string };
  headers?: Array<{ name?: string; value?: string }>;
  parts?: GmailPayloadPart[];
};

function encryptionKey(secret: string) {
  const trimmed = secret.trim();
  const hex = /^[0-9a-f]{64}$/i.test(trimmed) ? Buffer.from(trimmed, 'hex') : null;
  const decoded = hex ?? Buffer.from(trimmed, 'base64');
  if (decoded.length !== 32) {
    throw new AppError('A chave de criptografia deve representar exatamente 32 bytes', 500);
  }
  return decoded;
}

export function encryptSecret(value: string, secret: string) {
  const key = encryptionKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptSecret(value: string, secret: string) {
  const [version, ivValue, tagValue, cipherValue] = value.split(':');
  if (version !== 'v1' || !ivValue || !tagValue || !cipherValue) {
    throw new AppError('Credencial de e-mail armazenada em formato inválido', 500);
  }
  const key = encryptionKey(secret);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  const clear = Buffer.concat([decipher.update(Buffer.from(cipherValue, 'base64url')), decipher.final()]);
  return clear.toString('utf8');
}

function decodeGmailBase64(value: string) {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractGmailText(payload?: GmailPayloadPart) {
  if (!payload) return '';
  const plain: string[] = [];
  const html: string[] = [];
  const visit = (part: GmailPayloadPart) => {
    if (part.body?.data) {
      const decoded = decodeGmailBase64(part.body.data);
      if (part.mimeType?.toLowerCase().startsWith('text/plain')) plain.push(decoded);
      else if (part.mimeType?.toLowerCase().startsWith('text/html')) html.push(decoded);
      else if (!part.parts?.length) plain.push(decoded);
    }
    part.parts?.forEach(visit);
  };
  visit(payload);
  const text = plain.length ? plain.join('\n') : stripHtml(html.join('\n'));
  return text.split(String.fromCharCode(0)).join('').trim().slice(0, MAX_BODY_CHARS);
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const CONVOCATION_TERMS = [
  'convocacao',
  'convocado',
  'convocada',
  'convocamos',
  'fica convocado',
  'fica convocada',
  'empresa convocada',
  'empresa convocado'
];

const PROCUREMENT_ACTION_TERMS = [
  'proposta readequada',
  'readequacao da proposta',
  'mandar a readequada',
  'mandar readequada',
  'mandar adequada',
  'enviar a readequada',
  'enviar readequada',
  'enviar proposta',
  'apresentar a readequada',
  'proposta ajustada',
  'documentos de habilitacao',
  'apresentar documentos',
  'enviar documentos',
  'apresentar proposta',
  'envio da proposta',
  'prazo para apresentacao',
  'prazo para envio'
];

const PROCUREMENT_CONTEXT_TERMS = [
  'pregao',
  'licitacao',
  'certame',
  'edital',
  'fornecedor',
  'portal de compras',
  'processo licitatorio'
];

const PLATFORM_SENDERS = [
  { name: 'Licita+Brasil', domains: ['licitamaisbrasil.com.br'] },
  { name: 'BLL Compras', domains: ['bllcompras.com', 'bll.org.br'] },
  { name: 'M2A Compras', domains: ['m2atecnologia.com.br'] }
];

const SPECIFIC_PROCUREMENT_ALERT_TERMS = [
  { terms: ['alteracao do edital', 'alteracoes do edital'], label: 'alteração do edital' },
  { terms: ['retificacao do edital', 'edital retificado'], label: 'retificação do edital' },
  { terms: ['resposta de impugnacao'], label: 'resposta de impugnação' },
  { terms: ['resposta de esclarecimento', 'aviso de esclarecimento'], label: 'esclarecimento' },
  { terms: ['nova mensagem no forum', 'mensagem no forum do processo'], label: 'nova mensagem no fórum' },
  { terms: ['aviso de mudanca de vencedor'], label: 'mudança de vencedor' },
  { terms: ['aviso de prorrogacao'], label: 'prorrogação do certame' },
  { terms: ['aviso de anulacao'], label: 'anulação do certame' },
  { terms: ['aviso de revogacao'], label: 'revogação do certame' },
  { terms: ['aviso de suspensao'], label: 'suspensão do certame' },
  { terms: ['aviso de homologacao'], label: 'homologação do certame' },
  { terms: ['aviso de adjudicacao'], label: 'adjudicação do certame' },
  { terms: ['prorrogacao do certame'], label: 'prorrogação do certame' },
  { terms: ['anulacao do certame'], label: 'anulação do certame' },
  { terms: ['revogacao do certame'], label: 'revogação do certame' },
  { terms: ['suspensao do certame'], label: 'suspensão do certame' },
  { terms: ['homologacao do certame'], label: 'homologação do certame' },
  { terms: ['adjudicacao do certame'], label: 'adjudicação do certame' },
  { terms: ['resultado da licitacao', 'resultado do certame'], label: 'resultado da licitação' },
  {
    terms: ['aviso de inabilitacao', 'licitante inabilitado', 'inabilitacao'],
    label: 'inabilitação de licitante'
  },
  {
    terms: ['aviso de desclassificacao', 'licitante desclassificado', 'desclassificacao'],
    label: 'desclassificação de licitante'
  },
  { terms: ['reabertura da sessao', 'nova data da sessao'], label: 'alteração da sessão' },
  { terms: ['recurso administrativo', 'contrarrazoes'], label: 'recurso da licitação' }
];

const CONTEXTUAL_ALERT_TERMS = [
  { terms: ['impugnacao'], label: 'resposta de impugnação' },
  { terms: ['esclarecimento'], label: 'esclarecimento' },
  { terms: ['mudanca de vencedor'], label: 'mudança de vencedor' },
  { terms: ['prorrogacao'], label: 'prorrogação do certame' },
  { terms: ['anulacao'], label: 'anulação do certame' },
  { terms: ['revogacao'], label: 'revogação do certame' },
  { terms: ['suspensao'], label: 'suspensão do certame' },
  { terms: ['homologacao'], label: 'homologação do certame' },
  { terms: ['adjudicacao'], label: 'adjudicação do certame' }
];

const STRONG_PROCUREMENT_TERMS = [
  'licitacao',
  'processo licitatorio',
  'certame',
  'pregao eletronico',
  'concorrencia eletronica'
];

export function detectPotentialConvocation(input: {
  sender?: string | null;
  subject?: string | null;
  snippet?: string | null;
  text?: string | null;
}) {
  const combined = normalizeText([input.subject, input.snippet, input.text].filter(Boolean).join('\n'));
  const normalizedSender = normalizeText(input.sender ?? '');
  const platform = PLATFORM_SENDERS.find((candidate) =>
    candidate.domains.some((domain) => normalizedSender.includes(`@${domain}`))
  );
  const context = PROCUREMENT_CONTEXT_TERMS.find((candidate) => combined.includes(candidate));
  const strongContext = STRONG_PROCUREMENT_TERMS.find((candidate) => combined.includes(candidate));
  const specificAlert = SPECIFIC_PROCUREMENT_ALERT_TERMS.find((candidate) =>
    candidate.terms.some((term) => combined.includes(term))
  );
  if (specificAlert) {
    return {
      detected: true,
      reason: platform
        ? `Aviso da ${platform.name}: ${specificAlert.label}`
        : `Aviso de licitação identificado: ${specificAlert.label}`
    };
  }

  const contextualAlert = CONTEXTUAL_ALERT_TERMS.find((candidate) =>
    candidate.terms.some((term) => combined.includes(term))
  );
  if (contextualAlert) {
    return {
      detected: true,
      reason: platform
        ? `Aviso da ${platform.name}: ${contextualAlert.label}`
        : `Aviso de licitação identificado: ${contextualAlert.label}`
    };
  }

  const action = PROCUREMENT_ACTION_TERMS.find((candidate) => combined.includes(candidate));
  const explicit = CONVOCATION_TERMS.find((candidate) => combined.includes(candidate));
  if (explicit) {
    return { detected: true, reason: `Termo de convocação identificado: ${explicit}` };
  }

  if (action && context) {
    return { detected: true, reason: `Ação licitatória identificada: ${action}` };
  }
  if (strongContext) {
    return { detected: true, reason: `Conteúdo de licitação identificado: ${strongContext}` };
  }
  return { detected: false, reason: null };
}
