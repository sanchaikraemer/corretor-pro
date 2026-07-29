# NOTAS v1080 — importação travava em "Salvando" pra sempre + card reaparecia por cima

## Contexto

O dono mandou 3 prints em sequência da mesma importação (conversa com Marcos Pinzon, 60,2 MB):
primeiro achando que a etapa "Analisando" estava demorando demais, depois "Salvando —
salvando no banco de dados... (94%)" **parado por minutos, sem nenhuma mudança** entre os
prints das 15:05 e 15:07 — e, no meio disso, reclamou que o card "Importar conversa"
(título, texto de instrução, "Arquivo selecionado" e os botões "Nova análise"/"Diagnóstico")
**voltou a aparecer por cima do andamento**, coisa que já tinha sido pedida pra sumir durante
o processamento (v1077/v1078).

## Causa 1 (a mais grave): salvar no banco podia travar a tela pra sempre

`salvarLeadPendente` e `atualizarLeadComEvolucao` — as duas funções que gravam o lead no
banco depois da análise — chamavam `./api/lead-update` com `fetch()` cru, **sem nenhum
limite de tempo**. Se a rede do celular engasgasse nesse momento (o mesmo cenário de "rede
pendurada" reconectando depois de outro app, já corrigido em outros botões nas v1034/v1036/
v1079), o pedido nunca respondia, nunca dava erro, e a tela ficava presa em "Salvando" pra
sempre — exatamente o que os prints mostram. Corrigido: as duas agora usam `fetchComTimeout`
(45s, o mesmo limite generoso já usado em outras gravações), e o erro final passa por
`userFriendlyError` em vez do texto técnico cru.

## Causa 2: o card de instruções voltava cedo demais

`renderProcessedResult` (chamado dentro do fluxo de importação) dispara o salvamento
automático **sem esperar por ele** (sem `await`) — de propósito, pra não travar a tela
enquanto salva. Só que isso também fazia `processFile` terminar e seu `finally` desligar o
modo limpo do card (`cp-import-rodando`) **antes** do salvamento de verdade ter terminado —
então as etapas "Salvando" e "Concluído" apareciam com o título/instruções/arquivo/botões do
card de importação reexibidos por cima, escondendo a mesma coisa que a v1078 tinha acabado
de esconder.

Corrigido: `processFile` só desliga o modo limpo no `finally` se a importação **não** tiver
concluído com sucesso (falha de verdade). No caminho de sucesso, quem desliga agora é o
próprio salvamento (`salvarLeadPendente`/`atualizarLeadComEvolucao`), tanto no sucesso quanto
na falha — ou seja, só quando o processo inteiro realmente termina, não antes.

## Verificação

- Suíte inteira (`npm test`) verde, incluindo o teste novo
  `tests/v1080-salvar-lead-timeout-e-modo-limpo.test.mjs`.
- Conferido em Chromium headless (`public/`) que a classe `cp-import-rodando` continua
  escondendo título/instruções/arquivo/botões do card enquanto ligada, e devolve tudo ao
  normal quando desligada — o mecanismo visual em si está intacto; a correção foi em QUANDO
  o código liga/desliga essa classe.
- `npm run build` limpo, publicado com a versão 1080.

## O que fazer com a importação que ficou presa

Se a tela ainda estiver parada em "Salvando" de uma importação anterior a esta correção,
feche e abra o app de novo — o ZIP fica guardado até o lead ser salvo, então não precisa
reexportar do WhatsApp. Com esta versão publicada, uma nova tentativa já tem o limite de
tempo novo e não deve mais travar assim.

## Arquivos

`app.js` (`processFile`, `salvarLeadPendente`, `atualizarLeadComEvolucao`),
`tests/v1080-salvar-lead-timeout-e-modo-limpo.test.mjs` (novo), `package.json` (lista de
testes + versão **1079 → 1080**), `package-lock.json` (sincronizado), `NOTAS-v1080.md`
(este arquivo).
