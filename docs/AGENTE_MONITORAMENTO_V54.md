# LicitaGestão V54 — Agente de Monitoramento (primeira etapa funcional)

## Recursos incluídos
- Menu «Agente de Monitoramento» e botão **Agente de busca**.
- Regras selecionáveis: valor mínimo (padrão R$ 1 milhão), categorias de obras, município, palavras-chave, datas de sessão/prazo final (intervalo até 180 dias) e plataformas desejadas.
- Intervalo vazio: a busca usa os próximos 90 dias; período preenchido: filtra a data de encerramento das propostas (PNCP) ou a sessão do portal TCE-CE.
- Consultas às fontes públicas **PNCP** e **TCE-CE**. Filtros por plataformas só abrangem plataformas que essas fontes identificam; selecionar BLL ou M2A não significa autenticar ou navegar nesses sites.
- Links de arquivos oficiais do PNCP, catalogados junto a cada resultado (até 40 licitações por ciclo, para respeitar limites de rede); botão para baixar o documento ao clicar.
- Fase inversa: **Não identificada** até análise do edital. Botão «Analisar fase no edital com IA» para documentos do PNCP identificados como edital, se `TENDER_AI_API_KEY` estiver configurada. A resposta, quando houver evidência, apresenta SIM ou NÃO e uma justificativa curta. Revisar manualmente o edital; análises por IA podem falhar.
- Monitoramento automático já disponível por perfis salvos no backend, limitado a funcionamento do serviço e fontes públicas.

## Limitações IMPORTANTES
1. **A V54 não faz login automático em BLL, M2A ou Licita Mais.** Acesso autenticado exige analisar a autorização e autenticação de cada fornecedor (incluindo 2FA/CAPTCHA), implementar conectores separados e proteger sessões. Nunca guarde senha em texto ou no frontend.
2. **O arquivo PDF não é copiado de modo permanente para o armazenamento do LicitaGestão.** O sistema cataloga os metadados e link de download da API oficial PNCP. Para guardar cópias persistentes, precisamos habilitar integração com armazenamento durável e política de retenção/limites antes de executar downloads massivos.
3. Alguns órgãos não publicam o arquivo no PNCP ou o link não é acessível. A consulta ao TCE-CE hoje não extrai anexos, por isso mostra a página de origem para conferência.
4. A detecção de fase inversa por IA é sob demanda, não em lote automático; a IA pode errar, e a leitura depende da URL do documento estar acessível para OpenAI. Habilitar `TENDER_AI_API_KEY` gera custos de API.
5. Não envia propostas, documentos de habilitação nem lances. Não soluciona captchas ou autenticações 2FA.

## Como usar
1. Aplique o pacote com o PowerShell V54 na raiz da cópia local do GitHub. O script checa a base, cria backup, executa `npm run quality` e só faz push se passar.
2. Verifique deploy do backend e frontend no Render/Vercel. Nenhuma migration nova é exigida.
3. Acesse «Agente de Monitoramento». Defina o período, tipo de obra, valor e plataformas (deixe sem seleção para todas).
4. Clique em «Agente de busca»; resultados surgem após a coleta. Arquivos PNCP aparecem sob «Arquivos da obra / edital» quando encontrados.
5. Use «Analisar fase no edital com IA» apenas para casos de interesse e confira a justificativa no documento oficial.
6. Marque «Monitorar automaticamente» e salve filtros para reconsultar no intervalo configurado.

## Validação
Sintaxe de arquivos TypeScript/TSX validada localmente. Sem node_modules ou acesso aos serviços nesta sessão não foi possível executar testes end-to-end, fazer chamadas reais com credenciais ou publicar. `npm run quality` é condição para push no script.
