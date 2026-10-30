# LicitaGestão V62 — integração inicial do Agente de Busca às plataformas

## Implementado

- Quando o usuário pressiona **Agente de busca**, o backend consulta também o cofre de credenciais deste usuário, inicia um Chromium temporário via Playwright, tenta se autenticar em M2A Compras e Licita Mais, navega para os processos e extrai somente informações verificáveis.
- M2A: pesquisa na página real `/processos/index/?search=...`, após autenticação confirmada, por **obras**, **pavimentação** e **construção**.
- Licita Mais: após login confirmado, procura um link visível para licitações/processos/editais e lê linhas de processos da página, quando presentes.
- Para cada linha, só considera uma oportunidade quando constam explicitamente **município/CE, valor em reais, data da sessão e objeto classificado como obra**, com URL em domínio permitido. A plataforma precisa fornecer esses campos para que haja resultado. O agente não inventa dados.
- BLL: **não há autenticação implementada**; seu teclado virtual precisa de adaptação e teste real. Os resultados BLL vistos no painel podem continuar vindo do PNCP/TCE-CE.
- A pesquisa pública continua funcionando mesmo que login, navegador ou tela de alguma plataforma falhe. O sistema apresenta avisos com a causa identificada.
- Login automático ocorre apenas em **buscas manuais**. Ciclos agendados continuam consultando somente fontes públicas. Nenhuma senha, cookie, sessão ou captura da tela é persistida.
- Se uma plataforma pedir CAPTCHA ou 2FA, o conector não tenta contornar essa verificação.

## Limites e validação necessários

**Os seletores de autenticação e da área interna não foram testados com as contas reais.** Os portais mudam seus formulários e a confirmação do login pode falhar se o controle "Sair" estiver oculto. Não considere uma conexão funcional até executar a busca e obter registros genuínos ou um diagnóstico de acesso. A visualização ao vivo do navegador permanece pendente. Nenhuma proposta ou lance é enviado.

No Render, o Chromium precisa estar disponível na instância do backend, por exemplo, configurando `PLAYWRIGHT_BROWSERS_PATH=0` e incluindo `npx playwright install chromium` durante o build, após `npm ci`. Dependências nativas e memória também podem ser necessárias. **Nunca compartilhe as credenciais ou a chave de criptografia.**

## Como conferir

1. Instale V62 com o PowerShell e aguarde o deploy do Render e Vercel.
2. Em **Agente de Monitoramento → Plataformas**, confirme que as credenciais de M2A e Licita Mais estão cadastradas.
3. Clique em **Agente de busca**. Abra **Acompanhar agente → Ver detalhes**.
4. A seção de relatórios passa a exibir o nome de cada plataforma visitada e a quantidade de registros interpretados, ou uma explicação de erro.
5. Envie apenas o texto dos avisos de M2A e Licita Mais, sem dados de login, para calibração dos seletores reais.

Não é necessário alterar o schema Prisma, migrar banco ou recadastrar contas nesta versão.
