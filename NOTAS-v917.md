# v917 — toolbar do lead: "Voltar" entra no grid, 2 linhas uniformes (Modelo 2)

## O problema (print do dono)

Os 7 botões de ação do lead (Proposta, Arquivar, Mensagens, Reanalisar, Agendar, Editar,
Marcar/Atendido) ficavam numa barra que quebrava linha sozinha (`flex-wrap`): 4 numa linha, 3 na
outra. Como o flex esticava os itens da linha de baixo pra preencher o espaço, os botões da 2ª
linha ficavam visivelmente MAIS LARGOS que os da 1ª — não parelho.

Mandei 4 modelos pro dono escolher (artifact com mockups fiéis à paleta/ícones do app). Ele
escolheu o **Modelo 2**: "Voltar" deixa de ser um botão separado acima da barra e entra no MESMO
grid dos outros ícones — com 8 botões no total, um grid fixo de 4 colunas fecha em exatamente 2
linhas iguais, sem sobra e sem nada esticado.

## O que mudou

- **HTML**: o botão "Voltar" (`.cp704-back`) passou a ser o **primeiro filho** dentro de
  `.cp704-toolbar`, junto com os outros 7 ícones — não é mais um irmão antes dela.
- **CSS**: `.cp704-toolbar` trocou `display:flex;flex-wrap:wrap;justify-content:flex-end` por
  `display:grid;grid-template-columns:repeat(4,1fr)`. Com isso todo botão — em qualquer uma das
  2 linhas — tem exatamente a mesma largura, sempre.
- **Mobile**: removido o `flex-basis:calc(25% - 6px)` antigo (o que esticava a 2ª linha) e o
  `justify-self:start` que sobrava do "Voltar" quando ele era filho direto de `.cp704-top` — hoje
  ele é filho da `.cp704-toolbar`, então esse `justify-self` solto ia encolher só ele dentro do
  grid novo. O grid de 4 colunas vale em qualquer largura de tela.
- `.cp704-back` manteve exatamente o mesmo visual (ícone em cima, rótulo embaixo, borda, hover) —
  só mudou de posição, não de estilo. `.cp704-top` não precisou mudar (agora só tem 1 filho).

## O que NÃO mudou
- Nenhuma ação/comportamento dos botões — só reposicionamento e CSS de layout.
- A ordem dos 7 ícones originais (Proposta → Arquivar → Mensagens → Reanalisar → Agendar →
  Editar → Marcar/Atendido) continua a mesma; "Voltar" só entrou na frente deles.

## Verificação
- `tests/v917-toolbar-modelo2.test.mjs` (novo): confirma que "Voltar" é o 1º filho dentro de
  `.cp704-toolbar`, que o CSS da toolbar virou grid de 4 colunas, que o flex-basis/justify-self
  antigos não sobraram no mobile, e que `.cp704-back` manteve o visual de ícone+rótulo.
- `tests/v894-toolbar-icones.test.mjs` ajustado (a asserção de `display:flex` da toolbar foi
  substituída — ela agora é grid, de propósito).
- Suíte inteira verde; `node --check app.js` e build OK.

## Arquivos
- `app.js` (HTML do topo do lead + CSS `.cp704-toolbar`/mobile), `tests/v917-toolbar-modelo2.test.mjs`
  (novo), `tests/v894-toolbar-icones.test.mjs` (ajustado), `NOTAS-v917.md`, versão **916 → 917**.
