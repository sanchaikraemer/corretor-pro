# NOTAS v1027 — a causa real de "reaproveitados" sempre em 0

## O relato

Logo depois da v1026, o dono reimportou o **mesmo arquivo ZIP duas vezes seguidas, de
propósito**, só pra testar se o reaproveitamento (que eu já tinha dito ter corrigido, tanto na
v1022 quanto na v1026) realmente funcionava. Continuou vendo "0 reaproveitados" nas duas vezes, e
com toda razão de desconfiar que os "consertos" anteriores não tinham resolvido nada de verdade.

## O que estava acontecendo, de verdade

Achei a causa raiz, e ela é boba de um jeito frustrante: existe, dentro do código do navegador,
uma função que "arruma" o nome de cada áudio antes de perguntar pro sistema "esse aqui eu já
tenho pronto?". Essa função estava **forçando tudo pra letra minúscula** antes de perguntar.

Só que o **servidor** (o lado que efetivamente guarda o que já foi transcrito) nunca faz essa
troca — e o nome dos áudios que o WhatsApp gera quase sempre vem com letras **maiúsculas** no
começo (ex.: `AUD-20240115-WA0007.opus`). Ou seja: o servidor guardava a transcrição pronta sob o
nome `AUD-...`, mas o navegador perguntava por `aud-...` — e nunca batia. Nunca, pra praticamente
nenhum áudio real de WhatsApp.

Resultado prático: o contador "reaproveitados" ficava sempre em 0 (isso é só a parte visível) — e,
pior, o aplicativo mandava **transcrever de novo, pagando de novo**, um áudio que já tinha
transcrição pronta guardada. Essa mesma checagem é usada tanto por "reimportar depois de um
tempo esgotado" (v1022) quanto por "reimportar um lead recorrente" (v1026) — os dois dependiam
dessa mesma conta no navegador, e os dois ficavam neutralizados por ela. É por isso que os dois
"consertos" anteriores pareciam não ter feito diferença nenhuma: a causa de verdade nunca tinha
sido essa até agora.

## O que mudou

Tirei a troca pra minúscula dessa checagem no navegador, deixando ela bater exatamente igual ao
que o servidor usa. Agora um áudio já transcrito antes é reconhecido de verdade, e o contador
mostra o número real de reaproveitados.

## Testes novos

`tests/v1027-reaproveitar-audio-nao-lowercase.test.mjs` — confirma que o servidor nunca força
minúsculas, que o navegador não força mais também, e testa na prática: com um nome de áudio no
formato real do WhatsApp (maiúsculo), o áudio já guardado é reconhecido e não entra na lista pra
transcrever de novo.

## `npm test`

Suíte inteira verde.
