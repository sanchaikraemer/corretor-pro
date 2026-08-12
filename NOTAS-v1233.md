# NOTAS v1233 — Agenda refeita IGUAL à simulação aprovada (modelo 4)

Data: 12/08/2026. O dono conferiu a v1232 com print, lado a lado com a simulação que ele
tinha escolhido, e flagrou: "era assim que tava na simulação que tu me mandou? não né".
Tinha razão — a v1232 fez quadradinhos com a CONTAGEM grande e manteve as listas antigas
embaixo; a simulação aprovada era outro desenho. Esta versão entrega o desenho dela:

## O que mudou na tela Agenda

- **Quadradinho de cada dia**: dia da semana em cima (QUA, QUI...), **número do dia grande**
  (12, 13...) e a bolinha com a contagem embaixo — como nos aplicativos de calendário.
- **Hoje já vem escolhido ao abrir**, aceso em **coral** (a cor da marca, como na simulação —
  a v1232 usava ciano e nada vinha escolhido).
- Embaixo, **só a lista do dia escolhido**, com o título por extenso ("Hoje — Quarta, 12 de
  agosto · 2 na agenda") e cada cartão com a **hora grande à esquerda** (09:00 / manhã),
  em ordem cronológica; sem hora vai pro fim ("— / sem hora"). As seções antigas
  (Lembretes de hoje / agendados / Compromissos...) saíram — viraram a lista por dia.
- **"Atraso"** (vermelho) ganha quadradinho quando existir; escolhido, mostra os cartões de
  atrasados de sempre (com o × de descartar) + lembretes vencidos de arquivados.
- **"+"** no fim da faixa é o "depois desta semana": lembretes/compromissos com data além
  dos 7 dias e compromissos sem data concreta, com a data (dd/mm) na coluna da esquerda.
- Escolha guardada em `state.agendaFiltroDia`; escolha que ficou velha (virou o dia, atraso
  resolvido, "+" esvaziou) volta pra Hoje sozinha.
- `agendaCardHTML` ganhou o 3º parâmetro opcional `horaHtml` (coluna da hora); quem não
  passa nada fica igual a antes (cartões de atraso/arquivado usam assim).

## Testes que acompanharam o desenho

- `tests/v1233-agenda-topo-bloco-e-semana.test.mjs` (renomeado da v1232): agora exige os
  pontos que diferenciavam a simulação — Hoje escolhido por padrão, coluna de hora nos
  cartões do dia, número do DIA grande no quadradinho e o ativo em coral.
- `tests/v1199-horario-opcional-no-lembrete.test.mjs`: a hora do lembrete agora aparece na
  coluna da esquerda (hcolHora) — a guarda passou a exigir isso (e o cartão de arquivado
  vencido continua com o " às HH:MM" no texto).
- `tests/v932-agenda-sem-whatsapp.test.mjs`: só acompanhou a assinatura nova de
  `agendaCardHTML` (a regra — sem botão de WhatsApp no card — continua igual).

## Verificação visual

Chromium headless, 1440px e 390px, temas escuro e claro: faixa com dia grande e bolinha,
hoje em coral, lista do dia com hora à esquerda, toque em outro dia / Atraso / "+"
trocando a lista, celular com a hora virando linha em cima do cartão.

(O bloco do topo — calendário com total + sino de hoje, modelo C — não mudou nesta versão.)
