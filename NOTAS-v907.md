# v907 — contagem "atendidos hoje" batendo com a Meta + botões encorpados

## Item 10 — "atendidos hoje" da home = Meta do dia
A saudação mostrava menos que a Meta ("5 atendidos" x "6/10"). Causa: a home contava só leads
**ativos** (`leadEhAtivo(l) && ehContatadoHoje(l)`) — ao arquivar um lead atendido hoje, ele saía da
conta da home, mas continuava na Meta (que conta todos os atendimentos do dia). Removido o filtro
`leadEhAtivo`: agora conta **todo lead atendido hoje**, inclusive o arquivado. (O "10" segue sendo a
meta/alvo de atendimentos, não o dia abrindo com 10 leads.)

## Item 11 — botões de "Ferramentas e ações" com mais capricho
`.cp704-tools-row` (Gerar proposta / Arquivar / Excluir / Últimas mensagens): mais altura
(`min-height:54px`) e respiro, cantos 14px, fundo em leve gradiente, borda mais definida e **hover
com elevação** (sobe 1px + sombra). Variações "good" (verde) e "danger" (coral) mantidas, mais vivas.

## Verificação
- `tests/v907-contagem-e-botoes.test.mjs` (novo): confere que a contagem não filtra mais por
  `leadEhAtivo` e que os botões ganharam corpo + hover.
- Suíte inteira verde; `node --check` OK.

## Arquivos
- `app.js` (contagem + CSS dos botões), `tests/v907-contagem-e-botoes.test.mjs` (novo),
  `NOTAS-v907.md`, versão **906 → 907**.

## Ainda na fila (próximas)
8/9. "Atualizado em…" / "Última atualização" no lead (posição/metalinhas).
13. Subir as ações do lead (Gerar proposta/Arquivar/Excluir/Últimas mensagens) pro topo em ícones.
12. Tela Atendimentos por dia (colunas com prédio + clientes do dia; nomes sem "atendido há X" e sem produto).
