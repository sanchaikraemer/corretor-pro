# v939 — correção da v938: usa a regra de espera que já existe, não um bloqueio permanente

## O erro que o dono apontou

Depois da v938 (excluir da fila quem está "aguardando resposta do cliente"), ele perguntou:
**"e esse cliente que 'está com a bola' volta a aparecer nas prioridades quando? já criamos essa
regra e você simplesmente não está cumprindo — me parece que não leu o código e está chutando."**

Ele tinha razão. A v938 usou `cpAguardandoResposta` — uma checagem que **nunca expira**: uma vez
que o corretor fala por último e o cliente não responde, o lead fica bloqueado da fila **pra
sempre**, mesmo depois de 150 dias. Isso ignora uma regra que já existe no app pra decidir
exatamente essa pergunta ("quando volta?"): `emJanelaDeEspera`/`limiarRetomada` — a MESMA regra
que `entraEmRetomada` usa pra retomadas em geral. Ela diz: espera **3 dias** se o lead é novo
(criado há ≤7 dias) ou **5 dias** senão; depois disso, o lead volta a ser candidato normal —
mesmo que quem tenha falado por último ainda seja o corretor.

## O que mudou

`cpFilaFazerAgora` (`app.js`) troca `!cpAguardandoResposta(l)` por
`!(typeof emJanelaDeEspera==='function' && emJanelaDeEspera(l))`. Resultado:
- Lead contatado ontem (dentro da janela: 3-5 dias) → continua fora da fila, como deveria
  (é o caso real da Mariana que motivou a v938).
- Lead contatado há mais tempo que a janela (mesmo sem resposta ainda) → volta a ser candidato
  normal na fila — usando a MESMA regra de retomada que já existe no resto do app, sem
  inventar um comportamento novo.

## Verificação

- `tests/v938-fila-nao-oferece-aguardando-resposta.test.mjs` atualizado: confirma que o código
  usa `emJanelaDeEspera` (não mais `cpAguardandoResposta`) e testa os dois lados — dentro da
  janela (fora da fila) e depois da janela (de volta à fila), inclusive com muitos dias parados.
- `tests/v914-fazer-agora-dose-e-fds.test.mjs` e `tests/v924-fazer-agora-meta-decrescente.test.mjs`:
  removido o stub `cpAguardandoResposta` que não é mais usado por `cpFilaFazerAgora`.
- Suíte inteira verde (`npm test`); `node build.js` OK, versão 939.

## Arquivos
- `app.js` (`cpFilaFazerAgora`), `tests/v938-fila-nao-oferece-aguardando-resposta.test.mjs`,
  `tests/v914-fazer-agora-dose-e-fds.test.mjs`, `tests/v924-fazer-agora-meta-decrescente.test.mjs`
  (atualizados), `package.json`/`package-lock.json`, `NOTAS-v939.md`, versão **938 → 939**.
