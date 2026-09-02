# Fase 5 — Integração Gmail e alertas de possível convocação

Esta fase adiciona integração por empresa com Google OAuth 2.0 + Gmail API, preservando a arquitetura, o isolamento por empresa e os dados existentes do LicitaGestão.

## O que foi implementado

- Uma integração Gmail independente por empresa (`EmailIntegration`).
- Mensagens sincronizadas por empresa (`EmailMessage`) com bloqueio de duplicidade por `companyId + gmailMessageId`.
- OAuth 2.0 server-side: a senha do Gmail nunca é solicitada nem armazenada.
- Refresh token cifrado com AES-256-GCM antes de ser persistido.
- Tokens do Google nunca são retornados ao frontend.
- Aba **Integrações** na página da empresa.
- Polling do Gmail configurável entre 60 e 120 segundos (padrão: 90 s).
- Sincronização incremental: a conexão começa a acompanhar mensagens recebidas depois da autorização, sem importar automaticamente toda a caixa antiga.
- Falhas temporárias do Google são isoladas e não derrubam o servidor.
- Permissões preservadas: ADMIN vê todas as empresas; FUNCIONÁRIO apenas empresas vinculadas; EMPRESA apenas a própria empresa.
- Detecção determinística de **possível convocação** por termos explícitos e combinações de contexto/ação licitatória. Não usa IA e não usa Ollama.
- Alertas no sino, tela **Convocações** e, quando o navegador permite, notificação desktop.

> A detecção é um alerta operacional, não uma decisão automática. O e-mail deve ser conferido por uma pessoa antes de qualquer providência.

## Banco de dados

A migration `20260908000000_phase_5_gmail` é aditiva. Ela cria somente as tabelas/enum/índices necessários e não executa seed, não remove registros existentes e não altera empresas, usuários, licitações ou documentos atuais.

## Variáveis de ambiente

No Render/servidor, configure:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://licitagestao-3npf.onrender.com/api/integrations/gmail/callback
GOOGLE_OAUTH_STATE_SECRET=
GOOGLE_TOKEN_ENCRYPTION_KEY=
GMAIL_POLL_INTERVAL_MS=90000
```

Gere `GOOGLE_OAUTH_STATE_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Gere `GOOGLE_TOKEN_ENCRYPTION_KEY`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Guarde `GOOGLE_TOKEN_ENCRYPTION_KEY` permanentemente.** Se a chave for alterada depois que contas já estiverem conectadas, os refresh tokens já armazenados não poderão ser descriptografados e as empresas terão de reconectar o Gmail.

## Google Cloud

1. Crie ou selecione um projeto no Google Cloud.
2. Ative a **Gmail API**.
3. Configure o **Google Auth Platform / OAuth consent screen**.
4. Para testes, use audiência externa em modo **Testing** e cadastre as contas Gmail que poderão autorizar o app como test users.
5. Em **Data Access / Scopes**, adicione somente:
   `https://www.googleapis.com/auth/gmail.readonly`
6. Crie um OAuth Client do tipo **Web application**.
7. Em **Authorized redirect URIs**, adicione exatamente:
   `https://licitagestao-3npf.onrender.com/api/integrations/gmail/callback`
8. Copie o Client ID e Client Secret para as variáveis protegidas do Render.

## Publicação

Não execute seed.

Depois de aplicar o patch no projeto atual:

```powershell
npm run db:generate
npm run typecheck
npm run lint
npm run test
npm run build
```

Se tudo passar:

```powershell
git add .
git commit -m "Fase 5 integração Gmail e convocações"
git push
```

O Render já executa `prisma migrate deploy` no `deploy:start`, portanto a migration será aplicada automaticamente no Neon durante o deploy.

## Como testar

1. Aguarde o Render ficar **Live**.
2. Entre no LicitaGestão e abra **Empresas > [empresa] > Integrações**.
3. Clique em **Conectar conta Google** e autorize a conta Gmail daquela empresa.
4. Confirme se a tela mostra o e-mail conectado.
5. Envie para essa conta um novo e-mail de teste, por exemplo:
   - Assunto: `Convocação - Pregão teste 001/2026`
   - Corpo: `A empresa fica convocada para apresentar proposta readequada.`
6. Clique em **Sincronizar agora** ou aguarde até 90 segundos.
7. Confira **Convocações**, o sino de notificações e a aba **Convocações** da empresa.
8. Para testar isolamento, entre com usuários de perfis diferentes e confirme que cada um só visualiza empresas permitidas.

## Observações de produção

O escopo `gmail.readonly` é classificado pelo Google como restrito. Para uso público/produção fora de um conjunto controlado de test users, poderão ser necessárias verificação OAuth e, quando dados de escopo restrito são armazenados/transmitidos pelo servidor, avaliação adicional de segurança do Google.

No plano gratuito do Render o serviço pode dormir quando fica inativo. Enquanto a instância estiver suspensa, o polling de 90 segundos também fica suspenso. Para monitoramento de Gmail realmente 24/7, use uma instância sempre ativa ou evolua depois para um mecanismo de push/worker dedicado.
