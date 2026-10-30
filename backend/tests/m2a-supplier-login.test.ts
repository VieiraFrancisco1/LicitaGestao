import { describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright';
import { M2aNavigationError, openM2aSupplierLogin, secureM2aAddress } from '../src/services/m2a-supplier-login.js';

const CHOICE = 'https://precodereferencia.m2atecnologia.com.br/autenticacao/login/';

function fakePage(options: { failSupplier?: boolean; insecureAfterAccess?: boolean; insecureOnArrival?: boolean; gotoFail?: boolean; status?: number } = {}) {
  let currentUrl = 'about:blank';
  const supplier = {
    waitFor: vi.fn(options.failSupplier ? () => Promise.reject(new Error('not visible')) : () => Promise.resolve()),
    click: vi.fn().mockResolvedValue(undefined)
  };
  const enter = {
    waitFor: vi.fn().mockResolvedValue(undefined),
    click: vi.fn(async () => {
      if (options.insecureAfterAccess) currentUrl = 'http://precodereferencia.m2atecnologia.com.br/usuario/login/';
    })
  };
  const page = {
    goto: vi.fn(async (url: string) => {
      if (options.gotoFail) throw new Error('net::ERR_TIMED_OUT');
      currentUrl = options.insecureOnArrival ? url.replace('https:', 'http:') : url;
      return { status: () => options.status ?? 200 };
    }),
    url: vi.fn(() => currentUrl),
    getByRole: vi.fn(() => ({ first: () => enter })),
    getByText: vi.fn(() => ({ first: () => supplier })),
    waitForTimeout: vi.fn().mockResolvedValue(undefined)
  } as unknown as Page;
  return { page, supplier, enter };
}

describe('M2A fornecedor seguro', () => {
  it('permite apenas HTTPS nos domínios oficiais', () => {
    expect(secureM2aAddress(CHOICE)).toBe(true);
    expect(secureM2aAddress('https://compras.m2atecnologia.com.br/')).toBe(true);
    expect(secureM2aAddress(CHOICE.replace('https:', 'http:'))).toBe(false);
    expect(secureM2aAddress('https://m2atecnologia.com.br.evil.test/')).toBe(false);
  });
  it('abre diretamente a escolha de perfil, seleciona Fornecedor e Acessar sem buscar link na home', async () => {
    const test = fakePage();
    const progress = vi.fn();
    await openM2aSupplierLogin(test.page, progress);
    expect(test.page.goto).toHaveBeenCalledTimes(1);
    expect(test.page.goto).toHaveBeenCalledWith(CHOICE, { waitUntil: 'commit', timeout: 20000 });
    expect(test.page.getByText).toHaveBeenCalledWith('Fornecedor', { exact: true });
    expect(test.page.getByRole).toHaveBeenCalledWith('button', { name: /^acessar$/i });
    expect(test.supplier.click).toHaveBeenCalledTimes(1);
    expect(test.enter.click).toHaveBeenCalledTimes(1);
  });
  it('rejeita redirecionamento HTTP antes de tocar nos controles', async () => {
    const test = fakePage({ insecureOnArrival: true });
    await expect(openM2aSupplierLogin(test.page)).rejects.toThrow(M2aNavigationError);
    expect(test.supplier.click).not.toHaveBeenCalled();
  });
  it('rejeita HTTP depois do botão Acessar, antes de preencher senha', async () => {
    const test = fakePage({ insecureAfterAccess: true });
    await expect(openM2aSupplierLogin(test.page)).rejects.toThrow(M2aNavigationError);
  });
  it('não clica em Acessar se Fornecedor não apareceu', async () => {
    const test = fakePage({ failSupplier: true });
    await expect(openM2aSupplierLogin(test.page)).rejects.toThrow('Fornecedor');
    expect(test.enter.click).not.toHaveBeenCalled();
  });
  it('informa indisponibilidade do HTTPS sem expor o erro bruto', async () => {
    const test = fakePage({ gotoFail: true });
    await expect(openM2aSupplierLogin(test.page)).rejects.toThrow('por HTTPS');
    expect(test.supplier.click).not.toHaveBeenCalled();
  });
  it('não interage com perfil quando servidor devolve falha', async () => {
    const test = fakePage({ status: 403 });
    await expect(openM2aSupplierLogin(test.page)).rejects.toThrow('não retornou uma resposta válida');
    expect(test.supplier.click).not.toHaveBeenCalled();
  });
});
