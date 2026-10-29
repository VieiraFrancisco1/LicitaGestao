# LicitaGestão V60.1 — Lista semanal (instalador corrigido) de licitações

## Novidades

- No Agente de Monitoramento, cada oportunidade apresenta **Enviar para lista** sem exigir abertura dos detalhes.
- Em **Licitações**, o botão **Lista semanal** abre uma página dedicada com cidade, objeto, valor, data, plataforma e links oficiais.
- A lista é compartilhada apenas entre os usuários internos da organização; outros clientes/organizações não podem acessar seus itens.
- Não é possível cadastrar a mesma oportunidade duas vezes na mesma organização.
- **Adicionar em Licitações** chama o mesmo preenchimento do Controle Geral da V59, incluindo leitura sob demanda do edital quando estiver acessível e a IA estiver configurada. O cadastro não é concluído sem conferência do usuário.
- Se a licitação já foi importada, a ação muda para **Abrir em Licitações**.
- **Excluir da lista** remove somente aquele item da lista semanal.
- **Limpar lista inteira** requer confirmação e remove somente as seleções semanais; não apaga o Controle Geral, contas, documentos ou resultados do agente.
- A lista permanece até a remoção manual, sem expiração automática na virada da semana.

## Banco de dados

Uma nova tabela `weekly_tender_items` armazena somente organização, oportunidade e data de inclusão. Migração Prisma: `20261029150000_weekly_tender_list`.

**Atenção:** o backend deve executar a migração por `npm run db:deploy` em produção antes de atender à nova rota `/api/weekly-list`. O instalador não executa migração diretamente no banco de produção; gera o Prisma Client e valida código. Render deve iniciar com o comando de deploy já usado pelo LicitaGestão.

## Instalação

Coloque `LicitaGestao-V60-lista-semanal.zip` e `Aplicar-LicitaGestao-V60.ps1` na pasta Downloads, com a versão V59 (etapa 1) instalada e projeto Git limpo. No PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\Aplicar-LicitaGestao-V60.ps1" -Projeto "$env:USERPROFILE\Documents\LicitaGestao"
```

O instalador compara as versões dos arquivos existentes, cria backup, altera apenas arquivos necessários, executa Prisma Generate, lint, typecheck, testes e build. Só tenta commit e push se tudo passar.

## O que permanece igual

Não modifica credenciais criptografadas das plataformas, busca PNCP/TCE, Playwright, análise de fase da M2A nem dados das licitações já salvas. Os conectores Playwright continuam pendentes de implementação e testes reais.

## Correção V60.1

- Evita alterar a consulta de rascunho do Controle Geral (dois testes afetados na V60).
- Corrige recuperação do instalador: não invoca `git restore` para arquivos ainda não rastreados.
- O item da lista semanal permanece visível mesmo se a oportunidade for encerrada; nesse caso o cadastro é bloqueado até nova conferência da fonte, evitando usar dados antigos.
- Requer V59 e não modifica o cofre de credenciais.
