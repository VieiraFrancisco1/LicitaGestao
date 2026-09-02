# LicitaGestão — correções de validade + importação de Carta Proposta por PDF

Este patch deve ser aplicado sobre a versão que já contém o Dashboard por empresa, Baixa e Carta Proposta (migration `20260911000000_dashboard_proposal_letter`).

## Correções incluídas

- A validade da Carta Proposta (ex.: 60 dias) **não é mais tratada como prazo operacional da licitação**.
- A aba `Prazos`, o sino e o Dashboard consideram apenas datas operacionais, como a sessão.
- No Resumo da licitação aparece apenas `Validade: 60 dias`, sem calcular uma data futura.
- Os três blocos da aba `Baixa` ficam alinhados e com a mesma altura.

## Importar uma Carta Proposta existente em PDF

Na aba `Carta Proposta`, ADMIN e FUNCIONÁRIO podem selecionar um PDF antigo da mesma cidade e clicar em `Importar e analisar PDF`.

O backend lê o texto do PDF e tenta converter automaticamente para o modelo reutilizável da cidade, substituindo por campos dinâmicos:

- `{{numero_licitacao}}`
- `{{processo_administrativo}}`
- `{{objeto}}`
- `{{valor_global}}` — usa o valor final salvo em Baixa
- `{{valor_global_extenso}}`
- `{{prazo_execucao}}`
- `{{validade_proposta}}`
- `{{empresa_razao_social}}`
- `{{empresa_nome}}`
- `{{cnpj}}`
- `{{representante}}`
- `{{municipio}}`
- `{{data_atual}}`

Depois da importação, o texto convertido aparece no editor e na prévia para conferência. Se algum campo importante não for identificado, a tela informa o que precisa ser revisado antes de salvar/usar.

### Importante sobre o PDF

A leitura automática funciona para PDFs com **texto selecionável**. PDF escaneado apenas como imagem não é alterado silenciosamente: o sistema rejeita a importação e mantém o modelo atual.

Nesta versão, o PDF é usado como fonte para reaproveitar o **conteúdo textual e a estrutura da carta**. O novo PDF é gerado pelo gerador do LicitaGestão; logotipo, fonte e posicionamento gráfico exatos do PDF original não são copiados. Isso evita substituir dados errados em posições arbitrárias do documento.

## Banco de dados

Nova migration aditiva:

`20260912000000_proposal_pdf_import`

Ela apenas adiciona metadados ao modelo de Carta Proposta para registrar que ele veio de um PDF e o nome do arquivo de origem. Nenhum dado existente é apagado.

Depois desta atualização o Render deve encontrar **12 migrations**.

## Dependência nova

O backend passa a usar `pdfjs-dist@3.11.174` apenas para extrair texto do PDF.

Por isso é obrigatório executar `npm install` antes do commit, para atualizar o `package-lock.json` do repositório.

## Comandos recomendados

```powershell
npm install
npm run db:generate
npm run typecheck
npm run lint
npm run test
npm run build
```

Não executar `npm run db:seed`.
