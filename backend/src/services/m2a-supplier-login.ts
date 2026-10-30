import type { Page } from 'playwright';

// A M2A apresenta a escolha de perfil antes do formulário de credenciais.
// Nunca inserir credenciais em páginas HTTP ou fora dos domínios oficiais.
const M2A_HOME = 'https://compras.m2atecnologia.com.br/';
const HOSTS = new Set(['compras.m2atecnologia.com.br', 'precodereferencia.m2atecnologia.com.br']);

export function secureM2aAddress(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && HOSTS.has(url.hostname.toLowerCase()) && !url.username && !url.password;
  } catch { return false; }
}

export class M2aNavigationError extends Error {
  constructor(public readonly safeMessage: string) { super(safeMessage); this.name = 'M2aNavigationError'; }
}

function ensureSecure(url: string) {
  if (!secureM2aAddress(url)) {
    throw new M2aNavigationError('A M2A encaminhou o acesso para uma página HTTP não segura ou domínio não autorizado. Nenhuma credencial foi enviada. Solicite ao suporte da M2A um endereço HTTPS válido para fornecedores.');
  }
}

export async function openM2aSupplierLogin(page: Page, progress?: (stage: string) => void | Promise<void>) {
  await progress?.('abrir portal público da M2A');
  await page.goto(M2A_HOME, { waitUntil: 'commit', timeout: 20000 });
  ensureSecure(page.url());

  await progress?.('localizar acesso da M2A');
  const login = page.getByRole('link', { name: /fazer login/i }).first();
  if (!await login.isVisible().catch(() => false)) {
    throw new M2aNavigationError('O link Fazer login não apareceu no portal público da M2A. Nenhuma senha foi enviada.');
  }
  const href = await login.getAttribute('href');
  if (!href) throw new M2aNavigationError('O portal M2A não informou o endereço de login.');
  const target = new URL(href, page.url());
  if (!HOSTS.has(target.hostname.toLowerCase())) {
    throw new M2aNavigationError('O portal M2A enviou o login para domínio não autorizado. Nenhuma senha foi enviada.');
  }
  // Alguns links oficiais apontam HTTP. Só visitar a versão HTTPS; nunca transmitir a senha em HTTP.
  if (target.protocol === 'http:') target.protocol = 'https:';
  ensureSecure(target.href);

  await progress?.('abrir escolha de perfil M2A');
  await page.goto(target.href, { waitUntil: 'commit', timeout: 20000 });
  ensureSecure(page.url());

  await progress?.('selecionar fornecedor M2A');
  const supplier = page.getByText('Fornecedor', { exact: true }).first();
  try { await supplier.waitFor({ state: 'visible', timeout: 10000 }); }
  catch { throw new M2aNavigationError('A opção Fornecedor não apareceu na tela da M2A. Nenhuma senha foi enviada.'); }
  await supplier.click({ timeout: 5000 });
  const enter = page.getByRole('button', { name: /^acessar$/i }).first();
  try { await enter.waitFor({ state: 'visible', timeout: 6000 }); }
  catch { throw new M2aNavigationError('O botão Acessar não apareceu depois de selecionar Fornecedor.'); }

  await progress?.('abrir formulário do fornecedor');
  await enter.click({ timeout: 7000, noWaitAfter: true });
  await page.waitForTimeout(500);
  ensureSecure(page.url());
  // O chamador só deverá preencher usuário/senha após validar a página atual com HTTPS.
  await progress?.('verificar formulário do fornecedor');
}
