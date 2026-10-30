import { createHash } from 'node:crypto';
import { chromium, type Page } from 'playwright';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { requireOrganizationId, type AuthScope } from './access.service.js';
import { decryptSecret } from './gmail-utils.js';
import { brDate, classify, normalize, validDate, type Candidate, type DiscoverySettings } from './discovery-core.js';

// Login somente sob demanda, nunca nos ciclos automáticos. Sem cookies, traces ou senhas persistidos.
// Os portais podem alterar suas telas: uma etapa não confirmada é relatada, nunca considerada êxito.
export type PlatformSearchResult = { items: Candidate[]; warnings: string[]; attempts: Array<{ name: string; result: string; found: number }> };
type Platform = 'M2A' | 'LICITAMAIS' | 'BLL';
type Credentials = { username: string; password: string };
const PORTALS = {
  M2A: { name: 'M2A Compras', login: 'https://precodereferencia.m2atecnologia.com.br/usuario/login/' },
  LICITAMAIS: { name: 'Licita Mais', login: 'https://licitamaisbrasil.com.br/login' },
  BLL: { name: 'BLL Compras', login: 'https://bllcompras.com/Home/Login' }
} as const;
const busy = new Set<string>();
const lastAttempt = new Map<string, number>();

export function permittedPlatformUrl(platform: Platform, raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    return platform === 'M2A'
      ? ['precodereferencia.m2atecnologia.com.br', 'compras.m2atecnologia.com.br'].includes(host)
      : platform === 'LICITAMAIS' ? ['licitamaisbrasil.com.br', 'www.licitamaisbrasil.com.br'].includes(host)
      : ['bllcompras.com', 'www.bllcompras.com'].includes(host);
  } catch { return false; }
}

