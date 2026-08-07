# v1171 — reanálise automática depois da observação + quadradinho "Atendidos"

Duas coisas pedidas pelo dono nesta rodada.

## 1. Salvar observação reanalisa sozinho

Ele já tinha pedido isso antes ("apos colocar uma obs e salvar, quero q reanalise novamente
automaticamente") e cobrou de novo quando testou e não viu acontecer: "salvei uma obs e nao vi
atualizar automaticamente como mandei". O pedido nunca tinha sido implementado — só preparado (o
botão "Reanalisar" do topo do lead ganhou um id, `btnReanalisarLeadTop`, numa versão anterior, sem
ser usado ainda).

`cp7ObsSalvar` agora, depois de mostrar a observação salva na tela (`renderLeadFoco(lead)`),
dispara sozinha a mesma reanálise que o botão "Reanalisar" já fazia (`ui670Reanalisar`), usando a
referência FRESCA do botão (pega com `qs()` depois do re-render — a referência antiga, se
existisse, estaria desconectada da tela). A barra de progresso da reanálise aparece no lugar de
sempre, sem precisar tocar em mais nada.

Não tem relação com o "Reanalisar todos" que foi removido em v1114 — aquele rodava a carteira
inteira de uma vez e queimava crédito de API à toa (decisão do dono). Aqui é só o lead que acabou
de receber a observação, 1 chamada — a mesma que já rodava manualmente.

## 2. Quadradinho "Atendidos" (hoje / semana / mês)

Pedido em duas partes:

- Primeiro pediu o bloco de notas (v1170) virando um card na fileira de números da Home (modelo
  "dentro dos números", escolhido entre 4 mockups). Isso deixou a fileira em 7 quadradinhos — no
  celular (grade de 4 colunas) sobrava 1 sozinho numa linha nova, com um monte de espaço vazio do
  lado. Feio, e foi o que ele reportou como "vc mandou um troço saindo pra fora do celular" (na
  verdade eram dois problemas diferentes: a fileira ímpar E uma página de exemplo minha que não
  se ajustava à tela — as duas corrigidas).
- A correção: outro quadradinho do lado, fechando 8 — 2 fileiras de 4 no celular, sem sobrar
  ninguém. Ele pediu esse quadradinho mostrando quantos atendimentos ele concluiu.
- Escolheu entre 4 modelos de visual (mockup enviado por link); no fim pediu o modelo do "arinho"
  (nº4) mas com **3 números em vez de 2**: hoje, semana e mês — sendo explícito que são contagens
  simples de atendimento concluído, **não uma meta/dose batida**.

### O que foi feito

- `ehAtendidoNoMes(l)` — nova função, mesma régua de `ehAtendidoNaSemana` (evento
  `contato_manual` na timeline), só que janela de 30 dias corridos em vez de 7.
- Quadradinho novo em `renderResumoDia`, classe `cp1171-atendidos`: título "Atendidos", um
  arinho verde **decorativo e fixo** no canto (não calculado a partir dos números — o dono foi
  explícito que isso não é meta), e 3 colunas (hoje/semana/mês) separadas por uma linha fina.
  "Hoje" e "semana" reaproveitam a mesma conta que a coluna "Seu ritmo de atendimento" já usa
  (`ehAtendidoHoje`/`ehAtendidoNaSemana`) — sem regra nova ali.
- CSS: `#home` já forçava `font-size:24px!important` em qualquer `<b>` dentro de `.ui-kpi` (regra
  da v1077) e `.ui-kpi svg{width:17px;height:17px}` (base do styles.css) — com 3 números no mesmo
  quadrado e um ícone menor, isso quebrava o layout. Resolvido com seletores mais específicos
  (mesmo ID `#home` + mais classes) pra vencer sem tocar nos outros quadradinhos — mesma lição da
  v1077→v1078 registrada no `CLAUDE.md`.
- O quadradinho do Bloco de notas (v1170) também mudou de posição: virou parte permanente da
  fileira de números (não mais uma faixa isolada acima da busca) desde a v1170 — este release só
  ajusta a fileira ao redor dele.

## Testes

`tests/v1171-atendidos-hoje-semana-mes.test.mjs` (novo): confirma que `cp7ObsSalvar` chama
`ui670Reanalisar` depois do `renderLeadFoco`; que `ehAtendidoNoMes` respeita a janela de 30 dias
(e que 15 dias conta no mês mas não na semana — prova que as duas réguas são independentes); que
o quadradinho existe com as 3 colunas certas; e que o arinho decorativo **não** vira barra de
progresso (`stroke-dasharray` nunca é calculado a partir dos números — só fixo).
`tests/observacao-aprendizado.test.mjs` atualizado (a asserção antiga garantia o comportamento
INVERSO — observação não podia reanalisar sozinha — porque isso nunca tinha sido pedido; agora é
o oposto, por pedido explícito e repetido do dono).

## Verificação

- `npm test`: 337 arquivos de teste, todos verdes.
- Chromium headless, KPI extraído de verdade do `app.js` (mesmas funções, mesmo CSS) renderizado
  contra o `styles.css` publicado: computador (fileira com o quadradinho novo, arinho no canto,
  3 números legíveis) e celular (8 quadradinhos, 2 fileiras de 4, ninguém sobrando).

## Arquivos

`app.js` (`cp7ObsSalvar`, `ehAtendidoNoMes`, `renderResumoDia`, CSS do quadradinho),
`tests/v1171-atendidos-hoje-semana-mes.test.mjs` (novo),
`tests/observacao-aprendizado.test.mjs`, `tests/v1170-bloco-de-notas.test.mjs` (ajustado pra
refletir o bloco de notas virando card + painel flutuante, não mais faixa fixa),
`package.json`/`package-lock.json`, `NOTAS-v1171.md`, versão **1170 → 1171**.
