# LicitaGestão — Dashboard + Baixa + Carta Proposta

Atualização aditiva sobre a versão que já contém a Fase 5, links SEOBRA/plataforma, prazos e associação de convocações.

## O que foi alterado

### Dashboard operacional
- Substitui os cards de apresentação por dados reais.
- Mostra participações em andamento, próximas sessões, convocações pendentes e prazos críticos.
- Bloco "Precisa da sua atenção".
- Próximas licitações e convocações recentes.
- Resumo por situação.
- Visão individual por empresa no próprio dashboard.
- ADMIN pode alternar entre todas as empresas e uma empresa específica.
- FUNCIONARIO respeita somente empresas às quais está vinculado.
- EMPRESA vê somente a própria empresa.

### Prazo de validade
- O prazo de validade continua no sino e na página Prazos.
- A notificação de desktop exibida no login deixa de disparar para `PROPOSAL_EXPIRATION` em todos os perfis, não apenas ADMIN.
- Sessões urgentes e convocações continuam gerando notificação de desktop.

### Participação / licitação da empresa
- Nova aba `Baixa` dentro da própria participação.
- O valor final pode ser salvo/atualizado sem sair da licitação.
- Nova ação `Desassociar` no cabeçalho.
- Desassociar não exclui a licitação geral; remove a participação da empresa e a baixa vinculada.

### Carta Proposta
- Nova aba `Carta Proposta` dentro da participação.
- Modelo salvo por município e reaproveitado nas próximas licitações daquela cidade.
- O valor global da carta vem obrigatoriamente da `Baixa` já salva para empresa + licitação.
- Usa automaticamente número da licitação, processo, objeto, empresa, CNPJ, representante, validade e prazo de execução.
- Gera PDF sem dependência npm adicional.
- Se faltar número da licitação, prazo de execução ou valor da baixa, o sistema bloqueia o PDF e informa o que falta.
- Novo campo `Prazo de execução` no cadastro da licitação.

## Migration

Nova migration:

`20260911000000_dashboard_proposal_letter`

Ela apenas:
- adiciona `execution_term` à tabela `tenders`;
- cria a tabela `proposal_letter_templates`.

Não remove dados existentes.

Após esta atualização o Render deve encontrar **11 migrations**.

## Antes do push

Na raiz do projeto:

```powershell
npm install
npm run db:generate
npm run typecheck
npm run lint
npm run test
npm run build
```

Não execute `npm run db:seed`.

Depois:

```powershell
git status
git add .
git commit -m "Adiciona dashboard operacional e carta proposta"
git push
```

No Render, confira a aplicação da migration `20260911000000_dashboard_proposal_letter`.
