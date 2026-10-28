# LicitaGestão V53 — Obras em geral e plataforma da disputa

## O que mudou

- A **API pública do PNCP** já era consultada na V52; o TCE-CE era consultado pela **página pública de licitações abertas**, e não pela API SIM. Nenhuma chave é necessária para essas duas consultas. O TCE pode restringir acessos por região ou mudar o layout.
- O filtro inicial agora é **Todas as obras**, abrangendo construção, reforma, pavimentação, calçamento, drenagem, saneamento, pontes e infraestrutura. Desmarca-se “Todas as obras” para restringir às outras categorias.
- Para cada licitação do PNCP, o campo público `linkSistemaOrigem` é usado para informar a **plataforma de disputa** com link HTTPS. Quando não houver essa informação (por exemplo, na lista do TCE-CE), aparece **Plataforma não informada**. A fonte PNCP/TCE-CE permanece apresentada separadamente.
- A lista de palavras-chave consultadas no portal do TCE foi ampliada, mas a consulta pode ser parcial por limites de tempo e paginação. O PNCP é consultado primeiro.
- Na importação, o campo de link da plataforma dá preferência ao link publicado; caso não exista, mantém o link oficial da fonte.
- Nenhuma alteração em tabelas, migration ou credenciais. Dados das empresas, licitações e documentos não são removidos.

## Configuração da IA

Para ativar a **revisão de relevância por IA dos primeiros 20 resultados**, no Render > serviço BACKEND > Environment, adicionar:

`TENDER_AI_API_KEY` = chave secreta da conta OpenAI API
`TENDER_AI_MODEL` = `gpt-6-luna` (opcional; este já é o padrão após a V53)

**Não** colocar chave no frontend, no ZIP, no GitHub ou neste chat. A API de IA é cobrada separadamente do ChatGPT. Sem chave, a busca continua funcionando normalmente. Esta integração classifica o objeto publicado, **não faz leitura integral de PDF/edital**; a análise profunda de documentos será uma etapa posterior.

## Publicar

Salve o ZIP e o script PS1 na pasta Downloads, ao lado um do outro. Rode:

`& "$env:USERPROFILE\Downloads\Aplicar-LicitaGestao-V53.ps1" -Projeto "$env:USERPROFILE\Documents\LicitaGestao"`

O script verifica se o diretório é um repositório Git limpo, faz backup dos arquivos alterados, aplica o pacote, valida git diff, tenta `npm run quality` (não publica se falhar), commita e faz push. O deploy no Render/Vercel depende do seu pipeline GitHub.
