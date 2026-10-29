# LicitaGestão V61 — teste seguro de login (primeira etapa)

## O que muda

- A seção **Plataformas** oferece **Testar acesso** para M2A Compras e Licita Mais. Utiliza as credenciais criptografadas já salvas.
- Cada teste abre um navegador isolado, tenta um único login e fecha imediatamente o navegador.
- Só considera **Acesso confirmado** quando é encontrado um controle inequívoco de saída da conta (Sair/Logout); se não encontrar, mostra teste pendente, mesmo que o formulário seja submetido.
- Não guarda cookies, screenshots, traces, senhas ou estado do navegador e não envia credenciais de volta para o frontend.
- Intervalo mínimo de 90 segundos entre testes da mesma conta/plataforma, para evitar bloqueio.
- BLL permanece pendente por exigir teclado virtual no login.

## Atenção: limitações

Isto é **diagnóstico de autenticação**, não a integração de busca pós-login. **Agente de busca** ainda consulta PNCP e TCE-CE; o status de teste não ativa buscas privadas, nem a tela Acompanhar agente transmite vídeo real. Precisaremos ajustar seletores após observar os portais e confirmar autorização para automação, antes de ativar buscas autenticadas.

## Infraestrutura Render

A biblioteca Playwright será adicionada pelo instalador ao backend (e atualiza package-lock.json). Chromium precisa ser instalado no ambiente de execução da API. A instalação local do Node não instala automaticamente o Chromium no Render.

Configuração sugerida no serviço Render (sem expor chave de senha):
- Environment: `PLAYWRIGHT_BROWSERS_PATH=0`, mantendo `PLATFORM_CREDENTIAL_ENCRYPTION_KEY` já existente sem alterações.
- Build Command: inclua `npx playwright install chromium` **depois** de `npm ci` e **antes** do build normal do backend (ajuste ao comando existente, preserve Prisma generate).
- Pode ser necessário oferecer dependências de sistema, memória suficiente e infraestrutura própria para um browser headless. Se faltar, **Testar acesso** retornará `Chromium não está disponível no servidor` ou requer revisão; não significa credenciais incorretas.

## Segurança

Não envie senhas por mensagens. O navegador não entra em leilões, não oferece lances nem envia propostas. Se o portal solicitar CAPTCHA/2FA, a conexão não será considerada verificada e não haverá tentativa de contorno.

## Próximo passo

Faça deploy após o teste do instalador. Clique em Plataformas > M2A Compras > Testar acesso. Envie **somente a mensagem textual** de resultado (sem senhas). Com base na tela real, adaptaremos os seletores e integraremos o resultado ao ciclo de buscas.
