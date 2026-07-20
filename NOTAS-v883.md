# v883 — Raio-X da carteira clicável (drill-down)

## O problema (print do corretor)

O bloco **"Raio-X da carteira"** mostrava diagnósticos com números —
"37 clientes já visitaram e sumiram", "13 conversas longas sem visita",
"Parada de maior valor: Sara" — mas **sem nenhum clique**: não dava pra ver
QUEM eram aqueles leads, então o número não virava ação.

## A correção

Cada linha do Raio-X virou um **botão** que abre a lista exata dos leads por trás
do número (com "‹ Voltar" pra home):

- **Gargalo** ("N clientes travaram / visitaram e sumiram / em negociação") → abre
  os leads daquela etapa parados há 5+ dias (`abrirRaioX('gargalo', etapa, ...)`).
- **Conversas longas** ("N conversas longas sem visita") → abre os leads com 30+
  mensagens e nenhuma visita marcada (`abrirRaioX('longas', ...)`).
- **Parada de maior valor** → abre direto o lead (ex.: a Sara) via `abrirLead(id)`.

A lista é recalculada no clique com os **mesmos critérios** que montam o texto
(`leadsRaioX`), então a lista sempre bate com o número mostrado. Uma seta `›`
indica que a linha é clicável.

### Como foi feito

- `insightFocoHTML` agora monta cada linha como objeto `{ html, onclick }` e
  renderiza como `<button class="raiox-linha">` quando há ação.
- Novos: `temVisitaLead(l)` (extraído do fecho interno), `leadsRaioX(tipo, etapa)`
  e `abrirRaioX(tipo, etapa, titulo)` (exposto no `window` pro onclick inline).
- `abrirGrupoHome` passou a aceitar **lista avulsa** via `options.leads` +
  `options.meta` (título/subtítulo próprios), sem depender de uma chave fixa em
  `GRUPOS_HOME` nem empilhar rota de histórico — reaproveita a mesma UI de cards.

## Arquivos

- `app.js` — Raio-X clicável + `abrirGrupoHome` com lista avulsa.
- `tests/v883-raiox-clicavel.test.mjs` — regressão (linhas viram botões, abridores
  existem/expostos, critérios da lista batem com o texto).
- `package.json` — versão 882 → 883.

## Ainda em aberto (decisão do dono)

- Card **"Fazer agora" sempre em 0**: repropor pra contar as retomadas de
  recuperação (recomendado) ou remover o card. Aguardando escolha.
