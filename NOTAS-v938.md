# v938 — "Puxar da fila" oferecia lead que ainda está esperando resposta do cliente

## O bug (achado pelo dono via print)

Clicou em "Puxar da fila" (o botão da v933, pra quando ninguém bate no critério automático de
prioridade) e o app devolveu a **Mariana** como "PRIORIDADE AGORA", com "Objeção identificada
para tratar". No próprio card dela: **"ontem de contato"** / **"ontem sem resposta"** — o
corretor tinha falado com ela ONTEM e ela ainda nem teve tempo de responder. Não havia objeção
nenhuma pra tratar hoje — a bola estava do lado dela.

## Causa raiz

`cpFilaFazerAgora` — a fila ranqueada usada tanto pelo número "Fazer agora" quanto pelo botão
"Puxar da fila"/"Atender +1" — só excluía quem foi contatado **HOJE** (`!ehContatadoHoje(l)`).
Não excluía quem está genuinely **aguardando resposta do cliente** (`cpAguardandoResposta` — já
existia no código, mas só era usada pra decidir o card "Aguardando cliente", nunca tinha sido
aplicada nessa fila). Resultado: um lead contatado ontem (ou em qualquer dia, mesmo há 150 dias)
sem resposta ainda entrava na fila como candidato a "prioridade agora".

## O que mudou

`cpFilaFazerAgora` (`app.js`) agora também exclui qualquer lead onde `cpAguardandoResposta(l)`
seja verdadeiro — ou seja, onde o corretor foi quem falou por último e o cliente ainda não
respondeu, independente de quantos dias tenham passado. Esses leads continuam visíveis em
"Aguardando cliente" e, quando ficam realmente parados (7+ dias), em "Oportunidades esquecidas"
— só não entram mais na fila de "prioridade agora"/"puxar da fila" fingindo ter uma ação urgente
que não existe.

## Verificação

- `tests/v938-fila-nao-oferece-aguardando-resposta.test.mjs` (novo): confirma a exclusão na
  função real, inclusive pro caso de dias parados altos (a regra não "expira" com o tempo).
- `tests/v914-fazer-agora-dose-e-fds.test.mjs` e `tests/v924-fazer-agora-meta-decrescente.test.mjs`
  atualizados (extraem e executam a função real via eval — precisavam do stub novo
  `cpAguardandoResposta` no sandbox de teste).
- Suíte inteira verde (`npm test`); `node build.js` OK, versão 938.

## Arquivos
- `app.js` (`cpFilaFazerAgora`), `tests/v938-fila-nao-oferece-aguardando-resposta.test.mjs`
  (novo), `tests/v914-fazer-agora-dose-e-fds.test.mjs`, `tests/v924-fazer-agora-meta-decrescente.test.mjs`
  (atualizados), `package.json`/`package-lock.json`, `NOTAS-v938.md`, versão **937 → 938**.
