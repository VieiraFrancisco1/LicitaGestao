# LicitaGestão V59 — Etapa 1 (leitura de edital, Limpar busca e acompanhamento)

## Implementado neste pacote

1. **Limpar busca**: redefine os filtros da tela e oculta os resultados anteriores. Não apaga oportunidades persistidas, licitações no Controle Geral nem credenciais salvas.
2. **Adicionar ao Controle Geral**: procura o documento denominado edital na lista de arquivos **do PNCP** e, quando uma chave `TENDER_AI_API_KEY` estiver configurada, solicita ao modelo a extração de modalidade, edital, processo, município, data, objeto, valor global, validade da proposta, garantia de exatamente 1% e pré-qualificação. O usuário confere e salva no formulário já existente.
3. Se o arquivo oficial não estiver acessível, ou a IA falhar, utiliza os dados públicos já catalogados e mostra a limitação na mensagem do formulário. A leitura **não** salva PDFs no MEGA ou no backend: envia a URL pública ao serviço de IA para análise sob demanda.
4. Pré-seleciona uma plataforma cadastrada no Controle Geral quando nome identificado e cadastro se correspondem sem ambiguidade.
5. **Acompanhar agente**: janela com progresso *real* das fontes PNCP e TCE-CE, status, avisos e contadores. Não exibe um navegador simulado.
6. Testes automatizados da leitura segura do edital e do preenchimento parcial.

## Ainda pendente e NÃO simulado neste pacote

- Logins automáticos com **Playwright** em BLL, M2A e Licita Mais, e pesquisas dentro das respectivas sessões autenticadas. As credenciais cadastradas na V56/V58 são preservadas.
- Transmissão de capturas do navegador das plataformas e identificação da fase inversa na tela inicial da M2A. Essas funções dependem de conectores reais e testes com ambiente de execução Chromium configurado.

A interface de acompanhamento avisa sobre essa limitação. Não ative conectores somente pelo fato de existirem credenciais salvas.

## Instalação

Coloque o ZIP e o PS1 na pasta Downloads e rode:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\Aplicar-LicitaGestao-V59.ps1" -Projeto "$env:USERPROFILE\Documents\LicitaGestao"
```

A instalação exige uma cópia local limpa e **exatamente V58**, verifica hashes dos arquivos que serão alterados, cria backup, executa lint, typecheck, testes e builds e só então faz commit/push. Não são necessárias migrations nem dependências adicionais.

## Primeiro teste

1. Abra Agente de Monitoramento > use **Limpar busca**. Confira filtros reiniciados e resultados ocultos.
2. Clique em Agente de busca e confira o botão **Acompanhar agente** na faixa de execução.
3. Em uma oportunidade PNCP com arquivo oficial **Edital**, abra detalhes e clique em Adicionar ao Controle Geral. Confira os valores no formulário. Não salve sem revisar.
4. Se existir `TENDER_AI_API_KEY` no Render, confira se a leitura identifica elementos do edital; em outros casos aparece aviso de preenchimento parcial.
5. Confira que licitações já salvas e credenciais cadastradas nas plataformas foram preservadas.

## Limitações e segurança

- O tempo da leitura de edital pode chegar a dois minutos; existe timeout do cliente de 125 segundos.
- O arquivo pode não ser PDF ou estar inacessível; o sistema não faz download permanente nem tenta contornar proteções. A API de IA utiliza URLs estritamente geradas pelo PNCP.
- A interpretação de requisitos de garantia e proposta pode estar incompleta. O preenchimento **não substitui** a conferência humana.
- A interface só atualiza o estado da pesquisa durante execução e exibe progresso, **não** imagens ao vivo dos navegadores das plataformas.
