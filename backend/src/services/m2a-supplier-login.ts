import type { Page } from 'playwright';

// Tela de seleção do perfil confirmada por captura da própria M2A.
// Não depender do link "Fazer login" da página pública: ele pode não estar
// renderizado no instante em que o Playwright acessa o portal.
const SUPPLIER_CHOICE = 'https://precodereferencia.m2atecnologia.com.br/autenticacao/login/';
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
    throw new M2aNavigationError('O portal M2A encaminhou o acesso para HTTP ou domínio não autorizado. Nenhuma credencial foi enviada. Solicite ao suporte uma página de fornecedor com HTTPS válido.');
  }
}

export async function openM2aSupplierLogin(page: Page, progress?: (stage: string) => void | Promise<void>) {
  await progress?.('abrir diretamente a seleção de perfil Fornecedor da M2A');
  let response;
  try {
    response = await page.goto(SUPPLIER_CHOICE, { waitUntil: 'commit', timeout: 20000 });
  } catch {
    throw new M2aNavigationError('Não foi possível abrir a escolha de perfil da M2A por HTTPS. Nenhuma credencial foi enviada. Confira se esse endereço está disponível em uma janela normal.');
  }
  ensureSecure(page.url());
  if (!response || response.status() >= 400) {
    throw new M2aNavigationError('A página HTTPS de escolha de perfil da M2A não retornou uma resposta válida. Nenhuma senha foi enviada.');
  }

  await progress?.('selecionar fornecedor M2A');
  const supplier = page.getByText('Fornecedor', { exact: true }).first();
  try { await supplier.waitFor({ state: 'visible', timeout: 12000 }); }
  catch { throw new M2aNavigationError('A escolha de perfil abriu, mas a opção Fornecedor não ficou visível. Nenhuma senha foi enviada.'); }
  await supplier.click({ timeout: 5000 });
  ensureSecure(page.url());

  const enter = page.getByRole('button', { name: /^acessar$/i }).first();
  try { await enter.waitFor({ state: 'visible', timeout: 6000 }); }
  catch { throw new M2aNavigationError('O botão Acessar não apareceu após selecionar Fornecedor.'); }

  await progress?.('abrir formulário do fornecedor');
  await enter.click({ timeout: 7000, noWaitAfter: true });
  await page.waitForTimeout(500);
  ensureSecure(page.url());
  // O chamador só pode preencher usuário/senha após confirmar HTTPS na página atual.
  await progress?.('verificar formulário seguro do fornecedor');
}
