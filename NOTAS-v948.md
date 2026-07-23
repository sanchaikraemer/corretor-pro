# v948 — motivo do ranking sem destaque visual: cor de destaque no lugar do cinza discreto

## O pedido do dono

Depois do deploy da v945-947, o dono testou o ranking explicável (v946) em produção e reportou:
a linha de motivo aparecia tanto na Home quanto no card "Fazer agora" do detalhe, mas "muito
singela, sem destaque" / "quase ilegível" — a informação existia, mas ninguém ia notar ela no
dia a dia. Isso derrota o próprio propósito da v946 (explicar o motivo do ranking pra parar o
ciclo de "a ordem tá errada").

## A causa

As duas implementações usavam `var(--muted)` (cinza baixo-contraste, #6B7178, reservado pra
metadado discreto tipo "produto"/"dias parados") sem negrito, em fonte pequena (11px). Passava
despercebido de propósito — só que essa NÃO é a intenção certa pra essa informação específica,
que é o motivo em si, não um metadado auxiliar.

## O que mudou

1. **Home** (`cpHomeLeadRow`/`chr-exp`): cor trocada de `var(--muted)` pra `var(--cyan)` (o azul
   que o app já reserva especificamente pra "dados/análise" — mesmo tom usado nas observações da
   linha do tempo do lead), com `font-weight:800` (era sem peso definido).
2. **Card "Fazer agora" do detalhe** (`renderLeadFoco`): deixou de reaproveitar a classe
   `cp704-metaline` (compartilhada com "Última análise"/"Última mensagem", que são discretas de
   propósito) e ganhou uma classe própria, `cp704-motivo` — um "chip" com fundo `rgba(86,199,242,.10)`,
   borda `rgba(86,199,242,.24)` e texto `var(--cyan)` em negrito, visualmente destacado do resto
   do card em vez de mais uma linha de texto corrido.

## Verificação visual real

Rodei o HTML+CSS gerado de verdade num Chromium headless (mesmo método da v946) com o caso real
citado pelo dono (negociação avançada + 49 dias de recorrência + 16 perguntas) — confirmado que a
frase agora aparece em azul-ciano em negrito, bem distinta do cinza dos outros campos da linha.

## Verificação

- `tests/v946-ranking-explicavel.test.mjs` (atualizado): a asserção que travava a classe
  `cp704-metaline` no card de detalhe passou a exigir `cp704-motivo`; nova asserção confere que
  `cp704-motivo` usa `color:var(--cyan)`; nova asserção confere que `chr-exp` usa
  `font-weight:800;color:var(--cyan)` (não mais `var(--muted)` sem peso).
- Suíte inteira verde (`npm test`); `node build.js` OK, versão 948.

## Arquivos
- `app.js` (`.chr-exp` — cor/negrito; `cp704Css()` — nova regra `.cp704-motivo`; `renderLeadFoco` —
  troca de classe), `tests/v946-ranking-explicavel.test.mjs` (atualizado),
  `package.json`/`package-lock.json`, `NOTAS-v948.md`, versão **947 → 948**.
