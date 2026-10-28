# LicitaGestão V57 — tela compacta do Agente de Monitoramento

Esta é uma atualização **exclusivamente visual**, baseada na V56. Não modifica backend, banco de dados, fontes de licitação, filtros de negócios, logins, endpoints ou arquivos externos.

## Mudanças

- O topo da busca exibe apenas valor mínimo, data inicial, data final e **Agente de busca**.
- **Filtros de obras** e **Mais opções** ficam em cards recolhidos por padrão; somente um painel de filtros fica aberto por vez.
- **Contas das plataformas** permanece em card fechado até o usuário clicar.
- O andamento do agente tem um resumo; a lista de relatórios e avisos abre pelo botão **Ver detalhes**. A quantidade de avisos continua visível no resumo.
- Cards de plataformas continuam mostrando quantas licitações foram encontradas em cada uma.
- Os cards das licitações exibem só tipo de obra, município, objeto resumido, valor, data da sessão e fase inversa.
- **Ver detalhes** expande órgão, número, objeto completo, fontes, plataforma e ações relacionadas à oportunidade.
- **Arquivos (N)** abre diretamente a relação de documentos, independentemente de **Ver detalhes**.
- Layout responsivo em celular e desktop.

## O que não muda

- Os PDFs continuam como links nas fontes oficiais, sem armazenamento novo no servidor.
- O acesso automático autenticado às plataformas por Playwright não foi ativado nesta versão (continua pendente do teste de conectores).
- Os filtros continuam excluindo Fortaleza e Eusébio, conforme V56.
- Nenhum dado existente é apagado; nenhuma migração do banco de dados é necessária.

## Aplicação

Coloque este ZIP e `Aplicar-LicitaGestao-V57.ps1` juntos na pasta Downloads e execute no PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\Aplicar-LicitaGestao-V57.ps1" -Projeto "$env:USERPROFILE\Documents\LicitaGestao"
```

O script valida que os dois arquivos locais correspondem à V56, realiza backup, verifica o frontend e então envia as alterações para `origin/main`. Caso a V56 não esteja íntegra ou existam alterações locais, ele para sem sobrescrever nada. Se falhar antes do commit, restaura o backup.

A aplicação depende do deploy do frontend feito pela configuração GitHub/Vercel do projeto após o push. Não é necessário atualizar o Render nesta versão exclusivamente visual.
