# Arquitetura do LicitaGestão

## Visão geral

O projeto é um monorepo com duas aplicações independentes:

- `frontend`: aplicação React usada nos navegadores da rede local;
- `backend`: API Express responsável pelas regras, autenticação, documentos e acesso ao PostgreSQL.

O navegador nunca acessa o PostgreSQL ou o diretório de documentos diretamente. Todo acesso passa pela API, que aplica validação e permissão por perfil e empresa.

## Estrutura

```text
licitagestao/
├── frontend/src/
│   ├── components/
│   ├── contexts/
│   ├── layouts/
│   ├── pages/
│   ├── services/
│   ├── types/
│   └── utils/
├── backend/
│   ├── prisma/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── integrations/   # fases futuras
│       ├── jobs/           # fases futuras
│       ├── middlewares/
│       ├── repositories/   # quando as consultas crescerem
│       ├── routes/
│       ├── services/
│       ├── utils/
│       └── validators/
├── docs/
└── storage/                # documentos locais; fora do Git
```

Controllers tratam HTTP, services concentram regras, middlewares protegem as rotas e validators rejeitam entradas inválidas. Repositórios separados serão introduzidos quando as consultas crescerem; criar essa camada vazia agora apenas aumentaria arquivos sem utilidade.

## Tabelas implementadas

### Company

Representa cada empresa cliente. O CNPJ é normalizado para 14 dígitos e possui restrição única.

### User

Representa quem entra no sistema. Possui um dos perfis `ADMIN`, `FUNCIONARIO` ou `EMPRESA`. Um usuário `EMPRESA` precisa estar diretamente vinculado a uma Company.

### CompanyUser

Relação muitos-para-muitos entre funcionário e empresa. Um funcionário pode cuidar de várias empresas e uma empresa pode possuir vários funcionários responsáveis. Esse vínculo controla a área da empresa e as permissões de escrita.

### Platform

Cadastro dos portais usados nas disputas. Uma plataforma pode estar ligada a várias licitações gerais.

### Tender

Registro geral e compartilhado. O cadastro operacional usa data, município, objeto, valor global, validade da carta-proposta, garantia de 1% e plataforma. Também guarda o indicador de planilha pronta e a lista `PENDENTE` ou `ANEXADA`. Todos os perfis autenticados podem consultá-lo.

### Bid

Participação de uma Company em uma Tender. A combinação `tenderId + companyId` é única. Guarda somente dados internos da empresa: valor da proposta, andamento, situação e observações. Uma Tender pode possuir várias participações sem duplicar o edital.

### Document

Metadados de arquivos anexados a uma licitação. O arquivo real fica no disco do servidor; o banco guarda nome, MIME, tamanho, categoria, caminho e usuário que enviou.

### DiscountCalculation

Uma linha de baixa por empresa e licitação. Guarda o valor final com desconto; a API calcula a porcentagem com precisão decimal sobre o valor global da Tender. A combinação `companyId + tenderId` é única.

### RefreshToken

Mantém sessões renováveis. O banco armazena apenas SHA-256 do token, nunca o token original. Os tokens são rotacionados e podem ser revogados no logout.

```text
Company 1 ─── 0..N User 1 ─── 0..N RefreshToken
Company N ─── N User(FUNCIONARIO) por CompanyUser
Platform 1 ─── 0..N Tender
Tender 1 ─── 0..N Bid N ─── 1 Company
Bid 1 ─── 0..N Document
Company 1 ─── 0..N DiscountCalculation N ─── 1 Tender
```

## Modelo planejado para as próximas fases

- `Deadline`: prazos adicionais e validade de proposta;
- `EmailIntegration`: autorização OAuth do Gmail por empresa;
- `EmailMessage`: mensagens sincronizadas, sem duplicação pelo ID do Gmail;
- `Convocation`: convocação classificada e opcionalmente ligada a uma licitação;
- `Notification`: alertas internos por usuário e empresa;
- `AuditLog`: histórico sem senhas, tokens ou segredos.

Os identificadores são UUID. Valores financeiros usam `Decimal`, a sessão possui data e horário próprios e os principais campos de filtro possuem índices para permitir isolamento e importação futura da planilha.

## Decisões importantes

1. Documentos são salvos no disco; o PostgreSQL guarda somente metadados e caminhos seguros.
2. A planilha será importada somente depois do modelo de licitações ser concluído e validado.
3. O perfil EMPRESA é isolado no backend por `companyId`; esconder menus no frontend não é considerado segurança.
4. Funcionários usam `CompanyUser` para administrar várias empresas com um único login. O seletor da interface só muda o foco; a API sempre confirma o vínculo.
5. O controle central consulta `Tender`; a aba da empresa consulta `Bid` ligado à mesma Tender. Assim os dados gerais não são duplicados e cada empresa mantém proposta e documentos privados.
6. Na rede real, o servidor deve ter IP reservado e backup diário do banco e do diretório de documentos.
