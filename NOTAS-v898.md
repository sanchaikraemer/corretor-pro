# v898 — barra de "Interesse do cliente" não pisca mais ao abrir o lead

## Bug (dono)
Ao abrir um lead, a barra mostrava um número e ~1s depois trocava por outro (ex.: Maurício
5 -> 17; Rafael 4 -> 19). Causa: o lead abre com um RECORTE das mensagens (o que veio da
lista) e o histórico COMPLETO só chega ~700ms depois (getLeadDetail), re-renderizando com o
número real. A barra calculava em cima do recorte parcial primeiro.

## Correção
A barra só mostra o número quando `lead.historyLoaded` é verdadeiro (histórico completo). Até
lá mostra **"contando mensagens…"** (barra vazia, esmaecida) em vez de um número falso. Quando
o histórico chega, preenche com o valor real (com transição suave). Sem piscar número errado.

## Arquivos
- `app.js` — `cp704BarraInteresse` espera `historyLoaded`.
- `tests/v898-barra-sem-piscar.test.mjs` (novo).
- `package.json` — versão 897 → 898.
