import { AppError } from './app-error.js';

const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function underThousand(value: number) {
  if (value === 0) return '';
  if (value === 100) return 'cem';
  const parts: string[] = [];
  const h = Math.floor(value / 100);
  const rest = value % 100;
  if (h) parts.push(hundreds[h] ?? '');
  if (rest) {
    if (parts.length) parts.push('e');
    if (rest < 10) parts.push(units[rest] ?? '');
    else if (rest < 20) parts.push(teens[rest - 10] ?? '');
    else {
      const t = Math.floor(rest / 10);
      const u = rest % 10;
      parts.push(tens[t] ?? '');
      if (u) parts.push('e', units[u] ?? '');
    }
  }
  return parts.filter(Boolean).join(' ');
}

function integerToWords(value: number) {
  if (value === 0) return 'zero';
  const groups = [
    { size: 1_000_000_000, singular: 'bilhão', plural: 'bilhões' },
    { size: 1_000_000, singular: 'milhão', plural: 'milhões' },
    { size: 1_000, singular: 'mil', plural: 'mil' },
    { size: 1, singular: '', plural: '' }
  ];
  let remaining = Math.floor(value);
  const parts: string[] = [];
  for (const group of groups) {
    const count = Math.floor(remaining / group.size);
    if (!count) continue;
    remaining %= group.size;
    if (group.size === 1_000 && count === 1) parts.push('mil');
    else if (group.size > 1) parts.push(`${underThousand(count)} ${count === 1 ? group.singular : group.plural}`.trim());
    else parts.push(underThousand(count));
  }
  if (parts.length <= 1) return parts.join('');
  const last = parts.pop()!;
  return `${parts.join(', ')}${/^(?:cem|cento|duzentos|trezentos|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos|\w+ e)/.test(last) ? ' e ' : ', '}${last}`;
}

export function brlInWords(input: string | number) {
  const number = Number(input);
  if (!Number.isFinite(number) || number < 0) return '';
  const totalCents = Math.round(number * 100);
  const reais = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  const parts: string[] = [];
  if (reais > 0) parts.push(`${integerToWords(reais)} ${reais === 1 ? 'real' : 'reais'}`);
  if (cents > 0) parts.push(`${integerToWords(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`);
  return parts.join(' e ') || 'zero reais';
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function replaceKnownValue(text: string, value: string | null | undefined, placeholder: string) {
  const clean = value?.trim();
  if (!clean || clean.length < 3) return text;
  return text.replace(new RegExp(escapeRegExp(clean), 'gi'), placeholder);
}

function replaceLabeledValue(line: string, labels: RegExp, placeholder: string) {
  const match = line.match(labels);
  if (!match || match.index === undefined) return line;
  const start = match.index + match[0].length;
  const prefix = line.slice(0, start);
  const suffix = line.slice(start);
  if (!suffix.trim()) return `${prefix} ${placeholder}`;
  return `${prefix}${suffix.replace(/^\s*[:\-–—]?\s*.*/, `: ${placeholder}`)}`;
}

function isSectionHeading(line: string) {
  return /^(?:VALOR|PRAZO|VALIDADE|PROCESSO|CONCORR[ÊE]NCIA|PREG[ÃA]O|TOMADA|DECLARA|CONDI[ÇC][ÕO]ES|GARANTIA|LOCAL|DATA|ASSINATURA|ATENCIOSAMENTE|OBSERVA[ÇC][ÕO]ES)/i.test(line.trim());
}

export function convertExtractedLetterToTemplate(
  extractedText: string,
  known: {
    municipality?: string | null;
    companyLegalName?: string | null;
    companyTradeName?: string | null;
    cnpj?: string | null;
    representative?: string | null;
  }
) {
  const originalLines = extractedText
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]));

  const detected = new Set<string>();
  const output: string[] = [];

  for (let index = 0; index < originalLines.length; index += 1) {
    let line = originalLines[index] ?? '';
    if (!line) {
      output.push('');
      continue;
    }

    if (/\bOBJETO\b/i.test(line)) {
      const objectMatch = line.match(/^(.*?\bOBJETO\b\s*[:\-–—]?\s*)(.*)$/i);
      if (objectMatch) {
        const prefix = objectMatch[1] ?? 'OBJETO: ';
        output.push(`${prefix}{{objeto}}`);
        detected.add('objeto');
        while (index + 1 < originalLines.length) {
          const next = (originalLines[index + 1] ?? '').trim();
          if (!next || isSectionHeading(next)) break;
          index += 1;
        }
        continue;
      }
    }

    if (/\bPROCESSO(?:\s+ADMINISTRATIVO)?\b/i.test(line)) {
      line = replaceLabeledValue(line, /\bPROCESSO(?:\s+ADMINISTRATIVO)?\b/i, '{{processo_administrativo}}');
      detected.add('processo_administrativo');
    }

    if (/\b(?:CONCORR[ÊE]NCIA|PREG[ÃA]O|TOMADA\s+DE\s+PRE[ÇC]OS|DISPENSA|LICITA[ÇC][ÃA]O)\b/i.test(line)) {
      const before = line;
      line = line.replace(
        /(\b(?:CONCORR[ÊE]NCIA|PREG[ÃA]O|TOMADA\s+DE\s+PRE[ÇC]OS|DISPENSA|LICITA[ÇC][ÃA]O)(?:\s+ELETR[ÔO]NIC[AO])?[^\n\d]{0,30}(?:N[º°O.]?\s*)?)(\d[\d./-]*)/i,
        '$1{{numero_licitacao}}'
      );
      if (line !== before) detected.add('numero_licitacao');
    }

    if (/\bVALOR\b.*\b(?:GLOBAL|PROPOSTA|TOTAL)\b/i.test(line) || /\bVALOR\s+DA\s+PROPOSTA\b/i.test(line)) {
      const before = line;
      line = line.replace(/R\$\s*[\d.]+(?:,\d{1,2})?/gi, '{{valor_global}}');
      line = line.replace(/\((?:[^()]|\([^)]*\)){3,180}?REAIS?[^)]*\)/i, '({{valor_global_extenso}})');
      if (line !== before) detected.add('valor_global');
    }

    if (/\bPRAZO\b.*\bEXECU[ÇC][ÃA]O\b/i.test(line)) {
      line = replaceLabeledValue(line, /\bPRAZO\b.*?\bEXECU[ÇC][ÃA]O\b/i, '{{prazo_execucao}}');
      detected.add('prazo_execucao');
    }

    if (/\bVALIDADE\b.*\bPROPOSTA\b/i.test(line) || /^VALIDADE\b/i.test(line)) {
      line = replaceLabeledValue(line, /\bVALIDADE(?:\s+DA)?\s+PROPOSTA\b/i, '{{validade_proposta}}');
      detected.add('validade_proposta');
    }

    const beforeCnpj = line;
    line = line.replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '{{cnpj}}');
    if (line !== beforeCnpj) detected.add('cnpj');

    const beforeDate = line;
    line = line.replace(/\b\d{1,2}\s+de\s+[a-zçãáâéêíóôõú]+(?:\s+de)?\s+\d{4}\b/gi, '{{data_atual}}');
    if (line !== beforeDate) detected.add('data_atual');

    const replacements: Array<[string | null | undefined, string, string]> = [
      [known.companyLegalName, '{{empresa_razao_social}}', 'empresa_razao_social'],
      [known.companyTradeName, '{{empresa_nome}}', 'empresa_nome'],
      [known.representative, '{{representante}}', 'representante'],
      [known.municipality, '{{municipio}}', 'municipio'],
      [known.cnpj, '{{cnpj}}', 'cnpj']
    ];
    for (const [value, placeholder, key] of replacements) {
      const next = replaceKnownValue(line, value, placeholder);
      if (next !== line) detected.add(key);
      line = next;
    }

    output.push(line);
  }

  const bodyTemplate = output.join('\n').replace(/\n{4,}/g, '\n\n\n').trim();
  return {
    bodyTemplate,
    detectedFields: Array.from(detected).sort(),
    warnings: [
      ...(detected.has('numero_licitacao') ? [] : ['Número da licitação não foi identificado automaticamente.']),
      ...(detected.has('objeto') ? [] : ['Objeto não foi identificado automaticamente.']),
      ...(detected.has('valor_global') ? [] : ['Valor global não foi identificado automaticamente.']),
      ...(detected.has('prazo_execucao') ? [] : ['Prazo de execução não foi identificado automaticamente.'])
    ]
  };
}

