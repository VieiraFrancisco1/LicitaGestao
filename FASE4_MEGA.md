# Fase 4 — Documentos em nuvem (MEGA)

A Fase 4 transforma o módulo **Documentos** em um gerenciador de arquivos online integrado ao MEGA, sem depender do disco temporário do Render.

## O que foi implementado

- Navegação por pastas e subpastas do MEGA dentro do LicitaGestão.
- Upload de um ou vários arquivos, inclusive por arrastar e soltar.
- Criação de pastas.
- Renomeação de arquivos e pastas.
- Exclusão segura: o item é enviado para a lixeira do MEGA.
- Download direto pelo sistema.
- Pré-visualização de PDF, PNG e JPG.
- Busca dentro da pasta atual.
- Exibição de tamanho, data e uso da conta MEGA.
- Escopo por empresa: empresa/funcionário não navega fora das empresas às quais tem acesso.
- Localização automática da pasta existente da empresa pelo nome; se não existir, o sistema cria uma pasta.
- Uploads feitos dentro de uma participação/licitação passam a ser armazenados no MEGA e continuam registrados no banco PostgreSQL.
- Organização automática dos documentos de licitação em `LICITAÇÕES/LICITAÇÕES ANO/MUNICÍPIO/LICITAÇÃO/EMPRESA`.
- Auditoria de upload, criação de pasta, renomeação e exclusão.
- Compatibilidade de leitura com registros antigos que ainda apontem para armazenamento local.

## Instalação local antes do push

Na raiz do projeto:

```powershell
npm install megajs@1.3.10 -w backend
npm run db:generate
npm run typecheck
npm run lint
```

O primeiro comando é obrigatório porque atualiza também o `package-lock.json`, usado pelo `npm ci` no Render.

## Variáveis no Render

Em **Render > LicitaGestao > Environment**, adicione:

```text
MEGA_EMAIL=<e-mail da conta MEGA>
MEGA_PASSWORD=<senha da conta MEGA>
MEGA_ROOT_FOLDER=RB
MEGA_TENDERS_FOLDER=LICITAÇÕES
```

Não coloque as credenciais no GitHub e não envie a senha em mensagens.

`MEGA_ROOT_FOLDER=RB` faz o sistema trabalhar apenas dentro da pasta `RB` do Cloud Drive. Se a raiz desejada for outra, altere somente esse valor.

## Publicação

Depois de configurar as variáveis no Render:

```powershell
git add .
git commit -m "Fase 4 documentos com MEGA"
git push
```

O Render faz o deploy automaticamente. O comando `deploy:start` executa `prisma migrate deploy`, portanto a migration da Fase 4 é aplicada no Neon sem apagar os dados existentes.
