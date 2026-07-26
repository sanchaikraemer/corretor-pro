# v998 — a Carteira já separa os dados por corretor (nos bastidores)

## Contexto

Continuação direta da v997 (o helper que descobre "de qual corretor é essa chamada"). Nesta
versão ele passa a ser USADO de fato, na parte mais importante do sistema: a lista de clientes
(a Carteira) e a criação/atualização de um lead quando uma conversa é importada.

Escopo desta versão, decidido depois de mapear o tamanho total do trabalho (ver NOTAS-v997.md):
só a tabela `whatsapp_processamentos` (a Carteira de verdade) e os 3 jeitos de criar um lead nela
(importar conversa, criar manual, criar oportunidade de parceiro). O resto (mudar etapa, anotar
observação, apagar lead, reanalisar, e a configuração do Cérebro) fica pra próximas versões,
uma de cada vez — misturar tudo de uma vez só aumentaria o risco de um engano vazar dado de um
corretor pro outro.

## O que mudou

- `api/_persistence.js`: `persistProcessingResult` (salvar/atualizar um lead) e
  `listRecentProcessings` (listar a Carteira, e também abrir o detalhe de um lead específico)
  agora EXIGEM saber de qual corretor é a chamada — sem isso, recusam com erro em vez de mostrar
  ou gravar tudo misturado.
- `api/leads-recentes.js` (lista da Carteira) e `api/lead-update.js` (salvar novo lead, criar
  manual, criar oportunidade de parceiro) passam a descobrir isso com o helper da v997 e mandam
  pra dentro dessas funções. A cache de 5 segundos da lista também passou a levar em conta de
  qual corretor é, pra nunca mostrar a lista de um corretor pro outro por acidente.
- `api/processar-storage.js`: ao reimportar uma conversa, o histórico anterior só é reaproveitado
  se pertencer ao mesmo corretor — antes, bastava saber o id (mesmo de outro corretor) pra herdar
  o histórico dele.

**Sem login novo (o caminho de hoje, com a chave compartilhada), tudo continua caindo na mesma
conta original de sempre — nenhuma mudança visível no uso diário.**

## Testes

Novo `tests/v998-organizacao-nos-leads.test.mjs`: sobe um servidor de mentira imitando o Supabase
e bate no sistema de verdade (`api/lead-update.js` e `api/leads-recentes.js`), confirmando que a
busca e a gravação realmente saem na rede filtradas/marcadas por corretor — não só existem como
parâmetro esquecido no código. Ajustado `tests/v827-15-exclusao-oportunidade.test.mjs` (o
simulador de banco precisava aceitar o novo filtro) e `tests/v963-todas-rotas-exigem-api-key.test.mjs`
(a guarda agora aceita tanto o jeito antigo quanto o novo helper de identificar a chamada).

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`api/_persistence.js`, `api/leads-recentes.js`, `api/lead-update.js`, `api/processar-storage.js`,
`tests/v998-organizacao-nos-leads.test.mjs` (novo), `tests/v827-15-exclusao-oportunidade.test.mjs`
e `tests/v963-todas-rotas-exigem-api-key.test.mjs` (ajustados), `package.json`/
`package-lock.json`, `NOTAS-v998.md`, versão **997 → 998**.
