# NOTAS v1052 — volta a ser uma regra só: marcar atendimento, ponto final

## O relato

Na v1051, depois do caso da Karine, fiz a data da última mensagem também contar pro "descanso"
pós-atendimento (só reforçando a proteção, nunca afrouxando). O dono viu a explicação e decidiu
simplificar: **"esquece 2 regras, vamos usar uma só, que é de marcar atendimento, esquece a data
da última msg."**

## O que mudou

`emJanelaDeEspera` (a regra que decide se um lead ainda está "descansando" depois de atendido)
voltou a considerar **exclusivamente** o último atendimento marcado no app (botão "Marcar
atendimento", copiar mensagem sugerida, ligação, visita, observação, proposta). A data da última
mensagem trocada — que a v1051 tinha passado a considerar como reforço — não entra mais nessa
conta de jeito nenhum, nem pra ajudar nem pra atrapalhar.

Na prática: o descanso configurado no Cérebro (ex.: 7 dias) só recomeça quando você registra uma
ação de atendimento dentro do app. Se você responder um cliente direto pelo WhatsApp sem tocar em
nada no Corretor Pro, isso **não** reinicia a contagem — o jeito de manter um lead protegido por
mais tempo é continuar registrando o atendimento no app (marcar atendimento de novo, ou copiar uma
sugestão) sempre que interagir com ele.

## Testes

- `tests/v1052-so-atendimento-conta-mensagem-nao-conta.test.mjs` (novo): confirma que nenhum campo
  de mensagem aparece mais no código da regra, e reproduz o caso da Karine com o resultado
  esperado agora — atendimento de 10 dias (mais que os 7 configurados) libera o lead, mesmo com
  mensagem de 5 dias atrás.
- `tests/v981-janela-espera-considera-atendimento.test.mjs`,
  `tests/v1018-atendimento-e-nao-mensagem-define-espera.test.mjs`: voltaram ao formato de antes
  da v1051 (mensagem não conta pra nada).
- `tests/v1051-mensagem-reforca-descanso-nunca-afrouxa.test.mjs` foi removido — a regra que ele
  travava deixou de existir.
- `npm test`: suíte inteira verde.
- `npm run build`: build limpo, 27 arquivos publicados.

## Arquivos

`app.js` (`emJanelaDeEspera` volta a usar só `ultimoAtendimentoTs`), `tests/v1052-so-atendimento-conta-mensagem-nao-conta.test.mjs`
(novo), `tests/v981-janela-espera-considera-atendimento.test.mjs`,
`tests/v1018-atendimento-e-nao-mensagem-define-espera.test.mjs` (restaurados),
`tests/v1051-mensagem-reforca-descanso-nunca-afrouxa.test.mjs` (removido),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1052.md`, versão
**1051 → 1052**.
