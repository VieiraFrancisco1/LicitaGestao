# Busca inteligente no Ceará — V52

A nova opção **Busca inteligente** aparece na navegação para a equipe interna (administradores e funcionários). O login externo EMPRESA mantém seu acesso às áreas por empresa.

## Uso

1. Abra Busca inteligente. O Ceará é fixo.
2. O padrão é valor estimado **estritamente maior que R$ 1.000.000**, com calçamento, pavimentação e obras de escolas/creches, nas fontes TCE-CE e PNCP.
3. Clique em Buscar agora. A coleta ocorre em segundo plano; a tela acompanha a execução. Resultados anteriores são preservados se as fontes falharem.
4. Abra os links oficiais e confira horário, situação e edital. Quando o TCE informa reabertura, essa data é usada. Quando não há horário publicado na listagem, ele não é inventado.
5. Adicionar ao LicitaGestão abre o cadastro preenchido para revisão, seleção das empresas participantes e salvamento. A oportunidade é vinculada ao cadastro e a restrição do banco impede importação repetida da mesma oportunidade.

Salvar filtros guarda as preferências do usuário. O monitoramento é opcional e vem desativado; ative-o e escolha o intervalo (padrão 6 horas) para receber alertas no sino quando novos resultados forem encontrados. O servidor precisa permanecer ativo: um plano de hospedagem que suspende o processo não executará verificações durante a suspensão.

## Fontes e limites

- TCE-CE: consulta pública de licitações abertas por objeto, incluindo paginação e reaberturas. Não acessa login nem arquivos protegidos por CAPTCHA.
- PNCP: API pública de propostas abertas, com UF CE e horizonte de 90 dias.
- As consultas têm prazo máximo e limites de páginas, exibidos como consulta parcial quando alcançados. Falha de uma fonte não é apresentada como cobertura completa.
- O sistema usa cache público por 10 minutos para reduzir consultas repetidas e permite uma execução por conta por vez.
- Editais sem valor não atendem ao filtro mínimo. Podem ser incluídos explicitamente e aparecem como "Não publicado".
- A consolidação usa identificadores da origem e dados do edital; casos com diferenças relevantes entre portais podem permanecer separados para revisão humana.
- Os dados exibem a última conferência; a confirmação final deve ser feita no edital oficial. As publicações e o formato dos sites podem mudar.

## Ativar análise por IA (opcional)

A consulta, os filtros e o monitoramento não precisam de chave de IA. Para revisar os objetos com um modelo de IA, configure no ambiente do backend/Render:

```
TENDER_AI_API_KEY=<chave da sua conta de API da OpenAI>
TENDER_AI_MODEL=gpt-5.4-mini
```

Insira a chave somente nas variáveis privadas do servidor. Não a coloque no frontend, GitHub ou conversa. É uma API separada da assinatura do ChatGPT, com cobrança na conta da API. Sem configuração, a interface informa "Busca por filtros disponível"; nenhum resultado é apresentado como analisado por IA.

Cada ciclo revisa no máximo 20 oportunidades. Os demais resultados permanecem classificados por filtros. A IA só recebe identificador e objeto público, sem usuários, credenciais ou documentos internos. Não pode mudar valores/datas, executar ferramentas ou cadastrar licitações. Respostas inválidas, indisponibilidade ou falhas de autenticação preservam a classificação por filtros e geram aviso. As chamadas usam store=false.

## Instalação

Aplique o pacote sobre a main V51.1, commit `83bcd91aedfaa597ac3f51105f2cbe9821b3e4e2`. O PowerShell cria backup, instala dependências, gera o Prisma e executa quality (inclui auditoria crítica), commit e push.

O deploy precisa executar `npm run db:deploy` antes de iniciar a nova API, como já previsto em `npm run deploy:start`. A migration adiciona somente as tabelas da busca e uma referência opcional nas licitações existentes; não remove registros antigos. Depois do deploy, a busca já funciona por filtros; a análise por IA é ativada somente com a variável privada acima.

## Validação

Testes cobrem valores, datas e reaberturas, tipos de obra e compras irrelevantes, consolidação, paginação, isolamento de contas, importação e falhas das fontes/IA. As consultas públicas foram também exercitadas separadamente. A chamada real ao modelo exige credencial e não é executada no teste automatizado.
