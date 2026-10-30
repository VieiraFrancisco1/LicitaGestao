# LicitaGestão V62.2 — fluxo Fornecedor da M2A

- **Testar acesso** e **Agente de busca** passam pelo site oficial da M2A, abrem **Fazer login**, selecionam **Fornecedor** e clicam **Acessar**, antes de procurar campos de login.
- O agente não envia credenciais a páginas HTTP ou a domínios não reconhecidos.
- Caso a página do fornecedor seja disponibilizada apenas por `http://` (como no print fornecido), a operação será interrompida com explicação de segurança. A preferência é solicitar ao fornecedor do portal uma URL HTTPS válida.
- As credenciais salvas não são alteradas. Nenhuma sessão fica aberta e nenhuma proposta/lance é enviada.
- Os seletores da página são baseados no print do usuário; **precisam ser validados no ambiente real** e dependem das telas atualizadas do serviço.
- A M2A restringe coleta automatizada sem permissão expressa em seu regulamento (cláusulas 7.3.1.1 e 8.7). Obtenha autorização formal antes de habilitar pesquisa automatizada contra a plataforma.
- Não desative verificações TLS ou CAPTCHA para contornar falhas de acesso.
