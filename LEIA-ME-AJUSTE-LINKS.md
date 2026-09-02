# Ajuste — links da licitação

Este patch é aditivo e foi preparado sobre a Fase 5 do LicitaGestão.

## O que muda

- Reaproveita o campo existente `platformLink` como link manual direto da licitação na plataforma.
- Adiciona o campo opcional `seobraLink` à licitação.
- Adiciona os dois campos ao cadastro/edição da licitação.
- Exibe botões "Abrir no SEOBRA" e "Abrir na plataforma" na tela de detalhes.
- Ambos os links abrem em uma nova aba.
- Aceita apenas links HTTP/HTTPS e os campos podem ficar vazios.
- A migration somente adiciona uma coluna opcional; nenhum registro existente é apagado ou alterado.

## Depois de copiar o patch

Não execute seed.

Execute:

```powershell
npm run db:generate
npm run typecheck
npm run lint
npm run build
```

Se tudo passar:

```powershell
git add .
git commit -m "Adiciona links SEOBRA e plataforma nas licitacoes"
git push
```

O Render executará `prisma migrate deploy` e aplicará automaticamente a migration nova no Neon.
