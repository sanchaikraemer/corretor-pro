# v976 — barra de mensagens mais comprida (só o comprimento, não a fonte)

## O pedido do dono

Depois da v975 (motivo saiu da Home), o dono perguntou se a barra de mensagens não devia ser
maior. Foi apresentada uma prévia com 4 tamanhos/formatos — mas todas aumentavam também o número
ao lado. O dono corrigiu: "não é maior a fonte... é só a barra mais comprida".

## O que mudou

`cpBarraMensagensMini` (a função JS que gera o HTML/estilo da barra) **não mudou** — continua
devolvendo `<b style="color:${cor}">${n}</b>` do mesmo jeito de sempre. Só o CSS do container
(`.chr-track`) mudou:

- Desktop: `width:64px` → `width:92px` (altura continua 7px — não pediu mais grossa, só mais
  comprida).
- Mobile: `width:96px` → `width:130px`, mesma proporção.
- A coluna do grid que reserva espaço pra barra (`.cp-hoje-row`, área `bar`) cresceu de `116px`
  pra `144px` — sem isso, a barra maior ia espremer o número/dias.

O número ao lado da barra (`.chr-bar b`) continua exatamente `font-size:11px;font-weight:900` —
igual antes desta versão.

## Verificação

- `tests/v976-barra-mais-comprida.test.mjs` (novo): confirma a nova largura da barra
  (desktop/mobile), confirma que o número ao lado NÃO mudou de tamanho, confirma que a coluna do
  grid cresceu.
- Suíte inteira verde (`npm test`).

## Arquivos

- `app.js` (`.chr-track`, coluna `bar` do grid), `tests/v976-barra-mais-comprida.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v976.md`, versão **975 → 976**.
