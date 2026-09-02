import { UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import { assertCompanyWriteAccess, type AuthScope } from './access.service.js';
import { getBid } from './bid.service.js';

export const DEFAULT_PROPOSAL_TEMPLATE = `CARTA PROPOSTA

À Prefeitura Municipal de {{municipio}}

Ref.: {{modalidade}} nº {{numero_licitacao}}
Processo Administrativo: {{processo_administrativo}}

A empresa {{empresa_razao_social}}, inscrita no CNPJ sob o nº {{cnpj}}, apresenta sua proposta para o objeto abaixo descrito:

OBJETO: {{objeto}}

VALOR GLOBAL DA PROPOSTA: {{valor_global}}
PRAZO DE EXECUÇÃO: {{prazo_execucao}}
VALIDADE DA PROPOSTA: {{validade_proposta}}

Declaramos que estão inclusos no valor proposto todos os custos, despesas, tributos e demais encargos necessários à execução do objeto.

{{municipio}}, {{data_atual}}.

________________________________________
{{empresa_razao_social}}
{{representante}}`;

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

const scopeKey = (municipality: string, state?: string | null) =>
  `${normalize(municipality)}:${state?.trim().toUpperCase() || 'BR'}`;

export async function getProposalTemplate(municipality: string, state: string | null | undefined) {
  const key = scopeKey(municipality, state);
  const template = await prisma.proposalLetterTemplate.findUnique({ where: { scopeKey: key } });
  return {
    municipality,
    state: state || null,
    bodyTemplate: template?.bodyTemplate ?? DEFAULT_PROPOSAL_TEMPLATE,
    custom: Boolean(template),
    updatedAt: template?.updatedAt ?? null
  };
}

export async function saveProposalTemplate(
  input: { municipality: string; state?: string | null; bodyTemplate: string },
  auth: AuthScope
) {
  if (auth.role === UserRole.EMPRESA) throw new AppError('Apenas a equipe pode alterar modelos de Carta Proposta', 403);
  const key = scopeKey(input.municipality, input.state);
  return prisma.proposalLetterTemplate.upsert({
    where: { scopeKey: key },
    create: {
      scopeKey: key,
      municipality: input.municipality.trim(),
      state: input.state?.trim().toUpperCase() || null,
      bodyTemplate: input.bodyTemplate.trim()
    },
    update: {
      municipality: input.municipality.trim(),
      state: input.state?.trim().toUpperCase() || null,
      bodyTemplate: input.bodyTemplate.trim()
    }
  });
}

const brl = (value: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

const dateBr = (value: Date) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza' }).format(value);

function replaceTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_full, key: string) => values[key] ?? `{{${key}}}`);
}

export async function getProposalLetterContext(bidId: string, auth: AuthScope) {
  const bid = await getBid(bidId, auth);
  await assertCompanyWriteAccess(bid.companyId, auth);
  const discount = await prisma.discountCalculation.findUnique({
    where: { companyId_tenderId: { companyId: bid.companyId, tenderId: bid.tenderId } }
  });
  const template = await getProposalTemplate(bid.tender.municipality, bid.tender.state);

  const missing: string[] = [];
  if (!bid.tender.noticeNumber) missing.push('Número da licitação');
  if (!bid.tender.executionTerm) missing.push('Prazo de execução');
  if (!discount?.discountedValue) missing.push('Valor final da baixa');

  const values = {
    empresa_razao_social: bid.company.legalName,
    empresa_nome: bid.company.tradeName || bid.company.legalName,
    cnpj: bid.company.cnpj,
    representante: bid.company.contactName || 'Representante legal',
    municipio: bid.tender.municipality,
    estado: bid.tender.state || '',
    modalidade: bid.tender.modality || 'Licitação',
    numero_licitacao: bid.tender.noticeNumber || 'não informado',
    processo_administrativo: bid.tender.processNumber || 'não informado',
    objeto: bid.tender.object,
    valor_global: discount?.discountedValue ? brl(discount.discountedValue.toString()) : 'não informado',
    prazo_execucao: bid.tender.executionTerm || 'não informado',
    validade_proposta: bid.tender.proposalValidityDays ? `${bid.tender.proposalValidityDays} dias` : 'não informada',
    data_atual: dateBr(new Date())
  };

  return {
    bidId: bid.id,
    companyId: bid.companyId,
    tenderId: bid.tenderId,
    template,
    values,
    missing,
    canGenerate: missing.length === 0,
    generatedText: replaceTemplate(template.bodyTemplate, values),
    discountedValue: discount?.discountedValue?.toString() ?? null,
    discountPercentage:
      discount?.discountedValue && bid.tender.estimatedValue
        ? Number(bid.tender.estimatedValue)
            ? ((Number(bid.tender.estimatedValue) - Number(discount.discountedValue)) /
                Number(bid.tender.estimatedValue)) *
              100
            : null
        : null
  };
}

