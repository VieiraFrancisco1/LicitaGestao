# LicitaGestão V56 — Agente de Monitoramento

## Esta atualização foi preparada sobre a V54

A V55 (arquivamento automático de PDFs no MEGA) **não** faz parte deste pacote. O instalador verifica os hashes da base V54 antes de substituir arquivos, faz backup e interrompe a atualização se houver uma versão diferente ou alterações locais.

## O que foi implementado

- Nova tela de Agente de Monitoramento, **sem busca manual separada**.
- Linha principal com **valor mínimo, data inicial, data final e botão Agente de busca** sempre visíveis.
- Botão **Filtros de obras** para expandir/recolher 21 categorias específicas, com selecionar todos e limpar.
- Seleção de plataformas separada e visível. As fontes permanecem PNCP e TCE-CE; a plataforma de disputa é identificada nos metadados quando possível.
- Exclusão **somente de Fortaleza e Eusébio**, mantendo os demais municípios. Usa o campo município da fonte; a localização exata da execução deve ser confirmada no edital.
- Resultados em **cards de plataformas**, com contagens globais e paginação dentro da plataforma selecionada.
- Cards organizados com valor, objeto, município, órgão, data da sessão, fase inversa e ações.
- Botão **Arquivos** recolhível em cada licitação; mostra links oficiais (PNCP) para abrir em outra aba e baixar quando o portal permitir. PDFs **não** são armazenados em MEGA ou no Render.
- Cadastro de login e senha para BLL, M2A e Licita Mais: credenciais armazenadas **criptografadas**, isoladas por usuário, e nunca recuperáveis pelo navegador pela API. Usuário pode removê-las.
- Migração nova do Prisma para o cofre de credenciais; não apaga tabelas existentes.

## Limitações importantes

- **O navegador Playwright com login automático ainda não foi ativado.** Os conectores exigem testes reais, autorização dos portais e infraestrutura para executar Chromium no servidor. Guardar credenciais não significa que o agente já navega dentro das plataformas.
- A busca atual continua consultando PNCP e TCE-CE, com filtro por plataformas identificadas nos registros. Na BLL, o login oficial utiliza teclado virtual; na Licita Mais o fluxo de autenticação tem etapas. Precisaremos adaptar e testar um conector para cada plataforma antes de ativar logins automáticos.
- Arquivos nas plataformas com login não serão coletados até a etapa de conectores. Para o PNCP, são apresentados links diretos dos documentos públicos; se o arquivo não estiver acessível, aparecerá a indicação correspondente.
- Fase inversa só recebe **Sim/Não** mediante evidência no edital ou análise verificável; caso contrário, **Não identificada**.
- O monitoramento automático da tela só executa as buscas nas fontes públicas e depende do backend ativo.

## Configuração das credenciais

Crie no Render uma variável de ambiente `PLATFORM_CREDENTIAL_ENCRYPTION_KEY` com **32 bytes aleatórios representados em Base64** (não use a chave da OpenAI). No PowerShell, gere localmente:

```powershell
$b = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Convert]::ToBase64String($b)
```

Copie a saída **diretamente** para Environment no backend do Render. Nunca envie esta chave ou as senhas por mensagens, prints ou GitHub. Não troque a chave sem plano de migração: as credenciais cifradas com a chave antiga deixarão de ser legíveis.

Ao abrir o painel "Contas das plataformas" no LicitaGestão, cadastre as credenciais individualmente. Se o backend não tiver essa chave, o salvamento ficará desabilitado.

## Instalação

Baixe `LicitaGestao-V56-agente-monitoramento.zip` e `Aplicar-LicitaGestao-V56.ps1` para Downloads.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\Aplicar-LicitaGestao-V56.ps1" -Projeto "$env:USERPROFILE\Documents\LicitaGestao"
```

O script valida a base V54, cria backup, gera Prisma Client, executa lint/typecheck/test/build e só então faz commit e push. O deploy do backend deve aplicar migrações, com Start Command `npm run deploy:start`. Verifique **Events** do Render e **Deployments** do Vercel. Em caso de falha, preserve o erro completo.

## Primeiro teste

1. Abra Agente de Monitoramento, informe período de sessões e valor acima de R$ 1 milhão.
2. Deixe todas as plataformas desmarcadas e fontes PNCP/TCE-CE marcadas; selecione tipos em Filtros de obras.
3. Execute Agente de busca e aguarde a conclusão.
4. Clique no card da plataforma e no botão Arquivos de uma licitação.
5. Confirme que o link oficial abre nova aba sem salvar no MEGA.
6. Verifique que Fortaleza e Eusébio não constam nos resultados. Caso o município do órgão seja diferente do local da obra, confira o edital.
