# NOTAS v1090 — As duas telas que ainda piscavam (as duas eram minhas)

## O que o dono relatou

> *"ainda aparece essa tela no meio, e mais uma vez antes de abrir o lead"*

Ele estava certo nas duas. E as duas foram erro meu — introduzidas justamente pelas correções
anteriores.

## Tela 1 — a que aparecia no meio

Na v1088 eu criei uma "rede de segurança": no fim de toda importação, a tela cheia era fechada,
pra garantir que ela nunca ficasse presa aberta.

O problema é **quando** esse "fim" acontece. A importação **termina antes do salvamento**: assim
que a análise fica pronta, o app dispara o salvamento e **segue em frente sem esperar por ele**.
Ou seja, a minha rede de segurança disparava com o salvamento ainda rodando — a tela sumia, os
cartões da importação apareciam, e o "salvando" trazia a tela de volta.

**Corrigido:** o fim da importação não fecha mais nada. A proteção contra ficar presa virou um
**vigia por tempo**: cada sinal de vida da importação rearma um relógio folgado (2 minutos); só se
ficar todo esse tempo **sem nenhum sinal** é que a tela se fecha sozinha. Ela nunca dispara no meio
de um fluxo que está andando — que era exatamente o defeito.

## Tela 2 — a que aparecia antes de abrir o lead

Ao concluir, a tela cheia sumia por relógio, **650 milissegundos** depois. Mas o lead só abre aos
**800**. Nesse vão de um sexto de segundo, a tela de importação reaparecia — e sumia rápido demais
pra dar tempo de entender o que era.

**Corrigido:** agora ela **não sai por relógio**. Ela fica de pé mostrando 100%, o lead é aberto
por baixo dela, e **só então** ela sai. A troca é direto de "Pronto" pro cliente. (Ficou um relógio
de emergência bem folgado, caso o lead não chegue a abrir por algum motivo.)

## Como eu conferi desta vez

Em vez de olhar etapa por etapa, medi a tela **a cada 40 milissegundos** durante a sequência
inteira — inclusive reproduzindo o detalhe que me escapou antes (a importação terminando com o
salvamento ainda em curso). O resultado é a linha do tempo real:

```
escondida ×5  →  VISÍVEL ×87  →  escondida ×5
```

Um bloco só de "visível": **apareceu uma vez, ficou de pé o tempo todo, sumiu uma vez.** Antes
dessa correção, essa mesma medição mostraria a tela quebrada em vários pedaços.

## Testes

`npm test` verde, com o código de saída conferido. O teste da tela cheia agora exige, em especial:

- que o fim da importação **não** feche a tela (é o erro exato da tela 1);
- que exista o vigia por tempo, e que ele seja folgado;
- que a tela só feche **depois** que o lead abriu (é o erro exato da tela 2).

Um teste antigo (`v1028`) precisou de ajuste: ele localizava o fim da função de salvar procurando
pela linha que abre o lead, e essa linha mudou.
