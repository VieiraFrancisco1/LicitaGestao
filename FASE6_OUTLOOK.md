# Fase 6 — Integração Outlook e Hotmail

Esta fase adiciona a Microsoft como segundo provedor de e-mail do LicitaGestão. A integração Gmail continua funcionando e uma mesma empresa pode manter Gmail e Outlook conectados ao mesmo tempo.

## Funcionalidades

- OAuth 2.0 server-side com Microsoft Graph e contas pessoais ou corporativas.
- Permissão delegada `Mail.Read`, sem envio, exclusão ou alteração de mensagens.
- Refresh token cifrado com AES-256-GCM.
- Sincronização automática configurável e botão de sincronização manual.
- Detecção e vinculação de possíveis convocações no mesmo fluxo já usado pelo Gmail.
- Identificação visual da origem da mensagem: Gmail ou Outlook.
- Isolamento de acesso por empresa preservado.

## Banco de dados

A migration `20260914000000_phase_6_outlook` é aditiva. Ela cria a tabela `outlook_integrations`, adiciona o provedor às mensagens e marca automaticamente todas as mensagens existentes como `GMAIL`. Nenhuma integração, mensagem, empresa, licitação ou documento existente é removido.

## Variáveis do Render

```env
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=https://licitagestao-3npf.onrender.com/api/integrations/outlook/callback
MICROSOFT_OAUTH_STATE_SECRET=
MICROSOFT_TOKEN_ENCRYPTION_KEY=
OUTLOOK_POLL_INTERVAL_MS=120000
```

Nunca envie o Client Secret ou as chaves de criptografia ao GitHub.

## Validação e publicação

Não execute seed e não precisa conectar um banco local. Execute na raiz do projeto:

```powershell
npm install
npm run db:generate
npm run typecheck
npm run lint
npm run test
npm run build
```

Depois dos testes:

```powershell
git status --short
git add backend/.env.example backend/prisma/schema.prisma backend/prisma/migrations/20260914000000_phase_6_outlook/migration.sql backend/src/config/env.ts backend/src/controllers/outlook.controller.ts backend/src/routes/index.ts backend/src/routes/outlook.routes.ts backend/src/server.ts backend/src/services/gmail-utils.ts backend/src/services/gmail.service.ts backend/src/services/outlook.service.ts backend/src/validators/outlook.validator.ts frontend/src/components/CompanyConvocationsPanel.tsx frontend/src/components/DeadlineNotifications.tsx frontend/src/components/OutlookIntegrationPanel.tsx frontend/src/layouts/AppLayout.tsx frontend/src/pages/CompanyDetailsPage.tsx frontend/src/pages/ConvocationsPage.tsx frontend/src/pages/DashboardPage.tsx frontend/src/types/index.ts FASE6_OUTLOOK.md
git commit -m "feat: integrar Outlook e Hotmail"
git push origin main
```

O Render executará `prisma migrate deploy` contra o Neon durante a publicação.

## Teste funcional

1. Aguarde o Render ficar `Live`.
2. Entre em `Empresas > empresa desejada > Integrações`.
3. Clique em `Conectar Outlook / Hotmail`.
4. Entre diretamente na Microsoft com a conta da empresa e aceite a permissão de leitura.
5. Envie um novo e-mail de teste para a conta conectada.
6. Clique em `Sincronizar agora` ou aguarde dois minutos.
7. Confira a aba `Convocações` e o sino de notificações.
