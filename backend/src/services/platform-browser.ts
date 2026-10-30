import { chromium, type Page } from 'playwright';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { requireOrganizationId, type AuthScope } from './access.service.js';
import { decryptSecret } from './gmail-utils.js';
import { type LoginPlatform } from './discovery-credentials.js';
import { browserFailureHint } from './platform-browser-diagnostics.js';

// V61: diagnóstico sob demanda. Nunca armazena cookies, capturas ou senhas.
// NÃO participa de lances nem apresenta login como busca ativa de editais.
const LOGIN: Partial<Record<LoginPlatform, string>> = {
  M2A: 'https://precodereferencia.m2atecnologia.com.br/usuario/login/',
  LICITAMAIS: 'https://licitamaisbrasil.com.br/login'
};
const busy = new Set<string>();
const lastAttempt = new Map<string, number>();
const WAIT_BETWEEN_ATTEMPTS_MS = 90_000;

type TestResult = { platform: LoginPlatform; status: 'VERIFIED' | 'NEEDS_REVIEW' | 'UNSUPPORTED' | 'BROWSER_UNAVAILABLE'; message: string };
const message = (platform: LoginPlatform, status: TestResult['status'], description: string): TestResult => ({ platform, status, message: description });

function permittedHost(platform: LoginPlatform, currentUrl: string) {
  try {
    const url = new URL(currentUrl);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (platform === 'M2A') return host === 'precodereferencia.m2atecnologia.com.br' || host === 'compras.m2atecnologia.com.br';
    if (platform === 'LICITAMAIS') return host === 'licitamaisbrasil.com.br' || host === 'www.licitamaisbrasil.com.br';
    return false;
  } catch { return false; }
}

async function fillVisible(page: Page, value: string, selectors: string) {
  const fields = page.locator(selectors);
  for (let i = 0, n = Math.min(await fields.count(), 12); i < n; i++) {
    const field = fields.nth(i);
    if (await field.isVisible().catch(() => false) && await field.isEnabled().catch(() => false)) {
      await field.fill(value, { timeout: 3000 });
      return true;
    }
  }
  return false;
}
async function clickSubmit(page: Page) {
  const submit = page.getByRole('button', { name: /entrar|acessar|login|continuar/i }).first();
  if (await submit.isVisible().catch(() => false)) { await submit.click({ timeout: 4000 }); return true; }
  const input = page.locator('button[type="submit"],input[type="submit"]').first();
  if (await input.isVisible().catch(() => false)) { await input.click({ timeout: 4000 }); return true; }
  return false;
}
function challenge(text: string) {
  return /captcha|reCAPTCHA|hcaptcha|c[oó]digo de verifica[cç][aã]o|autenticador|verifica[cç][aã]o em duas etapas|2fa/i.test(text);
}

