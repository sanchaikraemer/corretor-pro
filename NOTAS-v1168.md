# v1168 — painel administrativo menos feio, teste vencido pulsando, e "hoje na agenda" que não passa mais batido

Três pedidos do dono, olhando o app de verdade (não em teoria).

## 1. "Muito feio e grotesco" — o painel administrativo

Print do dono: cada corretor tinha 5 botões de ação, todos do **mesmo peso visual** — e os dois de
marcar como pagante ("Pago · Pro" / "Pago · Pro Master", ação corriqueira) usavam a cor padrão dos
botões (coral, a mais chamativa da tela), enquanto **"Excluir" — irreversível — era cinza neutro,
igual a "Bloquear" e "+7 dias teste"**. A cor mais forte da tela estava na ação errada.

Agora cada botão tem a cor do que ele **é**:

| Ação | Antes | Agora |
| --- | --- | --- |
| Pago · Pro / Pago · Pro Master | coral (a cor mais forte) | verde — a mesma da pílula "Ativo" |
| +7 dias teste | cinza | cinza (sem mudança — é neutro mesmo) |
| Bloquear | cinza | âmbar — é reversível, não é sentença |
| Excluir | cinza, igual às outras | vermelho, com ícone de lixeira, separado das demais por um traço |

Também: a pílula de status e a de plano eram **duas pílulas verdes lado a lado** ("Ativo" e "Pro
Master"), competindo por espaço à toa. Agora é uma pílula só: **"Ativo · Pro Master"**.

## 2. "Quando extingue o prazo de teste tem que destacar, piscar"

A célula "Dias de teste" mostrava só o número cru — um "0" solto, do mesmo jeito que um "12". Nada
distinguia quem está prestes a perder o acesso.

Agora é um selo colorido com três estados: neutro (>2 dias), **âmbar** (1-2 dias, "urgente") e
**vermelho, pulsando** (0 dias, "⚠ Teste vencido"). O pulso é um anel se acendendo e apagando ao
redor do selo — não é a opacidade indo a zero (isso ficaria com cara de lâmpada com mau contato) —
e desliga sozinho pra quem pediu menos movimento na tela (`prefers-reduced-motion`).

## 3. "O aviso de agenda de hoje é só um pontinho, eu nem percebo... vi um agendamento por acaso"

Esta é a mais séria das três: o dono **perdeu um compromisso de verdade** porque o aviso era
inexistente na prática.

**Causa raiz, achada no CSS:** o sino já tinha o código pronto pra mostrar um número visível e
vistoso — mas só pra compromisso **atrasado** (`#topBell.tem-atraso .bell-badge`, da v1093). Pra
"hoje, ainda no prazo", o sino caía numa regra mais antiga (`#topBell .bell-badge`, da v787) que
zera o tamanho da fonte **de propósito** (`font-size:0; color:transparent`) — o número existia no
HTML, mas era estruturalmente invisível. Sobrava só um pontinho de 9px.

Duas correções:

- **O sino** ganhou a mesma regra que o atraso já tinha, com cor diferente (verde, não vermelho —
  "hoje no prazo" não é a mesma urgência de "já passou da hora"). Agora mostra o número de verdade.
- **A Home ganhou uma faixa nova**, "📅 Hoje na agenda", no topo da tela — antes mesmo de "Ficaram
  de te dar uma resposta" — listando quem tem lembrete ou compromisso pra hoje, com horário quando
  dá pra saber. A régua de "hoje" é exatamente a mesma que a tela Agenda já usa (lembrete com data
  de hoje / compromisso confirmado com "hoje" no texto), pra nunca dizer uma coisa aqui e outra lá.
  Cliente já contatado hoje sai da faixa — o aviso é sobre o que falta, não sobre o que já foi.

Bug pego na própria conferência visual (não só nos testes): a primeira versão ordenava todo
compromisso confirmado como se fosse "início do dia", então um compromisso das 17h aparecia
**antes** de um lembrete das 12:30. Corrigido: quando dá pra extrair a hora do texto ("hoje às
17h" → 17h), ela entra na ordenação de verdade; sem hora reconhecida, o item vai pro fim da lista
de hoje.

## Arquivos

- `admin-plataforma.html` — `celulaStatus`, `celulaDiasTeste`, ícone de lixeira; botões recoloridos.
- `contas-estilo.css` — `.btn-plano`, `.btn-atencao`, `.btn-perigo`, `.separador-acao`, `.chip-teste`
  (+ pulso e guarda de `prefers-reduced-motion`), ajuste do cartão mobile pra não duplicar selo.
- `styles.css` — `#topBell.tem-alerta:not(.tem-atraso) .bell-badge` (o número visível pra "hoje, no
  prazo").
- `app.js` — `updateBell` mostra a contagem mesmo sem atraso; `cp1168ItensDeHoje`,
  `cp1168HoraCurta`, `cp1168HoraDoTexto`, `cp1168TsDeHojeComHora`, `cp1168FaixaHomeHTML` (novas); a
  faixa entra na Home antes de "Ficaram de te dar uma resposta".
- `tests/v1168-painel-admin-sino-e-agenda-hoje.test.mjs` — novo. Roda `celulaStatus`/`celulaDiasTeste`
  de verdade (extraídas do painel) pros três estados; confere a regra nova do sino e a nova ordem de
  prioridade do JS; roda `cp1168ItensDeHoje` de verdade cobrindo lembrete/compromisso/arquivado/já
  atendido hoje e a ordem cronológica (o bug pego na conferência visual).

## Conferência

- `npm test`: 24 arquivos + **335 testes**, verdes.
- Chromium headless, app publicado:
  - painel administrativo em 1280px e 390px, com contas de teste em 3 estágios (5 dias / 2 dias /
    vencido) e uma conta ativa com plano — cores corretas, pílula única, zero erro de JS;
  - sino nos três estados (sem alerta / hoje no prazo / atrasado) lado a lado — confirmado que
    "hoje no prazo" agora mostra número, coisa que antes era estruturalmente impossível;
  - faixa "Hoje na agenda" renderizada com dado de verdade, ordem cronológica conferida e corrigida
    na própria bateria de testes visuais.

## O que ficou para depois

O dono pediu mais duas coisas na mesma conversa: um bloco de notas pra tarefas administrativas
(não-venda) fixo no topo da tela, e um jeito de marcar venda com valor/corretor/forma de pagamento
no lead. As duas são funcionalidades novas (não correção do que já existe) — vêm em versões
separadas, pra cada uma ter sua própria conferência sem se misturar com esta leva de correções.
