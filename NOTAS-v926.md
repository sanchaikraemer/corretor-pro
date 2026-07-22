# v926 — "Vamos atender mais um?" enxerga a fila completa, não só um balde que pode estar vazio

## O bug (print do dono, minutos depois da v925)

Publicada a v925, o dono bateu a meta de hoje (10/10) e a Home caiu direto em "Tudo em dia!
Nenhum lead pendente agora" — sem o convite "Vamos atender mais um?" que tinha acabado de ser
combinado. `Total de leads: 241` e `Aguardando cliente: 85` mostravam que tinha, sim, muita gente
na carteira.

## Causa raiz

A v925 checava se sobrava gente pra convidar olhando só o balde `acao-hoje`/`retomar-cuidado` —
os mesmos grupos que já alimentavam o hero da Home, montados por `cp786Categoria` (que exige
`entraEmRetomada` e **exclui** quem está com "a bola com o cliente", `cpAguardandoResposta`).
Com a meta de hoje batida, é bem comum esse balde específico zerar — sobretudo quando o resto da
carteira caiu em "Aguardando cliente" (85 aqui) — mesmo havendo gente disponível na fila ranqueada
completa (`cpFilaFazerAgora`, a mesma que alimenta o número "Fazer agora" e o "Atender +1" de
`abrirFazerAgora`, e que NÃO exclui quem está "aguardando"). Resultado: card em 0, "Atender +1"
funcionando normalmente dentro de `abrirFazerAgora`, mas o convite da Home nunca aparecia,
porque olhava pro balde errado (mais estrito) em vez da fila que realmente importa aqui.

## O que mudou

Em `renderBotoesHome`, o que sobra pra oferecer ("disponiveisParaPuxar", o gatilho do convite) e
o que "Vamos atender mais um?" de fato puxa (`extrasPuxados`) agora vêm da **fila ranqueada
completa** (`cpFilaFazerAgora(items)`) — a mesma fonte do número do card e do "Atender +1" — em
vez de só do balde categorizado. A dose normal do dia (`doseBase`, quando a meta ainda não foi
batida) continua vindo do balde categorizado, sem mudança — só o mecanismo de "continuar além da
meta" foi corrigido pra sempre enxergar quem realmente está disponível.

## Verificação

- `tests/v926-continuar-usa-fila-completa.test.mjs` (novo): roda o trecho real de
  `renderBotoesHome` (extraído do `app.js`) com o balde categorizado vazio e a fila completa com
  3 candidatos — confirma que o convite aparece (`disponiveisParaPuxar.length === 3`), que
  clicar puxa da fila completa (`urgentes` recebe o 1º dela), e que sem ninguém em lugar nenhum
  o convite corretamente não aparece.
- `tests/v925-vamos-atender-mais-um.test.mjs` ajustado pras novas variáveis
  (`filaCompleta`/`disponiveisParaPuxar`/`doseBase` em vez de `metaEfetiva`/`backlogAlemDaDose`
  cru).
- Suíte inteira verde (`npm test`); `node --check app.js` e `node build.js` OK.

## Arquivos
- `app.js` (`renderBotoesHome`: `filaCompleta`/`extrasPuxados`/`disponiveisParaPuxar` agora
  vêm de `cpFilaFazerAgora`, não só do balde categorizado), `tests/v926-continuar-usa-fila-completa.test.mjs`
  (novo), `tests/v925-vamos-atender-mais-um.test.mjs` (ajustado), `package.json`/`package-lock.json`,
  `NOTAS-v926.md`, versão **925 → 926**.