const money = (s: string): number | null => {
  const found = s.match(/R\$\s*([\d.]+,\d{2})/i);
  if (!found) return null;
  const n = Number(found[1]!.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const municipality = (s: string) => {
  const match = s.match(/\b([\p{L}][\p{L} .'-]{2,55})\s*[-/]\s*CE\b/iu);
  if (!match) return null;
  return match[1]!.trim().replace(/^(municipio|munic[ií]pio|prefeitura)\s+(de\s+)?/i, '').trim();
};
const date = (s: string) => {
  const matches = [...s.matchAll(/\b(\d{2}\/\d{2}\/20\d{2})\b/g)];
  return matches.length ? brDate(matches.at(-1)![1]!) : null;
};
export type PortalRow = { text: string; href: string };

/** Transforma somente linhas COM cidade - CE, obra, valor e sessão verificáveis.
 * A ausência de qualquer campo é um resultado de diagnóstico, não uma licitação inventada.
 */
export function parsePlatformRows(rows: PortalRow[], platform: Platform): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(0, 350)) {
    const raw = row.text.replace(/\s+/g, ' ').trim().slice(0, 3500);
    const city = municipality(raw);
    const value = money(raw);
    const sessionDate = date(raw);
    const categories = classify(raw);
    if (!city || !value || !sessionDate || !categories.length || !validDate(sessionDate)) continue;
    if (!permittedPlatformUrl(platform, row.href)) continue;
    const url = new URL(row.href);
    if (url.username || url.password || /token|session|access_key|password|auth/i.test(url.search)) continue;
    const key = `PORTAL:${platform}:${createHash('sha256').update(url.origin + url.pathname + '|' + normalize(raw)).digest('hex').slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Não utilizar palavras-chave isoladas do cabeçalho como objeto: a linha inteira é
    // uma descrição provisória e será verificada no edital antes do cadastro.
    candidates.push({ key, sourceKeys: [key], sources: [{ source: 'PORTAL', url: url.href }], municipality: city,
      state: 'CE', reference: '', processNumber: '', agency: '', modality: '', object: raw,
      estimatedValue: value, sessionDate, sessionTime: null, publishedDate: null,
      categories, reason: 'Dados observados no portal; confira o edital oficial.', aiReviewed: false,
      platformName: PORTALS[platform].name, platformUrl: url.href, documents: [], phaseStatus: 'NAO_IDENTIFICADA' });
  }
  return candidates;
}

async function readRows(page: Page, platform: Platform): Promise<Candidate[]> {
  const data = await page.locator('tr, article').evaluateAll((elements) => elements.slice(0, 350).map((tr) => ({
    text: (tr as HTMLElement).innerText || tr.textContent || '',
    href: (tr.querySelector('a[href]') as HTMLAnchorElement | null)?.href || location.href
  })));
  return parsePlatformRows(data, platform);
}

async function fill(page: Page, value: string, selector: string): Promise<boolean> {
  const inputs = page.locator(selector);
  for (let i = 0, n = Math.min(await inputs.count(), 12); i < n; i++) {
    const input = inputs.nth(i);
    if (await input.isVisible().catch(() => false) && await input.isEnabled().catch(() => false)) {
      await input.fill(value, { timeout: 3000 });
      return true;
    }
  }
  return false;
}
async function submit(page: Page) {
  const button = page.getByRole('button', { name: /entrar|login|acessar|continuar/i }).first();
  if (await button.isVisible().catch(() => false)) { await button.click({ timeout: 5000 }); return true; }
  const direct = page.locator('button[type="submit"],input[type="submit"]').first();
  if (await direct.isVisible().catch(() => false)) { await direct.click({ timeout: 5000 }); return true; }
  return false;
}
async function login(page: Page, platform: Platform, credentials: Credentials) {
  await page.goto(PORTALS[platform].login, { waitUntil: 'domcontentloaded', timeout: 14000 });
  if (!permittedPlatformUrl(platform, page.url())) return 'Redirecionamento para domínio não autorizado';
  if (platform === 'BLL') return 'Autenticação BLL com teclado virtual ainda não validada';
  const selector = 'input[autocomplete="username"],input[name*="email" i],input[name*="login" i],input[name*="cnpj" i],input[type="email"],input[type="text"]';
  if (!await fill(page, credentials.username, selector)) return 'Campo de usuário não reconhecido';
  let pass = await fill(page, credentials.password, 'input[type="password"]');
  if (!pass) {
    if (!await submit(page)) return 'Próxima etapa do login não encontrada';
    await page.waitForTimeout(1500);
    if (!permittedPlatformUrl(platform, page.url())) return 'Redirecionamento não autorizado no login';
    pass = await fill(page, credentials.password, 'input[type="password"]');
  }
  if (!pass) return 'Campo de senha não reconhecido ou verificação adicional exigida';
  if (!await submit(page)) return 'Botão de autenticação não encontrado';
  await page.waitForTimeout(2000);
  if (!permittedPlatformUrl(platform, page.url())) return 'Domínio não autorizado após login';
  const visibleText = (await page.locator('body').innerText({ timeout: 3500 }).catch(() => '')).slice(0, 4500);
  if (/captcha|verifica[cç][aã]o em duas etapas|c[oó]digo de verifica[cç][aã]o|autenticador|2fa/i.test(visibleText)) return 'Verificação humana exigida pelo portal';
  const logout = page.getByRole('link', { name: /sair|logout|encerrar sess[aã]o/i }).or(page.getByRole('button', { name: /sair|logout|encerrar sess[aã]o/i }));
  if (!await logout.first().isVisible().catch(() => false)) return 'Não foi possível confirmar a sessão autenticada';
  return null;
}

async function search(page: Page, platform: Platform): Promise<{ items: Candidate[]; reason: string }> {
  if (platform === 'M2A') {
    // Endereço público real de listagem da M2A. A sessão autenticada já foi
    // iniciada no mesmo contexto do navegador; não há envio de propostas.
    const found: Candidate[] = [];
    for (const query of ['obras', 'pavimentação', 'construção']) {
      const target = `https://compras.m2atecnologia.com.br/processos/index/?search=${encodeURIComponent(query)}`;
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 14000 });
      if (!permittedPlatformUrl(platform, page.url())) return { items: found, reason: 'Portal redirecionou fora dos domínios previstos' };
      await page.locator('tbody tr, article').first().waitFor({ state: 'visible', timeout: 6500 }).catch(() => undefined);
      found.push(...await readRows(page, platform));
    }
    return { items: found, reason: found.length ? 'Registros lidos na página de processos' : 'Não há linhas com objeto, cidade/CE, valor e data verificáveis; conferir interface de processos' };
  }
  if (platform === 'LICITAMAIS') {
    // Sem inventar URLs internas: procurar a navegação oferecida pelo próprio portal.
    const link = page.getByRole('link', { name: /licita[cç][oõ]es|editais|processos|certames/i }).or(page.getByRole('button', { name: /licita[cç][oõ]es|editais|processos|certames/i })).first();
    if (!await link.isVisible().catch(() => false)) return { items: [], reason: 'Menu de licitações não encontrado após login' };
    await link.click({ timeout: 6000 });
    if (!permittedPlatformUrl(platform, page.url())) return { items: [], reason: 'Página de licitações fora do domínio permitido' };
    await page.locator('tbody tr, article').first().waitFor({ state: 'visible', timeout: 6500 }).catch(() => undefined);
    const items = await readRows(page, platform);
    return { items, reason: items.length ? 'Registros encontrados no portal' : 'A tela atual não contém licitações com campos completos; revisar seletor da listagem' };
  }
  return { items: [], reason: 'BLL requer adaptador específico para teclado virtual' };
}

