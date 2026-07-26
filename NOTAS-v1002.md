# v1002 — o Cérebro (e todo o aprendizado da IA) passa a ser separado por corretor

## Contexto

Era a maior parte que faltava na separação de dados: a tabela `direciona_config`, que guarda o
Cérebro (regras da IA configuradas pelo corretor), o conhecimento acumulado, o banco de exemplos
de resposta, os casos aprendidos por lead e a fila de aprendizado pendente. Tudo isso era um
"balde" só, compartilhado pela instalação inteira — a chave de cada registro era única no sistema
todo, então só podia existir UM Cérebro pra todos.

Antes de mexer, mapeei os 3 arquivos envolvidos (`_pipeline.js`, `cerebro-config.js`,
`lead-update.js`): 7 chaves/prefixos distintos, 10 pontos de gravação, ~14 funções que precisavam
passar a saber "de qual corretor" é a operação, e um cache em memória que serviria o aprendizado
de um corretor pro outro se não fosse ajustado.

## O que mudou

**Banco (migração `0004_cerebro_por_corretor.sql` — o dono precisa rodar no Supabase):**
- Marca como da conta original toda linha de configuração ainda sem dono (linhas criadas depois
  da migração 0002: filas de aprendizado, casos aprendidos etc.).
- Cria a regra de unicidade nova: "por corretor + chave" (cada corretor pode ter o próprio
  Cérebro). A regra antiga (chave única global) fica no lugar por enquanto — só sai numa migração
  futura, quando o sistema abrir pra corretores novos.

**Código:**
- `api/_pipeline.js`: todas as funções que leem/gravam em `direciona_config` (carregar o Cérebro
  pra análise, registrar inteligência aprendida, salvar casos, fila de aprendizado, conhecimento,
  banco de exemplos, janela de dias de importação) passam a filtrar e carimbar por
  `organization_id`. Um helper novo (`upsertConfigComOrganizacao`) grava usando a unicidade nova
  e, se a migração 0004 ainda não tiver sido aplicada, cai na regra antiga sem quebrar — já
  carimbando o dono. O cache em memória dos casos aprendidos virou um cache POR corretor.
  `aprenderRespostasDaCarteira` também deixou de ler a carteira inteira sem filtro (era a última
  leitura de `whatsapp_processamentos` sem escopo, documentada como exceção na v999 — exceção
  encerrada).
- `api/cerebro-config.js`: a rota inteira do Cérebro passa a resolver de qual corretor é a
  chamada (mesmo helper das outras rotas) e escopar tudo: ler/salvar o Cérebro, exportar
  aprendizado, processar fila, aprender da carteira, limpar aprendizado.
- `api/lead-update.js`: a limpeza de aprendizado ao apagar um lead escopa as chaves e o Cérebro
  do corretor certo.
- `api/reanalisar-lead.js`, `api/processar-storage.js`, `api/analisar.js`: passam o corretor da
  chamada pra dentro do motor de análise (`analyzeWithBrain` e o caminho completo do ZIP).
  `api/analisar.js` também trocou a checagem de chave pura pelo mesmo resolvedor das demais rotas
  (comportamento igual: sem login novo, cai na conta original).
- Quando um chamador antigo não informa o corretor, tudo cai na conta original
  (`ORGANIZACAO_PADRAO_LEGADA`, o mesmo id de `EMPRESA_PRINCIPAL_ID` — o teste garante que os
  dois nunca divirjam) — exatamente o comportamento de hoje.

**Sem login novo, nada muda no uso diário. Com a migração 0004 aplicada, cada corretor novo
passa a ter o próprio Cérebro do zero, sem enxergar o da conta original.**

## Ordem segura de publicação

O código foi feito pra funcionar NAS DUAS ordens (publicar antes ou depois de rodar a migração):
- Publicado antes da migração: gravações caem no fallback da regra antiga (funciona igual hoje);
  leituras de linhas criadas depois da migração 0002 (filas/casos, que estavam sem dono) ficam
  invisíveis até a migração marcar o dono — transitório e sem perda (a migração corrige).
- Migração rodada antes: nada muda pro código antigo (a regra antiga continua lá).

Por isso: **rodar a migração 0004 no Supabase logo depois desta publicação** deixa tudo no
estado final correto.

## Testes

Novo `tests/v1002-cerebro-por-corretor.test.mjs`: (1) as duas constantes de conta original nunca
divergem; (2) o helper de gravação usa a unicidade nova, carimba o dono e cai na regra antiga se
a migração não rodou; (3) ponta a ponta na rota do Cérebro contra servidor falso — leitura
filtrada e save com unicidade nova + dono no corpo. `tests/v827-15-exclusao-oportunidade.test.mjs`
atualizado: a exceção documentada do banco de exemplos acabou — toda leitura no fluxo de apagar
sai filtrada.

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`supabase/migrations/0004_cerebro_por_corretor.sql` (novo), `api/_pipeline.js`,
`api/cerebro-config.js`, `api/lead-update.js`, `api/reanalisar-lead.js`,
`api/processar-storage.js`, `api/analisar.js`, `tests/v1002-cerebro-por-corretor.test.mjs`
(novo), `tests/v827-15-exclusao-oportunidade.test.mjs` (atualizado), `package.json`/
`package-lock.json`, `NOTAS-v1002.md`, versão **1001 → 1002**.
