# LicitaGestão

Sistema web local para organizar empresas e substituir a planilha de controle de licitações. Esta entrega corresponde à **Fase 3**, mantendo o controle geral da Fase 2 e acrescentando prazos automáticos, notificações internas e auditoria das alterações importantes.

## Tecnologias

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router e Axios.
- Backend: Node.js, TypeScript, Express, Zod, JWT, bcrypt, Helmet, rate limiting e Multer.
- Banco: PostgreSQL com Prisma ORM.
- Qualidade: ESLint, Prettier e Vitest.

## Pré-requisitos

- Node.js 20 ou superior;
- PostgreSQL 15 ou superior;
- npm 10 ou superior;

## Instalação no Windows

Abra o PowerShell dentro da pasta do projeto:

```powershell
npm install
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Crie no PostgreSQL um banco vazio chamado `licitagestao`. Isso pode ser feito pelo pgAdmin ou pelo terminal:

```powershell
createdb -U postgres licitagestao
```

Abra `backend/.env` e informe a senha verdadeira do PostgreSQL em `DATABASE_URL`. Troque também `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Gere chaves longas; não reutilize a senha do banco.

Depois execute:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

O seed cria ou atualiza o primeiro administrador usando as variáveis `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` e também garante as plataformas padrão.

### Atualização da Fase 1 para a Fase 2

Mantenha os arquivos `backend/.env` e `frontend/.env` que já funcionam. Adicione ao `backend/.env`, se ainda não existirem:

```env
STORAGE_PATH=./storage
MAX_UPLOAD_MB=25
```

Em seguida execute:

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

A migration acrescenta as novas tabelas sem apagar as empresas e os usuários existentes. Não é necessário executar o seed novamente, a menos que deseje recriar ou atualizar o administrador configurado no `.env`.

### Atualização para controle geral + plataformas padrão

Mantenha seus arquivos `backend/.env` e `frontend/.env`. Substitua os demais arquivos pela atualização e execute, dentro da pasta `licitagestao`:

```powershell
npm install
npm run db:generate
npm run db:migrate
```

A migration preserva as licitações já cadastradas e adiciona plataformas padrão para o campo **Plataforma** do cadastro de licitações. As opções iniciais são BLL Compras, BNC Compras, Compras.gov.br, Licitanet, Portal de Compras Públicas e BBMNET Licitações. Outras plataformas podem ser cadastradas pelo menu **Plataformas**.

O formulário permanece simplificado para os campos usados no trabalho diário: data, cidade, objeto, validade da carta-proposta, garantia de 1%, valor global e plataforma.

## Acesso

- Frontend no servidor: `http://localhost:5173`
- API: `http://localhost:3333/api`
- Saúde da API e banco: `http://localhost:3333/api/health`

Para acessar por outro computador da rede, descubra o IPv4 do servidor com `ipconfig`. Por exemplo, para o IP `192.168.0.10`:

1. no `frontend/.env`, use `VITE_API_URL=http://192.168.0.10:3333/api`;
2. no `backend/.env`, use `FRONTEND_URL=http://192.168.0.10:5173`;
3. reinicie as aplicações;
4. libere as portas TCP 5173 e 3333 no Firewall do Windows somente para rede privada;
5. acesse `http://192.168.0.10:5173` nos demais computadores.

O backend e o Vite já escutam em `0.0.0.0`. O PostgreSQL não precisa ser exposto aos computadores clientes.

## Perfis e permissões

- `ADMIN`: vê todas as empresas, todas as participações e pode gerenciar usuários, plataformas e licitações;
- `FUNCIONARIO`: pode ser vinculado a várias empresas, alternar a empresa ativa com um clique e alterar somente as participações das empresas atribuídas;
- `EMPRESA`: visualiza o controle geral, mas cria ou edita somente a participação e os documentos da própria empresa.

Todos os perfis veem o mesmo controle geral de editais. Uma licitação geral pode ser associada a várias empresas sem duplicar município, processo, objeto, sessão ou plataforma. Cada associação cria uma participação privada, onde ficam valor da proposta, andamento, situação, observações e documentos daquela empresa.

O login EMPRESA não recebe os nomes, valores, situações nem documentos das outras empresas. O funcionário recebe somente as participações das empresas atribuídas ao seu usuário. Essas restrições são aplicadas na API, não apenas na interface.

A API confere o perfil e o vínculo em todas as rotas protegidas. Usuários ou empresas desativados perdem acesso mesmo que ainda possuam um token não expirado.

## Segurança implementada

- senha com bcrypt e custo 12;
- access token curto e refresh token em cookie `HttpOnly`;
- rotação e revogação de refresh token;
- somente hash SHA-256 do refresh token no banco;
- limite de tentativas no login;
- Helmet, CORS configurável e JSON limitado a 1 MB;
- validação Zod, CNPJ válido e campos únicos no banco;
- respostas de erro padronizadas e sem stack trace para o usuário;
- isolamento de empresa aplicado no backend, inclusive contra alteração manual de URL, query ou body;
- upload com limite de tamanho, validação conjunta de extensão e MIME, nome aleatório e proteção contra path traversal;
- download autenticado; arquivos ficam em `storage/companies/{companyId}/bids/{bidId}` e não no PostgreSQL.

## Comandos de verificação

```powershell
npm run test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

## Estrutura e banco

A explicação das camadas, relacionamentos atuais, tabelas futuras e decisões está em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md). As migrations estão em `backend/prisma/migrations`.

## Funcionalidades da Fase 2 e Fase 3

- controle geral compartilhado com busca e paginação, acessível por todos os perfis;
- listas separadas de licitações **Pendentes** e **Já anexadas**;
- indicador compartilhado **Planilha pronta**, que pode ser marcado diretamente no controle geral;
- a licitação só pode ser movida para **Já anexadas** depois que todas as empresas associadas estiverem com situação `ANEXADA`;
- associação de uma mesma licitação a várias empresas sem duplicar o edital;
- participação privada por empresa com proposta, andamento, situação, observações e documentos;
- cadastro e edição em seções, com validade da proposta calculada;
- página detalhada da participação com documentos para upload e download;
- aba **Baixas** em cada empresa: seleciona uma licitação, informa o valor final com desconto e calcula automaticamente `(global - final) / global × 100`;
- cadastro administrativo de plataformas;
- página de cada empresa com Visão geral, Licitações, Documentos, Plataformas e Convocações;
- vários vínculos de empresa por funcionário e seletor rápido no cabeçalho;
- isolamento de leitura e escrita para o login EMPRESA e funcionários responsáveis.

## Funcionalidades da Fase 3

- alertas calculados automaticamente a partir da data da sessão e da validade da proposta;
- sino de notificações com contador de alertas não lidos e acesso direto à licitação;
- tela **Prazos** com vencidos, prazos de hoje, próximos 7 dias e próximos 30 dias;
- marcação individual ou em lote das notificações como lidas;
- auditoria administrativa de cadastros, edições, mudanças de situação, uploads e exclusões importantes;
- registro do usuário responsável, data/hora, tipo de registro e descrição da alteração;
- acesso à auditoria restrito ao perfil `ADMIN`.

## O que ainda falta

Documentos centralizados, convocações, integrações externas, tempo real e relatórios continuam reservados para fases posteriores.


### Notificações do computador
A Fase 3 pode exibir notificações nativas do navegador/Windows para prazos vencidos, do dia e urgentes (até 3 dias), após autorização do usuário.
