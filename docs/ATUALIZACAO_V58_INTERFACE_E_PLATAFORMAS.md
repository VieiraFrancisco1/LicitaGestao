# LicitaGestão V58 — interface simplificada do Agente de Monitoramento

Atualização incremental sobre os arquivos da V56 **ou** V57. Não restaura os módulos da V55 (MEGA).

## Alterações
- Retira totalmente o banner azul, título publicitário, localizador e nota visível de exclusão de municípios.
- Mantém o bloqueio interno de Fortaleza e Eusébio, sem apresentá-lo na interface.
- Deixa somente valor mínimo, período e Agente de busca na área inicial.
- Reúne Filtros de obras, Mais opções e Plataformas em três botões expansíveis, somente um aberto por vez.
- O botão Plataformas abre o cadastro de acesso por BLL Compras, M2A Compras e Licita Mais. A inscrição de credenciais **não** ativa o login automatizado.
- Cards das oportunidades têm nomes reais de plataforma fornecidos pela fonte. Grupos de plataformas não reconhecidas são exibidos individualmente por nome; ausência de nome é exibida como Plataforma não identificada.
- Mostra Fase inversa somente para M2A. A análise anterior baseada em PDF foi desabilitada porque a exigência é confirmar a informação **na tela inicial da M2A**. Até o conector M2A ser implementado e testado, o campo mostrará "Aguardando consulta à M2A". Não há automação Playwright conectada nesta versão.
- O link no detalhe da oportunidade utiliza o nome da plataforma (quando identificado), não o rótulo genérico "Plataforma".
- Arquivos continuam como links oficiais, sem download automático ou armazenagem.

## Operação
- Sem mudanças de banco, Prisma ou variáveis de ambiente em relação à V56.
- A busca atual continua usando PNCP e TCE-CE.
- O instalador interrompe antes de alterar arquivos se o repositório local tiver alterações ou se arquivos-base não coincidirem com V56/V57.
- O instalador executa `npm run lint`, `npm run typecheck`, `npm run test` (backend) e `npm run build` nas workspaces relevantes, cria backup e só depois faz commit/push.
- Se o push falhar após o commit, não execute o instalador novamente; revise o erro e rode `git push origin main`.
