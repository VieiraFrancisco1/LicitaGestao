# Deploy do LicitaGestão no Render + Neon

Esta versão está preparada para produção em uma única URL: o backend Express serve a API em `/api` e também os arquivos compilados do frontend React.

## Render

- Runtime: Node
- Build Command: `npm ci && npm run db:generate && npm run build`
- Start Command: `npm run deploy:start`

Variáveis obrigatórias:

- `NODE_ENV=production`
- `FRONTEND_URL=https://SEU-SERVICO.onrender.com`
- `DATABASE_URL=...` (Neon)
- `JWT_SECRET=...` (mínimo 32 caracteres)
- `JWT_REFRESH_SECRET=...` (mínimo 32 caracteres)
- `ACCESS_TOKEN_EXPIRES_IN=15m`
- `REFRESH_TOKEN_EXPIRES_IN_DAYS=7`
- `STORAGE_PATH=./storage`
- `MAX_UPLOAD_MB=25`

O Render define `PORT` automaticamente.

## Banco

As migrations são aplicadas no início do serviço com `prisma migrate deploy`.
Para um banco novo, execute o seed uma única vez usando a `DATABASE_URL` do Neon.

## Arquivos enviados

O armazenamento local do Render é efêmero por padrão. Não use `./storage` para documentos importantes em produção sem um disco persistente ou integração externa (ex.: MEGA).
