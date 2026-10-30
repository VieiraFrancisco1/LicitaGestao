import { describe, expect, it } from 'vitest';
import { browserFailureHint } from '../src/services/platform-browser-diagnostics.js';

describe('diagnóstico de acesso às plataformas', () => {
  it('distingue timeout do portal de ausência de Chromium', () => {
    const result = browserFailureHint('abrir página de login', new Error('page.goto: Timeout 20000ms exceeded'));
    expect(result).toContain('página de login');
    expect(result).toContain('Chromium iniciou');
  });
  it('identifica falha de dependências Linux', () => {
    expect(browserFailureHint('iniciar Chromium', new Error('error while loading shared libraries: libnss3.so'))).toContain('bibliotecas do Linux');
  });
  it('não expõe URLs ou credenciais em mensagens de erro', () => {
    const result = browserFailureHint('enviar login', new Error('Failed at https://portal.exemplo.com/?password=SEGREDO'));
    expect(result).not.toContain('SEGREDO');
    expect(result).not.toContain('portal.exemplo.com');
  });
  it('distingue DNS e navegador encerrado', () => {
    expect(browserFailureHint('abrir página de login', new Error('net::ERR_NAME_NOT_RESOLVED'))).toContain('DNS');
    expect(browserFailureHint('verificar sessão', new Error('Target page, context or browser has been closed'))).toContain('encerrado');
  });
});
