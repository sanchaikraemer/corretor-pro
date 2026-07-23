# v936 — "Última análise" sem data (bug de 3 camadas) + mensagens repetindo o cliente

## Os dois problemas (reportados pelo dono depois da v934/v935 irem ao ar)

1. Depois da v934 (deixar só "Última análise" no cabeçalho do lead), um lead recém-reanalisado
   mostrava "Sem data registrada" mesmo assim. O dono, com razão: "o que te mandei fazer foi
   tirar 1 informação, não todas" — a intenção nunca foi fazer a análise desaparecer.
2. Depois da v935 (capturar lotes/unidades específicas citadas pelo cliente), as sugestões de
   mensagem passaram a **listar de volta pro cliente** os números de lote/quadra que ele mesmo
   já tinha dito ("... lotes 105/77, 37/157 e 31/155 ..."). O dono: "os produtos precisam
   aparecer em 'detalhes comerciais', não em mensagens, senão vamos repetir o que o cliente já
   disse, isso é imbecil da nossa parte".

## Causa raiz do problema 1 — bug em 3 camadas, cada uma escondendo a de baixo

A v934 só REMOVEU as outras 3 metalinhas — não tocou em `cp865UltimaAnaliseISO` (a função que
decide a data de "Última análise"). O problema é que essa função sempre teve falhas, só que
"Última mensagem"/"Último atendimento"/"Última atualização" preenchiam a linha por baixo e
escondiam o buraco. Ao sobrar só "Última análise", o buraco virou visível:

1. **`analyzeWithBrain` (`api/_pipeline.js`) nunca carimbava NENHUMA data de geração.** Só o
   clique manual em "Reanalisar" (`api/reanalisar-lead.js`) adicionava `reanalisadoEm` depois,
   por fora. Um lead que só passou pelo import automático (nunca foi reanalisado manualmente)
   não tinha absolutamente nenhum carimbo pra achar.
2. **Mesmo quando havia carimbo, a lista "leve" de leads perdia ele.** `compactAnalysisForList`
   (`api/_persistence.js`) — usada pra listar a carteira e também pro refresh em background
   600ms depois de reanalisar (`ui670Reanalisar`, `app.js`) — tinha um allowlist de campos que
   NÃO incluía `reanalisadoEm`/`geradoEm`/`analisadoEm`/`iaComercialV2`. Reabrir o lead a partir
   dessa lista (ou o refresh de fundo sobrescrevendo `state.lead`) apagava o carimbo que tinha
   sido gravado certinho segundos antes.
3. **O fallback do front usava um nome de campo que nunca existiu.** `cp865UltimaAnaliseISO`
   caía em `lead?.criadoEm` como último recurso — mas o campo real do objeto lead sempre foi
   `lead.createdAt` (usado em todo o resto do app.js). Esse fallback nunca funcionou, nem uma vez.

## O que mudou

1. `api/_pipeline.js` (`analyzeWithBrain`): o retorno da análise agora carimba
   `geradoEm: new Date().toISOString()` na origem — toda análise, de qualquer fluxo (import
   automático ou reanálise manual), sempre tem uma data.
2. `api/_persistence.js` (`compactAnalysisForList`): allowlist ganha `reanalisadoEm`, `geradoEm`,
   `analisadoEm` e `iaComercialV2` — a lista leve não apaga mais esses carimbos.
3. `app.js` (`cp865UltimaAnaliseISO`): fallback corrigido de `lead?.criadoEm` (inexistente) para
   `lead?.createdAt` (campo real).

## Causa e fix do problema 2

O prompt de análise (mesmo trecho da v935, `api/_pipeline.js`) ganhou uma instrução explícita:
`produtoInteresse`/`produtosInteresse` são dado INTERNO (só pra "Detalhes comerciais"); as três
mensagens sugeridas NÃO PODEM listar de volta os números/identificadores específicos que o
próprio cliente já informou (lote, quadra, apartamento, bloco etc.) — isso é redundante e não
avança a conversa. As mensagens devem se referir às unidades de forma natural ("os lotes que
você separou"), sem recitar os números.

## Verificação

- `tests/v936-ultima-analise-sobrevive-lista-e-mensagens-nao-repetem.test.mjs` (novo): confirma
  o carimbo na origem, o allowlist da lista leve, o fallback com o nome de campo certo, e a
  instrução anti-repetição no prompt.
- `tests/v865-ultima-analise.test.mjs` atualizado (o teste antigo verificava o fallback com o
  nome de campo ERRADO — `criadoEm` — que nunca funcionou; agora testa com `createdAt`).
- Suíte inteira verde (`npm test`); `node build.js` OK, versão 936.

## Observação
Como os fixes 1 e 2 mudam o que a IA grava, leads já analisados antes desta versão só ganham
"Última análise" preenchida (e mensagens sem repetição) depois de serem reanalisados de novo.

## Arquivos
- `api/_pipeline.js` (`analyzeWithBrain` carimba `geradoEm`; prompt com a regra anti-repetição),
  `api/_persistence.js` (`compactAnalysisForList`), `app.js` (`cp865UltimaAnaliseISO`),
  `tests/v936-ultima-analise-sobrevive-lista-e-mensagens-nao-repetem.test.mjs` (novo),
  `tests/v865-ultima-analise.test.mjs` (atualizado), `package.json`/`package-lock.json`,
  `NOTAS-v936.md`, versão **935 → 936**.
