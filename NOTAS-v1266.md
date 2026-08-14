# v1266 — "não interessa quem está esperando quem" + último contato é o último atendimento

Duas ordens do dono, 13/08/2026, na mesma frase:

> "não interessa quem esta esperando quem, ja te disse q nao tem como saber sem estar integrado com
> whats. e ultimo contato é ultimo atendimento"

A primeira metade ele já tinha dito outras vezes (v1158, v1189, v1190, v1199) — e a v1265, entregue
horas antes, ainda escorregou nela: a linha do cabeçalho passou a dizer "(sua)" / "(do cliente)", ou
seja, o app voltou a opinar sobre de quem era a bola. A segunda metade é a régua, dita de forma
direta pela primeira vez.

## 1. Saiu o "quem está esperando quem"

**Removidas de vez** (com teste que impede a volta):

- `cpAguardandoResposta` — comparava a data da última fala do cliente com a do atendimento pra
  afirmar "a bola está com ele";
- `ultimaMsgClienteTs` — só existia pra alimentar a de cima;
- `cp1265UltimaMensagemExibida` (nasceu na v1265, viveu um dia) e o rótulo "(sua)"/"(do cliente)".

**"Aguardando cliente" passa a ter o único significado que o app tem como sustentar:** você atendeu e
ainda está dentro do descanso configurado no Cérebro. Nada de adivinhar resposta. Como
`emJanelaDeEspera` já exige atendimento registrado, cliente nunca atendido continua fora desse balde,
e passado o descanso ele sai de lá e volta ao fluxo normal — igual antes.

## 2. Último contato é o último atendimento

`diasParado` (o número "Parado há" das listas) devolvia o **menor** entre "dias desde a última
mensagem" e "dias desde o último atendimento". Parece inofensivo, mas fazia o oposto do que ele
pediu: cliente atendido há 10 dias que mandou uma mensagem ontem aparecia como **"parado há 1 dia"**
— a conversa mandando no número, não o trabalho do corretor.

Agora existe **uma fonte só**: havendo atendimento registrado, o número é dele, ponto. A conversa só
entra quando **não existe atendimento nenhum** — aí é a única data que existe. É a mesma régua que a
linha do cliente já usa desde a v1053 e que o descanso usa desde a v1052.

## 3. O cabeçalho do cliente

A linha que dizia "Última mensagem — 05/05/2026" (enquanto o histórico logo abaixo abria com a
mensagem de 28/07 que ele mesmo mandou) agora é **"Último atendimento — 28/07/2026 · 18:16"**.
Cliente que nunca foi atendido não tem essa data: aí, e só aí, a linha mostra a última mensagem da
conversa. Continua sendo **uma** metalinha de data além da "Última análise" — o cabeçalho não voltou
a ter duas brigando por espaço (regra da v934).

## Conferência na tela (obrigatória)

App publicado (`public/`) em Chromium headless, 390×844, Carteira ativa com três clientes de teste:

| Cliente | Antes | Agora |
|---|---|---|
| Atendida há 17d, calada há 100d | PARADO HÁ 100 dias (v1264) → 17 (v1265) | **17 dias** |
| Escreveu ontem, atendido há 10d | PARADO HÁ 1 dia | **10 dias** |
| Nunca atendido, calado há 100d | 100 dias | 100 dias |

Nenhum erro de página. Nada de CSS/layout mudou.

## Testes

- `tests/v1265-parado-ha-conta-o-ultimo-toque-real.test.mjs` — reescrito pra régua nova: o caso da
  Dani (17, não 100), o caso novo do "escreveu ontem" (10, não 1), o cliente sem atendimento
  preservado, o "—" sem data, o rótulo do cabeçalho, e a proibição de o "(sua)/(do cliente)" voltar.
- `tests/v1071` — passa a exigir `emJanelaDeEspera` sozinho e proíbe `cpAguardandoResposta` de
  voltar (na categoria e no arquivo).
- `tests/v906-aguardando-cliente-real.test.mjs` — **removido**: existia só pra provar a regra que
  acabou de ser revogada (mesmo tratamento que a v924 deu aos testes da v922/v923).
- `tests/v882` — o caso 3 virava o oposto da régua nova; atualizado (atendimento antigo agora manda
  no número, em vez de a mensagem recente zerá-lo). De quebra, a conta esperada passou a ser feita
  no calendário de Brasília, que é o do app — em UTC ela dava um dia a mais perto da meia-noite.
- `tests/v818`, `tests/v824`, `tests/v885`, `tests/v887`, `tests/v937`, `tests/v1189`,
  `tests/attendance-refresh` — ajustados: todos cravavam o texto exato das regras que mudaram. O que
  cada um protege de verdade continua protegido.

Suíte completa verde: 24 arquivos + 423 testes.
