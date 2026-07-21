# v899 — Reanalisar/Marcar não estouram mais o texto pra fora do card

## Bug (print do dono)
Ao clicar em "Reanalisar", o botão (agora um ícone pequeno de 66px, Modelo 2) recebia o texto
"Atualizando análise..." — que, com `white-space:nowrap`, estourava pra fora do card, cortado
à esquerda. O mesmo valia pro "Marcar" ("Marcando...").

## Correção
Os handlers `ui670Reanalisar` e `ui667MarcarAtendido` param de trocar o texto do botão. Em vez
disso, adicionam a classe `cp704-ico-loading`, que **gira o ícone** (respeitando
`prefers-reduced-motion`) enquanto processa. O progresso detalhado já aparece na barra grande
("Recalculando prioridade comercial... 34%"), então o texto no botão era redundante além de
quebrar o layout.

## Arquivos
- `app.js` — `ui670Reanalisar`/`ui667MarcarAtendido` (classe em vez de texto) + CSS
  `.cp704-ico-loading`.
- `tests/v899-reanalisar-sem-estouro.test.mjs` (novo).
- `package.json` — versão 898 → 899.
