# LicitaGestão V61.1 — Pesquisa pública com progresso e limites

## O que foi corrigido

- O agente deixou de processar PNCP e TCE-CE um depois do outro: as consultas são independentes e executadas simultaneamente.
- O PNCP passa a enviar `codigoModalidadeContratacao` e consultar concorrência eletrônica, pregão eletrônico e dispensa (códigos 4, 6 e 8), com limites explícitos.
- O servidor atualiza periodicamente a etapa em andamento, por exemplo "PNCP: 3 página(s)" ou "TCE-CE: pesquisando reforma".
- As consultas possuem limite de 70 segundos por fonte e 9 segundos por página. A busca pode ser **parcial** se uma fonte estiver fora do ar ou atingir o limite, com aviso legível. Não declarar uma fonte incompleta como concluída.
- Mantidos filtros de município, valor e categorias, exclusões de Fortaleza e Eusébio, Lista semanal e dados de acesso às plataformas.
- Inclusão de testes para parâmetros do PNCP, tolerância a falhas e cancelamento.

## Limitação importante

Esta é uma correção das **fontes públicas PNCP e TCE-CE**. O botão Agente de busca **ainda não entra automaticamente na BLL, M2A ou Licita Mais**, mesmo que as credenciais estejam salvas. A V61 disponibilizou somente o teste de login da M2A/Licita Mais; conectores de pesquisa autenticada ainda precisam ser desenvolvidos e testados.

Se uma busca mostrar "parcial", os resultados obtidos serão preservados, mas a pesquisa não é exaustiva. Caso o PNCP apresente erro de rede ou rejeite os parâmetros, use o endereço oficial como verificação complementar. Em caso de alterações de API, será necessário adaptar o conector.

## Instalação

Deixe `LicitaGestao-V61.1-busca-publica.zip` e `Aplicar-LicitaGestao-V61.1.ps1` em Downloads. Execute o instalador que cria backup, verifica a base V61, executa lint/typecheck/test/build e só envia ao GitHub se tudo passar.

Após o deploy de Render e Vercel, pressione Ctrl+F5, clique em Agente de busca e observe se o progresso passa de "Consultando fontes públicas" para "PNCP: ..."/"TCE-CE: ..." e "Classificando...".