export async function searchAuthenticatedPlatforms(
  auth: AuthScope, _settings: DiscoverySettings, progress?: (s: string) => Promise<void> | void
): Promise<PlatformSearchResult> {
  const organizationId = requireOrganizationId(auth);
  const result: PlatformSearchResult = { items: [], warnings: [], attempts: [] };
  if (!env.PLATFORM_CREDENTIAL_ENCRYPTION_KEY) {
    result.warnings.push('Plataformas: chave do cofre de credenciais não configurada');
    return result;
  }
  const accounts = await prisma.platformCredential.findMany({ where: { organizationId, userId: auth.userId }, select: { platform: true, secretEncrypted: true } });
  if (!accounts.length) return result;
  const lock = `${organizationId}:${auth.userId}`;
  if (busy.has(lock)) { result.warnings.push('A pesquisa privada já está em execução nesta conta.'); return result; }
  if (Date.now() - (lastAttempt.get(lock) ?? 0) < 90_000) {
    result.warnings.push('Novo login automático bloqueado por 90 segundos para proteger as contas.'); return result;
  }
  busy.add(lock); lastAttempt.set(lock, Date.now());
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    try { browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'], timeout: 15000 }); }
    catch { result.warnings.push('Playwright: Chromium indisponível no servidor. Configure o navegador no Render antes de pesquisar nas contas.'); return result; }
    for (const account of accounts) {
      const platform = account.platform as Platform;
      if (!(platform in PORTALS)) continue;
      if (platform === 'BLL') {
        result.attempts.push({ name: 'BLL Compras', result: 'Conector com teclado virtual pendente', found: 0 });
        result.warnings.push('BLL Compras: acesso automático ainda não validado; nenhum login realizado.');
        continue;
      }
      const name = PORTALS[platform].name;
      await progress?.(`Plataformas: entrando em ${name}`);
      let credentials: Credentials;
      try {
        const secret = JSON.parse(decryptSecret(account.secretEncrypted, env.PLATFORM_CREDENTIAL_ENCRYPTION_KEY)) as Credentials;
        if (!secret.username || !secret.password) throw new Error('invalid');
        credentials = secret;
      } catch { result.warnings.push(`${name}: credenciais não puderam ser abertas. Atualize o acesso.`); continue; }
      const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block', locale: 'pt-BR' });
      try {
        const page = await context.newPage();
        const error = await login(page, platform, credentials);
        if (error) {
          result.attempts.push({ name, result: error, found: 0 });
          result.warnings.push(`${name}: ${error}. Consulte Testar acesso.`);
          continue;
        }
        await progress?.(`Plataformas: login confirmado em ${name}; consultando certames`);
        const read = await search(page, platform);
        result.items.push(...read.items);
        result.attempts.push({ name, result: read.reason, found: read.items.length });
        if (!read.items.length) result.warnings.push(`${name}: ${read.reason}.`);
      } catch { result.warnings.push(`${name}: a navegação não foi concluída. A tela de busca precisa ser validada.`); }
      finally { await context.close().catch(() => undefined); }
    }
  } finally { await browser?.close().catch(() => undefined); busy.delete(lock); }
  result.items = [...new Map(result.items.map((i) => [i.key, i])).values()];
  return result;
}
