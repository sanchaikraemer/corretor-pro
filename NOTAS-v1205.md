# v1205 — Central de atenção removida (o sino agora leva direto pra Agenda)

## O pedido

Print do celular com o painel aberto cobrindo a Home inteira: *"nada a ver essa central de ação,
tire isso"*.

No print dá pra ver exatamente o problema: o painel **Central de atenção** ("O que merece sua
ação agora") tapava a tela e listava três coisas —

- "10 atendimentos pedem ação"
- "12 na agenda"
- "192 clientes ativos"

— sendo que **os mesmos três números já estavam nos cards logo atrás**, na própria Home
(10 em "Fazer agora", 12 na "Agenda", 192 em "Total de leads"). Era uma parada a mais entre ele e
a tela que ele queria abrir, repetindo informação que já estava na frente dele.

## O que mudou

**O painel acabou.** Tocar no sino lá em cima agora abre a **Agenda** direto, num toque só, sem
nenhuma tela intermediária.

**O sino continua** — e continua avisando exatamente como antes:

- número **verde** no cantinho = compromisso marcado pra hoje;
- número **vermelho** e o sino inteiro em vermelho = compromisso **atrasado** (o destaque que ele
  pediu na v1093 e que foi reforçado na v1168);
- sem nada marcado, o sino fica limpo.

Ou seja: o aviso ficou, o desvio saiu.

## Por que nada se perdeu

Tudo que o painel dizia continua na tela, e mais perto:

| O que o painel dizia | Onde está agora |
| --- | --- |
| "N atendimentos pedem ação" | card **Fazer agora** da Home (mesmo número, mesma conta) |
| "N na agenda" | card **Agenda** da Home + a própria tela Agenda |
| "N clientes ativos" | card **Total de leads** da Home |
| "N compromissos atrasados" | número vermelho no sino + a tela **Agenda** |

## Detalhe técnico (pra quem for mexer depois)

- `app.js` — saíram a função que montava o painel e a conta que só ela usava; o sino perdeu o
  atalho que interceptava o toque, então o `onclick` do `index.html` (`show('agenda')`) volta a
  valer. O aviso (número/cor) segue sendo calculado no mesmo lugar de sempre.
- `index.html` / `styles.css` — o sino trocou o rótulo pra "Abrir a Agenda"; o estilo
  `.cp687-notify-panel` **continua no CSS de propósito**: o painel do **Bloco de notas** (v1171)
  reaproveita esse mesmo estilo.
- Testes: `tests/v1205-central-atencao-removida.test.mjs` trava o painel do lado de fora (e
  garante que o aviso do sino e o estilo do Bloco de notas continuam de pé). Os testes
  `v885`, `v1010` e `v1012` foram reancorados nas telas que sobreviveram — a intenção original de
  cada um (o sino não pode prometer fila em dia sem atendimento; nenhum número pode prometer mais
  que a dose do dia) continua sendo checada, só que na Home.
