import { brDate, validDate, type Candidate } from './discovery-core.js';
import { text } from './discovery-sources.js';
import { identifyTcePlatform, extractTceDocuments } from './discovery-tce-platform.js';

const DETAIL = /^https:\/\/municipios-licitacoes\.tce\.ce\.gov\.br\/index\.php\/licitacao\/detalhes\/proc\/\d+\/licit\/\d+$/i;

export function parseTcePublicDetails(html: string, item: Candidate): Candidate {
  const readable = text(html).slice(0, 135000);
  if (!/Detalhamento sobre a licita[cç][aã]o/i.test(readable)) return item;
  const section = (start: RegExp, end: RegExp, limit = 1600) => {
    const match = start.exec(readable);
    if (!match || match.index < 0) return '';
    const sub = readable.slice(match.index + match[0].length, match.index + match[0].length + limit);
    const stop = end.exec(sub);
    return (stop ? sub.slice(0, stop.index) : sub).trim();
  };
  const field = (label: RegExp, stops: RegExp, max = 200) => section(label, stops, max).slice(0, max).trim();
  const object = field(/\bObjeto\s*:\s*/i, /\bS[ií]ntese do Objeto\b|\bModalidade\s*:|\bCrit[eé]rio de julgamento\b/i, 2500);
  const agency = section(/(?:^|\s)[oó]rg[aã]os\s*/i, /\bObjeto\s*\/\s*Lotes\s*\/\s*Itens\b|\bN[ºo°]\s*do Processo Administrativo\b/i, 650).slice(0, 180);
  const process = field(/\bN[ºo°]\s*do Processo Administrativo\s*:\s*/i, /\bFundamenta[cç][aã]o Legal\b|\bOrdenador\b|\bRegime\b/i, 170);
  const modality = field(/\bModalidade\s*:\s*/i, /\bCrit[eé]rio de julgamento\b|\bSitua[cç][aã]o\s*:/i, 140);
  const openDate = field(/\bData de Abertura\s*:\s*/i, /\bHora da Abertura\b|\bLocal\s*:/i, 90);
  const time = readable.match(/\bHora da Abertura\s*:\s*(\d{1,2}:\d{2})/i)?.[1] ?? null;
  const local = section(/\bLocal\s*:\s*/i, /\bForma de Publica[cç][aã]o\b|\b[oó]rg[aã]os\b/i, 600);
  const platform = identifyTcePlatform(html);
  const link = platform?.platformUrl ?? null;
  const directUrl = item.sources.find((s) => s.source === 'TCE')?.url ?? '';
  const explicitInversion = /\b(?:invers[aã]o de fases|fase invertida)\b/i.test(readable);
  const electronic = /eletr[oô]nic/i.test(modality);
  const mappedModality = /concorr[eê]ncia/i.test(modality)
    ? (electronic ? 'Concorrência Eletrônica' : 'Concorrência')
    : /preg[aã]o/i.test(modality) ? (electronic ? 'Pregão Eletrônico' : 'Pregão')
    : /dispensa/i.test(modality) ? (electronic ? 'Dispensa Eletrônica' : 'Dispensa')
    : /credenciamento/i.test(modality) ? 'Credenciamento'
    : /leil[aã]o/i.test(modality) ? (electronic ? 'Leilão Eletrônico' : 'Leilão')
    : '';
  const parsedDate = brDate(openDate) ?? (validDate(openDate) ? openDate : null);
  return {
    ...item,
    object: object && object.length >= 8 ? object : item.object,
    agency: agency || item.agency,
    processNumber: process || item.processNumber,
    modality: mappedModality || item.modality,
    sessionDate: parsedDate || item.sessionDate,
    sessionTime: time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, '0') : item.sessionTime,
    ...(explicitInversion ? { isInvertedPhase: true } : {}),
    ...(platform ? { platformName: platform.platformName, platformUrl: link, platformEvidence: platform.platformEvidence } : {}),
    ...(DETAIL.test(directUrl) ? { documents: extractTceDocuments(html, directUrl) } : {})
  };
}

export async function fetchTcePublicDetails(item: Candidate, fetcher: typeof fetch = fetch): Promise<Candidate> {
  const source = item.sources.find((s) => s.source === 'TCE' && DETAIL.test(s.url));
  if (!source) return item;
  const response = await fetcher(source.url, {
    signal: AbortSignal.timeout(9000), redirect: 'error',
    headers: { 'User-Agent': 'LicitaGestao/1.0 (metadados públicos de licitações TCE-CE)' }
  });
  if (!response.ok) throw new Error('Detalhes indisponíveis no TCE-CE');
  if (Number(response.headers.get('content-length') ?? 0) > 1_200_000) throw new Error('Página do TCE acima do limite');
  const html = await response.text();
  if (html.length > 1_200_000) throw new Error('Página do TCE acima do limite');
  return parseTcePublicDetails(html, item);
}
