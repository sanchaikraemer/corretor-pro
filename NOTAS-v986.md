# v986 — observação manual agora pesa de verdade na análise

## Contexto

O dono mandou uma imagem de outro terreno pro cliente Evandro pelo WhatsApp — como o sistema
só lê texto e áudio da conversa importada, essa imagem não aparece em lugar nenhum. Ele então
foi em "Registrar observação" e escreveu "Enviei outra opção mas ele nao respondeu mais", e
reanalisou o lead. O resumo da análise chegou a mencionar isso ("informou que enviou outra
opção..."), mas as três mensagens sugeridas continuaram tratando como se nada tivesse sido
enviado — perguntando se pode enviar outras opções, em vez de dar seguimento ao que ele já
mandou. O dono apontou certo: observação é uma constatação dele como administrador do sistema,
tem que pesar MUITO na análise — não pode ser só mais uma linha perdida no meio da conversa.

## O que estava acontecendo

A observação manual REALMENTE chega na análise (a timeline salva no banco inclui o registro, e a
reanálise usa a timeline atualizada — isso já funcionava). O problema é como ela chegava até a
IA: junto com o resto da conversa, em `api/_pipeline.js` (`analyzeWithBrain`), como só mais uma
linha de `CONVERSA COMPLETA` — sem nada dizendo que aquela linha específica é um FATO confirmado
pelo corretor, e não uma mensagem do WhatsApp a ser interpretada com a cautela normal (tom,
sarcasmo, ambiguidade). A IA claramente notou a observação (apareceu no resumo) mas não deu peso
suficiente pra ela mudar a ação sugerida.

## Fix

- `api/_pipeline.js` — `analyzeWithBrain`: quando a timeline tem alguma observação manual
  (`type:"observacao_manual"` ou `source:"corretor-pro-manual"`), agora entra também num bloco
  dedicado no prompt, **antes** de `CONVERSA COMPLETA`, com instrução explícita: tratar como
  verdade confirmada (não como algo a checar), dar peso alto no diagnóstico e no próximo passo,
  e nunca sugerir uma mensagem que ignore ou repita algo que a observação já diz ter sido feito.
  A observação continua também dentro da conversa cronológica (não foi removida de lá) — o
  bloco novo é reforço, não substituição.

## Verificação

- `npm test`: suíte inteira verde, incluindo o novo `v986-observacao-manual-peso-alto.test.mjs`
  (mocka a chamada à IA e confere que o prompt enviado tem o bloco dedicado, a instrução de peso
  alto, e que sem nenhuma observação manual o bloco simplesmente não aparece).

## Arquivos

`api/_pipeline.js` (bloco de observações no prompt de análise),
`tests/v986-observacao-manual-peso-alto.test.mjs` (novo), `package.json`/`package-lock.json`,
`NOTAS-v986.md`, versão **985 → 986**.