export async function testPlatformLogin(auth: AuthScope, platform: LoginPlatform): Promise<TestResult> {
  const organizationId = requireOrganizationId(auth);
  if (platform === 'BLL') return message(platform, 'UNSUPPORTED', 'A BLL usa teclado virtual. O conector precisa de validação específica antes de tentar login.');
  const url = LOGIN[platform];
  if (!url) return message(platform, 'UNSUPPORTED', 'Plataforma sem conector de diagnóstico.');
  if (!env.PLATFORM_CREDENTIAL_ENCRYPTION_KEY) throw new AppError('Cofre de credenciais indisponível.', 503);
  const key = `${organizationId}:${auth.userId}:${platform}`;
  if (busy.has(key)) throw new AppError('Já existe um teste em andamento para esta plataforma.', 409);
  if (Date.now() - (lastAttempt.get(key) ?? 0) < WAIT_BETWEEN_ATTEMPTS_MS) {
    throw new AppError('Aguarde 90 segundos antes de testar novamente. Isso evita bloqueios da conta.', 429);
  }
  const record = await prisma.platformCredential.findFirst({ where: { organizationId, userId: auth.userId, platform }, select: { secretEncrypted: true } });
  if (!record) throw new AppError('Cadastre as credenciais desta plataforma antes de testar.', 404);
  let creds: { username: string; password: string };
  try {
    const parsed: unknown = JSON.parse(decryptSecret(record.secretEncrypted, env.PLATFORM_CREDENTIAL_ENCRYPTION_KEY));
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid');
    const data = parsed as Record<string, unknown>;
    if (typeof data.username !== 'string' || typeof data.password !== 'string' || !data.username || !data.password) throw new Error('invalid');
    creds = { username: data.username, password: data.password };
  } catch { throw new AppError('Não foi possível abrir as credenciais. Edite o acesso salvo.', 409); }

  busy.add(key); lastAttempt.set(key, Date.now());
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let stage = 'iniciar Chromium';
  try {
    try { browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'], timeout: 16000 }); }
    catch (error) { return message(platform, 'BROWSER_UNAVAILABLE', browserFailureHint('iniciar Chromium', error)); }
    stage = 'abrir contexto do navegador';
    const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block', locale: 'pt-BR' });
    const page = await context.newPage();
    stage = 'abrir página de login';
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      stage = 'conferir domínio de autenticação';
      if (!permittedHost(platform, page.url())) return message(platform, 'NEEDS_REVIEW', 'O portal redirecionou para um domínio não previsto. É necessário conferir o fluxo.');
      const userSelector = 'input[autocomplete="username"], input[name*="email" i], input[name*="login" i], input[name*="cnpj" i], input[name*="cpf" i], input[type="email"], input[type="text"], input:not([type])';
      stage = 'encontrar campo de usuário';
      if (!await fillVisible(page, creds.username, userSelector)) return message(platform, 'NEEDS_REVIEW', 'Campo de usuário não identificado no portal. O conector precisa ser adaptado.');
      // Licita Mais tem etapa de e-mail e etapa de senha. Não clicar novamente se a senha já aparecer.
      stage = 'encontrar campo de senha';
      let hasPassword = await fillVisible(page, creds.password, 'input[type="password"]');
      if (!hasPassword) {
        if (!await clickSubmit(page)) return message(platform, 'NEEDS_REVIEW', 'Etapa de autenticação não reconhecida.');
        await page.waitForTimeout(1300);
        if (!permittedHost(platform, page.url())) return message(platform, 'NEEDS_REVIEW', 'Redirecionamento de autenticação não previsto.');
        hasPassword = await fillVisible(page, creds.password, 'input[type="password"]');
      }
      if (!hasPassword) return message(platform, 'NEEDS_REVIEW', 'Campo de senha não encontrado. Pode haver uma verificação adicional.');
      stage = 'enviar login';
      if (!await clickSubmit(page)) return message(platform, 'NEEDS_REVIEW', 'Botão de login não encontrado.');
      await page.waitForTimeout(1900);
      if (!permittedHost(platform, page.url())) return message(platform, 'NEEDS_REVIEW', 'O portal mudou o domínio de autenticação.');
      stage = 'verificar sessão';
      const body = (await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')).slice(0, 6000);
      if (challenge(body)) return message(platform, 'NEEDS_REVIEW', 'O portal pediu uma verificação humana. Faça a verificação diretamente no site.');
      const logout = page.getByRole('link', { name: /sair|logout|encerrar sess[aã]o/i }).or(page.getByRole('button', { name: /sair|logout|encerrar sess[aã]o/i }));
      if (await logout.first().isVisible().catch(() => false)) return message(platform, 'VERIFIED', 'Login confirmado por controle de saída da conta. O navegador foi encerrado.');
      return message(platform, 'NEEDS_REVIEW', 'A página foi acessada, mas não foi possível confirmar a autenticação. Nenhuma busca privada foi executada.');
    } finally { await context.close().catch(() => undefined); }
  } catch (error) {
    const hint = browserFailureHint(stage, error);
    console.warn(`[login-diagnostic] ${platform}: ${hint}`);
    return message(platform, 'NEEDS_REVIEW', hint);
  } finally { await browser?.close().catch(() => undefined); busy.delete(key); }
}
