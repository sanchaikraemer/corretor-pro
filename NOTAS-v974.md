# v974 — motivo da fila: ícone + resumo curto (Opção 4 escolhida pelo dono)

## O pedido do dono

Depois da v972 (frase inteira do motivo em negrito+coral, com os números que variam sublinhados),
o dono viu ao vivo e reclamou: "não gostei dessa frase, é grande, em negrito, desarmoniza a tela
toda". Foi publicada uma prévia (fora do repositório) com 4 tratamentos visuais diferentes pra
essa linha, todos já com a barra em gradiente da v973. O dono escolheu a **Opção 4**: ícone +
resumo curto, com o texto completo disponível só ao tocar/passar o mouse.

## O que mudou

`cpHomeLeadRow`: a linha de motivo (`chr-exp`) deixa de mostrar a frase inteira e passa a mostrar
um raio (ícone, `RAIO_SVG`) + só a razão MAIS FORTE — o 1º pedaço de `cpMotivoFechamento(l)`,
que já devolve as razões em ordem de importância separadas por `" · "` — seguido de `"+N"` quando
existem outras razões além dessa. A frase completa não se perde: vai inteira pro atributo
`title` do span (aparece ao tocar/passar o mouse).

**`cpMotivoFechamento` não foi tocada** — nem o texto (travado por regex nos testes
v943/v944/v946), nem a lógica de quais razões entram. A v974 só reaproveita o separador `" · "`
que a função já usa pra juntar as razões; não duplica a lógica de pontuação/prioridade.

CSS: `.chr-exp` vira `display:flex` (ícone + texto lado a lado) e o peso cai de `800` pra `700` —
mais leve que a v972, resolvendo o "grande, em negrito" apontado pelo dono. A cor (`--accent`,
coral) continua a mesma — isso nunca foi o problema apontado, e é decisão explícita do dono na
v949 (travada pelo teste v946).

## Testes atualizados (não só criados)

- `tests/v946-ranking-explicavel.test.mjs`: a asserção que travava `font-weight:800` em `chr-exp`
  foi atualizada pra `700`, com comentário explicando a sequência v948→v949→v974.
- `tests/v972-clareza-fila-hoje.test.mjs`: as asserções que checavam o negrito por dígito (item 3
  daquela versão, superado por esta) foram removidas, com comentário apontando pra este teste.
- `tests/v974-motivo-icone-resumo.test.mjs` (novo): cobre o formato atual — resumo é a 1ª razão
  real (não um índice arbitrário), sufixo `"+N"` só aparece com 2+ razões, título completo
  preservado, `cpMotivoFechamento` continua sem saber nada sobre ícone/resumo, e o caso sem
  nenhuma razão (Henrique) continua sem `chr-exp` nenhum.

## Verificação

- Suíte inteira verde (`npm test`), incluindo v942/v943/v944/v946/v972/v973 (as que tocam nas
  mesmas funções/CSS).

## Arquivos

- `app.js` (`RAIO_SVG` novo; `cpHomeLeadRow` — resumo do motivo; CSS `.chr-exp`/`.chr-exp-tx`),
  `tests/v946-ranking-explicavel.test.mjs` (atualizado), `tests/v972-clareza-fila-hoje.test.mjs`
  (atualizado), `tests/v974-motivo-icone-resumo.test.mjs` (novo), `package.json`/
  `package-lock.json`, `NOTAS-v974.md`, versão **973 → 974**.
