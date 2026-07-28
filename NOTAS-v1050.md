# NOTAS v1050 — tirar a "bolinha" de status da lista Fazer agora

## O relato

Depois de eu mencionar, na entrega da v1049, que a bolinha vermelha de "cliente aguardando você"
continuava existindo, o dono foi direto: "não precisa bolinha vermelha coisa nenhuma... retira
isso, mas junto do código, não adianta só omitir a bolinha na tela... não quero isso, é
desnecessário esse negócio de 'bolinha'".

## O que mudou

O indicador colorido (uma bolinha ao lado do nome do lead — coral quando o cliente está esperando
sua resposta, cinza no resto) saiu da linha da lista "Fazer agora". Não foi só escondido por CSS:
o elemento, o cálculo da cor e o espaço reservado pra ele no layout (grid, desktop e mobile) foram
removidos do código.

**O que eu NÃO toquei, de propósito:** o sinal por trás da bolinha (que lead está "aguardando
resposta do cliente") continua existindo e continua decidindo a ORDEM da fila e o texto que
aparece ao passar o mouse sobre o "há X dias" — isso é uma decisão de PRIORIDADE (o que aparece
primeiro na lista), diferente de um indicador visual, e o dono não pediu pra mexer nisso. Se
quiser tirar esse sinal da prioridade também, é um pedido separado.

## Testes

- `tests/v1050-sem-bolinha-status-fila-hoje.test.mjs` (novo): confirma que o elemento, a cor e o
  espaço reservado no layout sumiram de vez do código (não só escondidos), e que o sinal de
  prioridade em si (usado pra ordenar a fila) continua intacto.
- `tests/v942-home-lista-densa-barra-cinza-e-perf.test.mjs`,
  `tests/v976-barra-mais-comprida.test.mjs`, `tests/v978-produto-curto-barra-maior.test.mjs`:
  ajustados pro novo layout do grid (sem a coluna da bolinha).
- `npm test`: suíte inteira verde.
- `npm run build`: build limpo, 27 arquivos publicados.

## Arquivos

`app.js` (elemento/CSS/grid da bolinha removidos de `cpHomeLeadRow`),
`tests/v1050-sem-bolinha-status-fila-hoje.test.mjs` (novo), `tests/v942-home-lista-densa-barra-cinza-e-perf.test.mjs`,
`tests/v976-barra-mais-comprida.test.mjs`, `tests/v978-produto-curto-barra-maior.test.mjs` (ajustados),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1050.md`, versão
**1049 → 1050**.