function sanitizePdfText(text: string) {
  const normalized = text
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/•/g, '-');
  return Array.from(normalized)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return character === '\n' || character === '\r' || character === '\t' || (code >= 32 && code <= 255);
    })
    .join('');
}

function escapePdfText(text: string) {
  return sanitizePdfText(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapParagraph(text: string, max = 88) {
  if (!text.trim()) return [''];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (!line) {
      line = word;
      continue;
    }
    if (`${line} ${word}`.length <= max) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pdfObject(id: number, content: string | Buffer) {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content, 'latin1');
  return Buffer.concat([Buffer.from(`${id} 0 obj\n`, 'latin1'), body, Buffer.from('\nendobj\n', 'latin1')]);
}

export function buildProposalPdf(text: string) {
  const logicalLines = sanitizePdfText(text)
    .split(/\r?\n/)
    .flatMap((line) => wrapParagraph(line));
  const linesPerPage = 47;
  const pages: string[][] = [];
  for (let i = 0; i < logicalLines.length; i += linesPerPage) pages.push(logicalLines.slice(i, i + linesPerPage));
  if (pages.length === 0) pages.push(['']);

  const pageIds = pages.map((_page, index) => 4 + index * 2);
  const contentIds = pages.map((_page, index) => 5 + index * 2);
  const objects: Array<{ id: number; buffer: Buffer }> = [];
  objects.push({ id: 1, buffer: pdfObject(1, '<< /Type /Catalog /Pages 2 0 R >>') });
  objects.push({
    id: 2,
    buffer: pdfObject(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`)
  });
  objects.push({ id: 3, buffer: pdfObject(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>') });

  pages.forEach((pageLines, index) => {
    const pageId = pageIds[index]!;
    const contentId = contentIds[index]!;
    const commands = [
      'BT',
      '/F1 11 Tf',
      '15 TL',
      '56 786 Td',
      ...pageLines.flatMap((line) => [`(${escapePdfText(line)}) Tj`, 'T*']),
      'ET'
    ].join('\n');
    const stream = Buffer.from(commands, 'latin1');
    objects.push({
      id: pageId,
      buffer: pdfObject(
        pageId,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`
      )
    });
    objects.push({
      id: contentId,
      buffer: pdfObject(
        contentId,
        Buffer.concat([
          Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'latin1'),
          stream,
          Buffer.from('\nendstream', 'latin1')
        ])
      )
    });
  });

  objects.sort((a, b) => a.id - b.id);
  const header = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1');
  const chunks: Buffer[] = [header];
  const offsets: number[] = [0];
  let offset = header.length;
  for (const item of objects) {
    offsets[item.id] = offset;
    chunks.push(item.buffer);
    offset += item.buffer.length;
  }
  const maxId = Math.max(...objects.map((item) => item.id));
  const xrefOffset = offset;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id += 1) {
    xref += `${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
}
