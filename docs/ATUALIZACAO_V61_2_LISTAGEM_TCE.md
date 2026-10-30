# LicitaGestão V61.2 — listagem geral do TCE-CE e diagnóstico de filtros

## O que foi corrigido
- O TCE-CE passa a consultar **primeiro as páginas iniciais da listagem pública de licitações abertas sem termos**, pois a busca por objeto pode não retornar certames publicados recentemente.
- As consultas por palavras-chave continuam como complemento, com paginação limitada e avisos quando houver corte; duplicações são removidas pelo identificador da fonte.
- O agente informa ao final o número de registros deduplicados coletados e quantos ficaram elegíveis após os filtros.
- Se nenhum resultado passar nos filtros, um aviso informa se houve registros coletados, evitando interpretar "zero resultados" como prova de inexistência de obras.
- Mantidas as exclusões apenas de **Fortaleza e Eusébio** e as regras de valor, categorias e intervalo de sessão.

## Limitações
A listagem e a pesquisa por termos continuam sujeitas à disponibilidade e paginação do TCE-CE; os avisos de consulta parcial são importantes. O PNCP pode expirar ao consultar dispensa; a V61.2 não elimina as indisponibilidades do PNCP. Esta atualização não ativa buscas autenticadas dentro de BLL/M2A/Licita Mais: o Playwright atual testa acesso apenas onde implementado.

## Instalação
Base exigida: commit `9fa06068f991f7622ac582d66b12df7268ebdb4c` (V61.1). O instalador verifica integridade da base, exige projeto limpo, faz backup, testa lint/typecheck/test/build e só então cria commit e envia ao GitHub.

## Como conferir
1. Aplique o ZIP e confirme o deploy do Render e Vercel.
2. Busque obras no Ceará com sessão de 30/10/2026 a 15/11/2026 e valor acima de R$ 1.000.000.
3. Veja se a lista geral do TCE retorna obras elegíveis, por exemplo editais da semana de 13/11; confira a data no próprio portal antes de participar.
4. Se aparecer zero, observe o novo aviso com número de registros coletados: é possível que as fontes estejam incompletas ou as regras sejam muito restritivas.
5. Não envie credenciais ou chaves por mensagens.