type PdfJsTextItem = { str?: unknown; transform?: unknown };
type PdfJsPage = {
  getTextContent: () => Promise<{ items: PdfJsTextItem[] }>;
  cleanup?: () => void;
};
type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  destroy?: () => Promise<void>;
};

export async function extractTextFromProposalPdf(buffer: Buffer) {
  const moduleName = 'pdfjs-dist/legacy/build/pdf.js';
  const imported = (await import(moduleName)) as {
    default?: { getDocument?: (options: Record<string, unknown>) => { promise: Promise<PdfJsDocument>; destroy?: () => Promise<void> } };
    getDocument?: (options: Record<string, unknown>) => { promise: Promise<PdfJsDocument>; destroy?: () => Promise<void> };
  };
  const getDocument = imported.getDocument ?? imported.default?.getDocument;
  if (!getDocument) throw new AppError('Não foi possível inicializar o leitor de PDF', 500);
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false
  });
  const document = await loadingTask.promise;
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items
        .filter((item) => typeof item.str === 'string' && (item.str as string).trim())
        .map((item) => ({
          text: String(item.str),
          x: Array.isArray(item.transform) ? Number(item.transform[4] ?? 0) : 0,
          y: Array.isArray(item.transform) ? Number(item.transform[5] ?? 0) : 0
        }));

      const lines: Array<{ y: number; items: typeof items }> = [];
      for (const item of items) {
        let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5);
        if (!line) {
          line = { y: item.y, items: [] };
          lines.push(line);
        }
        line.items.push(item);
      }
      lines.sort((a, b) => b.y - a.y);
      const pageText = lines
        .map((line) =>
          line.items
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text.trim())
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()
        )
        .filter(Boolean)
        .join('\n');
      if (pageText) pages.push(pageText);
      page.cleanup?.();
    }
  } finally {
    await document.destroy?.();
    await loadingTask.destroy?.();
  }
  const text = pages.join('\n\n').trim();
  if (text.length < 30) {
    throw new AppError(
      'Não foi possível ler texto deste PDF. Se ele for escaneado como imagem, use um PDF com texto selecionável ou salve-o novamente como PDF pesquisável.',
      422
    );
  }
  return text;
}
