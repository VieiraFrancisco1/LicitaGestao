import { describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright';
import { M2aNavigationError, openM2aSupplierLogin, secureM2aAddress } from '../src/services/m2a-supplier-login.js';

function fakePage(href: string, options: { failSupplier?: boolean; insecureAfterAccess?: boolean } = {}) {
  let currentUrl = 'about:blank';
  const login = { isVisible: vi.fn().mockResolvedValue(true), getAttribute: vi.fn().mockResolvedValue(href) };
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
    goto: vi.fn(async (url: string) => { currentUrl = url; return {}; }),
    url: vi.fn(() => currentUrl),
    getByRole: vi.fn((role: string) => ({ first: () => role === 'link' ? login : enter })),
    getByText: vi.fn(() => ({ first: () => supplier })),
    waitForTimeout: vi.fn().mockResolvedValue(undefined)
  } as unknown as Page;
  return { page, login, supplier, enter };
}

describe('M2A fornecedor seguro', () => {
  it('permite apenas HTTPS dos domínios oficiais', () => {
    expect(secureM2aAddress('https://compras.m2atecnologia.com.br/')).toBe(true);
    expect(secureM2aAddress('https://precodereferencia.m2atecnologia.com.br/autenticacao/login/')).toBe(true);
    expect(secureM2aAddress('http://precodereferencia.m2atecnologia.com.br/autenticacao/login/')).toBe(false);
    expect(secureM2aAddress('https://m2atecnologia.com.br.evil.test/')).toBe(false);
  });
  it('abre login oficial, seleciona Fornecedor e clica Acessar', async () => {
    const test = fakePage('https://precodereferencia.m2atecnologia.com.br/autenticacao/login/');
    const progress = vi.fn();
    await openM2aSupplierLogin(test.page, progress);
    expect(test.page.goto).toHaveBeenCalledTimes(2);
    expect(test.page.getByText).toHaveBeenCalledWith('Fornecedor', { exact: true });
    expect(test.supplier.click).toHaveBeenCalledTimes(1);
    expect(test.enter.click).toHaveBeenCalledTimes(1);
  });
  it('força HTTPS no endereço de login fornecido pelo site oficial', async () => {
    const test = fakePage('http://precodereferencia.m2atecnologia.com.br/autenticacao/login/');
    await openM2aSupplierLogin(test.page);
    expect(test.page.goto).toHaveBeenLastCalledWith(
      'https://precodereferencia.m2atecnologia.com.br/autenticacao/login/',
      expect.any(Object)
    );
  });
  it('recusa redirecionamento a HTTP antes de coletar credenciais', async () => {
    const test = fakePage('https://precodereferencia.m2atecnologia.com.br/autenticacao/login/', { insecureAfterAccess: true });
    await expect(openM2aSupplierLogin(test.page)).rejects.toThrow(M2aNavigationError);
    expect(test.enter.click).toHaveBeenCalledTimes(1);
  });
  it('informa falta de opção Fornecedor sem executar Acessar', async () => {
    const test = fakePage('https://precodereferencia.m2atecnologia.com.br/autenticacao/login/', { failSupplier: true });
    await expect(openM2aSupplierLogin(test.page)).rejects.toThrow('Fornecedor');
    expect(test.enter.click).not.toHaveBeenCalled();
  });
  it('bloqueia links de terceiros', async () => {
    const test = fakePage('https://fornecedor-evasivo.example/login');
    await expect(openM2aSupplierLogin(test.page)).rejects.toThrow('domínio não autorizado');
  });
});
