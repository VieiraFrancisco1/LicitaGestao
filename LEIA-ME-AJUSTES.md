# LicitaGestão — ajuste consolidado

Este patch parte da versão atual com Fase 5 (Gmail), MEGA, links SEOBRA/plataforma e prazos na participação.

## Incluído

- cabeçalho da participação mais compacto e proporcional;
- campos opcionais na licitação: Modalidade, Número da licitação e Processo administrativo;
- exibição desses identificadores na lista geral, na área da empresa e nos detalhes;
- vínculo automático de possíveis convocações do Gmail com a participação correta, sem IA;
- prioridade de correspondência: processo administrativo, número da licitação e fallback seguro por cidade + plataforma;
- empate/ambiguidade não é vinculado automaticamente;
- convocações antigas ainda sem vínculo são reavaliadas após o deploy;
- ao editar identificadores ou associar uma empresa à licitação, convocações são reavaliadas;
- aba Convocações da participação passa a mostrar somente as mensagens vinculadas àquela licitação;
- convocações sem vínculo permanecem na área da empresa e podem ser vinculadas manualmente;
- sino/pop-up abre diretamente a participação quando a convocação já estiver vinculada;
- auditoria registra vinculação/desvinculação manual.

## Banco

Migration aditiva: `20260910000000_tender_identifiers_convocation_linking`.

Ela adiciona `modality` em `tenders` e campos opcionais de associação em `email_messages`. Não remove dados e não executa seed.

## Depois de copiar o patch

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

Se tudo passar:

```powershell
git add .
git commit -m "Melhora identificacao e vinculo de convocacoes"
git push
```

No Render, use **Deploy latest commit** se o deploy automático não começar.

No log do Render, a quantidade esperada passa de 9 para **10 migrations**.
