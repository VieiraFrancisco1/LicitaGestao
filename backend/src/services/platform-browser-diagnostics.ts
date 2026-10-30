/**
 * Diagnóstico seguro para falhas no navegador das plataformas.
 * NUNCA repasse mensagens brutas do Playwright: elas podem conter URLs com dados privados.
 */
export function browserFailureHint(stage: string, error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : '';
  if (/Executable doesn't exist|browserType\.launch.*not found/i.test(raw)) {
    return 'Chromium não foi encontrado no ambiente de execução. Confira PLAYWRIGHT_BROWSERS_PATH e o build do Render.';
  }
  if (/error while loading shared libraries|libnss3|libatk|libX11|libgbm|libasound/i.test(raw)) {
    return 'Chromium foi instalado, mas faltam bibliotecas do Linux necessárias para iniciá-lo no servidor.';
  }
  if (/Target page, context or browser has been closed|browser has disconnected|Browser closed|crash|ENOMEM|out of memory/i.test(raw)) {
    return 'O navegador foi encerrado durante a execução. Verifique a memória disponível no serviço do Render.';
  }
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|EAI_AGAIN/i.test(raw)) {
    return 'O endereço do portal não foi resolvido pelo DNS do servidor. Verifique a disponibilidade do domínio.';
  }
  if (/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ECONNRESET/i.test(raw)) {
    return 'O portal recusou ou encerrou a conexão com o servidor. Nenhuma nova tentativa de login foi realizada.';
  }
  if (/ERR_CERT_|CERT_HAS_EXPIRED|certificate verify failed/i.test(raw)) {
    return 'A conexão HTTPS do portal apresentou um problema de certificado. Não foi ignorada a validação de segurança.';
  }
  if (/Timeout|timed out|ETIMEDOUT|ERR_TIMED_OUT/i.test(raw)) {
    if (stage === 'abrir página de login') return 'A página de login não respondeu dentro de 20 segundos. O Chromium iniciou, mas o portal pode estar lento, indisponível ou bloqueando o acesso automatizado.';
    return `Tempo esgotado na etapa: ${stage}. A autenticação não foi confirmada.`;
  }
  return `Falha na etapa: ${stage}. O conector precisa ser revisado antes de tentar novamente.`;
}
