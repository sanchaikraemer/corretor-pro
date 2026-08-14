# v1264 — o descanso de 7 dias não valia pra quem tinha compromisso já cumprido

Relato do dono (13/08/2026, três prints): o cliente **Bocorni** apareceu no "Fazer agora" três dias
depois de ter sido atendido. O print dos Atendimentos fecha a prova: **segunda, 10/08 — 27/20
atendimentos, e o Bocorni está na lista daquele dia**. O Cérebro dele está com **descanso de 7
dias**. Ou seja: o descanso simplesmente não estava sendo aplicado nesse cliente.

## A causa

`emJanelaDeEspera` (a peça que segura o cliente durante o descanso) abria assim:

```js
if(lembreteVencido(l)) return false;   // "tem compromisso atrasado → não está em descanso"
```

A intenção é legítima: compromisso marcado vence o descanso — não faz sentido segurar um cliente que
combinou algo pra hoje só porque foi atendido anteontem. **O problema é que essa linha nunca
perguntava se o compromisso JÁ TINHA SIDO CUMPRIDO** — e um lembrete com data passada fica "vencido"
para sempre.

No Bocorni: lembrete de 10/08, atendimento em 10/08 (ele copiou a sugestão, o que registra
atendimento). O compromisso foi cumprido no próprio dia — mas o lembrete velho continuava furando o
descanso **todo dia**, antes de a regra dos 7 dias sequer ser consultada. Não era um caso isolado:
qualquer cliente com lembrete no passado ficava permanentemente fora do descanso.

É o **mesmo defeito** que a v1213 corrigiu na Agenda — e é o **mesmo cliente**: lá o Bocorni
aparecia em "Atrasados" no dia seguinte a ter sido atendido na data. Aquele conserto entrou só em
`cp786CompromissoAtrasado`; o descanso ficou com a régua antiga. Duas contas diferentes pro mesmo
conceito — a origem recorrente de bug neste projeto (v1017, v1022, v1049, v1147).

## O que mudou

`emJanelaDeEspera` passa a usar a MESMA peça da Agenda, `cpCompromissoJaAtendido` (atendimento
registrado no dia do compromisso ou depois = compromisso cumprido):

- **lembrete vencido e já cumprido** → não fura mais o descanso;
- **lembrete vencido e não cumprido** → continua furando, como sempre (é pra isso que a regra
  existe, e isso não podia se perder);
- **lembrete no futuro** → não muda nada, vale a régua normal.

A segunda saída da função tinha o mesmo problema em outra forma: compromisso escrito **em texto** na
análise (`"hoje"`, `"amanhã"`) também furava o descanso pra sempre, porque texto não envelhece
sozinho — "amanhã" numa análise de 10/08 continuava dizendo "amanhã" uma semana depois. Agora, se
existe atendimento registrado no dia daquela análise ou depois, o compromisso dela já foi tratado.
Para isso entrou `cpTsUltimaAnalise` (usa os mesmos carimbos do cabeçalho "Última análise",
`cp865UltimaAnaliseISO`) — nenhuma definição nova de "atendimento" foi inventada.

## O que o dono vê na tela

Cliente atendido volta pro "Fazer agora" **só depois dos dias de descanso que ele configurou** —
inclusive quando o cliente tem um compromisso antigo já resolvido. Antes, esses clientes voltavam
todo dia, empurrando pra baixo quem realmente estava na hora.

## Teste

`tests/v1264-descanso-nao-e-furado-por-compromisso-cumprido.test.mjs` — reproduz o caso do Bocorni
(atendido há 3 dias, lembrete do mesmo dia, descanso 7) e trava os dois lados da regra: cumprido não
fura, não cumprido continua furando, lembrete futuro não muda nada, e passado o prazo o cliente
volta normalmente. Também exige que o descanso continue usando `cpCompromissoJaAtendido` — se
alguém trocar por uma conta própria, as duas telas voltam a discordar e o teste falha.

Suíte completa verde (24 arquivos + 423 testes). Sem mudança visual — nada de CSS/layout nesta
versão.
