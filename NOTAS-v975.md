# v975 — motivo do ranking sai da Home de vez (fica só dentro do lead)

## O pedido do dono

Depois de ver a v974 (ícone + resumo curto) no ar, o dono foi direto: "nao quero isso,
informação desnecessaria, ja tem o breafing, analise dentro do lead, nao precisa isso. nem na
tela inicial... nao sei pq tu inventou isso ontem, é tudo a mesma coisa mesmo, nao não tem pq
existir". Reforçou depois: "o sistema é pra facilitar e agilizar, nao pra complicar".

Vale registrar (pra não repetir o mal-entendido): o recurso não foi inventado nesta sessão — vem
da v945/946 (bem antes), motivado por um bug real na época (v943: "Henrique" com 218 mensagens
liderando a fila errado). O que mudou nesta sessão foi só a APRESENTAÇÃO dele na Home (v972 →
v974), duas vezes, a pedido do próprio dono. O ponto de fundo dele está certo, de qualquer forma:
no dado real da carteira, quase todo lead do topo da fila compartilha a mesma razão mais forte
("já se falou de valor..."), então o resumo aparecia IDÊNTICO em quase toda linha — zero valor
prático — e a explicação completa já existe dentro do lead. Repetir isso na Home só ocupava
espaço sem ajudar a decidir nada.

## O que mudou

`cpHomeLeadRow` **parou de chamar `cpMotivoFechamento`**. A linha da Home volta a ser sempre 1
linha só (dot, badge de posição + nome, produto, barra de mensagens, dias) — sem 2ª linha, sem
ícone, sem resumo. `RAIO_SVG` (usado só nesse ícone) foi removido. O CSS morto (`.chr-exp`,
`.chr-exp svg`, `.chr-exp-tx`, as regras `[data-exp="1"]` desktop e mobile) foi removido junto.

**O que NÃO mudou** (por pedido explícito do dono — "já tem o breafing, análise dentro do lead"):
`cpMotivoFechamento` continua existindo, com o mesmo texto/comportamento de sempre (travado pelos
testes v943/v944/v946). `renderLeadFoco` (o card "Fazer agora" de dentro do lead, `cp704-motivo`)
continua chamando ela e mostrando a explicação — esse é o "breafing" que o dono já considera
suficiente.

## Testes atualizados

- `tests/v946-ranking-explicavel.test.mjs`: removidas as asserções que checavam `data-exp`/
  `chr-exp`/CSS de motivo em `cpHomeLeadRow` (não existem mais); mantidas as que testam
  `cpMotivoFechamento`/`cpFatoresRankingLead` diretamente e as de `renderLeadFoco`/`cp704-motivo`
  (nada disso mudou).
- `tests/v972-clareza-fila-hoje.test.mjs`: removida a asserção que checava o aviso anti-regressão
  da cor `--accent` do `chr-exp` (elemento não existe mais); comentário do item 3 atualizado.
- `tests/v974-motivo-icone-resumo.test.mjs`: **removido** — testava só o formato ícone+resumo,
  que durou 1 versão e foi retirado.
- `tests/v975-motivo-so-no-lead.test.mjs` (novo): confirma que `cpHomeLeadRow` não invoca mais
  `cpMotivoFechamento` e não referencia `chr-exp`/`data-exp`/`RAIO_SVG`; confirma que não sobrou
  CSS morto; confirma que `cpMotivoFechamento` e o briefing dentro do lead (`renderLeadFoco`/
  `cp704-motivo`) continuam intactos; testa com um lead com TODOS os fatores de ranking presentes
  que mesmo assim nenhum vestígio de motivo aparece na Home.

## Verificação

- Suíte inteira verde (`npm test`), incluindo v942/v943/v944/v946/v972/v973 (as que tocam nas
  mesmas funções/CSS).

## Arquivos

- `app.js` (`cpHomeLeadRow` — remoção da chamada a `cpMotivoFechamento` e do markup de motivo;
  `RAIO_SVG` removido; CSS `.chr-exp`/`[data-exp="1"]` removido), `tests/v946-ranking-explicavel.test.mjs`
  (atualizado), `tests/v972-clareza-fila-hoje.test.mjs` (atualizado),
  `tests/v974-motivo-icone-resumo.test.mjs` (removido), `tests/v975-motivo-so-no-lead.test.mjs`
  (novo), `package.json`/`package-lock.json`, `NOTAS-v975.md`, versão **974 → 975**.
