# NOTAS v1044 — Um documento único de estado atual (`ESTADO-ATUAL.md`)

## O problema

A auditoria apontou (item 10): mais de 190 notas de versão acumuladas, sem nenhum documento único
que descrevesse o estado atual do sistema — e achou um exemplo concreto do risco disso: duas notas
diferentes chegando a se contradizer sobre se uma migração já tinha sido aplicada no banco real.
Isso também cobre, em parte, o item 6 da lista de pendências (ambiente de homologação): como não
tenho credenciais pra criar um projeto Supabase novo, o que dava pra entregar agora era deixar
documentado, passo a passo, como montar isso.

## A correção

Criei `ESTADO-ATUAL.md`, na raiz do projeto — um documento único cobrindo:

1. Arquitetura (front-end, backend, banco, IA, multiempresa).
2. As 12 rotas atuais da API e o que cada uma faz.
3. Todas as variáveis de ambiente usadas, agrupadas por finalidade.
4. As 9 migrações do banco e o que cada uma faz.
5. Processo de publicação e de rollback (código e, honestamente, a ausência de rollback
   automático pra banco).
6. Passo a passo pra montar um ambiente de teste separado (o item 6 da lista) — ficou documentado
   porque criar um projeto Supabase novo é ação que só o dono consegue fazer.
7. Resumo do que já foi corrigido em segurança até aqui.
8. Pendências conhecidas, sem enfeitar — inclusive o que ainda falta.

As notas antigas (`NOTAS-v*.md`) continuam existindo como histórico — não apaguei nem uma. A
diferença é que agora existe um lugar certo pra começar quando a pergunta for "como o sistema
está funcionando HOJE", em vez de precisar ler 190 arquivos em ordem cronológica.

## Verificação

- Novo teste `tests/v1044-estado-atual-documentacao.test.mjs`: confere que TODA rota real de
  `api/` está citada em `ESTADO-ATUAL.md` pelo nome do arquivo, e que a migração mais recente
  também está citada — vira uma guarda de regressão de verdade: se uma sessão futura criar,
  remover ou juntar uma rota (ou aplicar uma migração nova) sem atualizar a documentação, o teste
  quebra e avisa, em vez da documentação ficar desatualizada silenciosamente (o exato problema que
  a auditoria criticou).
- `npm test`: suíte inteira verde.
- `npm run build`: build limpo.

## Arquivos

`ESTADO-ATUAL.md` (novo), `tests/v1044-estado-atual-documentacao.test.mjs` (novo),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1044.md`, versão
**1043 → 1044**.
