# v953 — cliente existente identificado por nome exato: atualiza direto, sem perguntar

## O pedido do dono

Print em mão, no meio da importação: toda vez que reimporta uma conversa de um cliente que já
tem cadastro, o app para numa tela "Cliente existente identificado: X. A conversa será
incorporada ao mesmo cadastro..." com botões "Atualizar cliente" / "Cancelar", esperando um
clique. Ele disse que tá cansado desse passo extra — até hoje nunca clicou pra tratar como
"outro cliente" nesse caso, então pediu pra pular a etapa e já atualizar direto.

## O que mudou

Em `renderProcessedResult` (app.js), o fluxo de decisão depois de identificar um lead existente
tinha duas situações tratadas como se fossem uma só em termos de "esperar clique":

- **Nome só PARECIDO, não idêntico** (`nomeSoParecido`, resolvido na v915): continua igual,
  pergunta "É o mesmo cliente?" com 3 botões — essa é uma ambiguidade real (o nome mudou entre
  importações), a decisão continua sendo do corretor.
- **Nome EXATO** (`perguntarNome` verdadeiro e `nomeSoParecido` falso — o caso do print):
  deixou de esperar clique. A caixa agora só informa "Atualizando o cadastro automaticamente,
  sem criar duplicata." e a mesma função que o botão "Atualizar cliente" disparava
  (`atualizarLeadComEvolucao`) é chamada direto. Os botões continuam no HTML, só ocultos
  (`display:none`) — não fazem parte do fluxo normal, mas não foram removidos.

Sem match nenhum (cliente realmente novo) já salvava direto desde antes — não mudou.

## Verificação

- `npm test` verde (suíte completa, incluindo o teste novo `v953-atualiza-direto-nome-exato`,
  que também confere que o caso "nome parecido" da v915 continua intocado).
- `node --check app.js` OK.
- Não testado em navegador real desta vez: o fluxo depende da importação completa (upload de
  ZIP, análise via OpenAI, resposta do backend) — reproduzir isso de ponta a ponta exigiria
  simular várias rotas de API encadeadas. A mudança em si é só de controle (qual função é
  chamada em qual branch), coberta pela leitura estrutural do teste novo; `atualizarLeadComEvolucao`
  já tinha cobertura própria (`share-target-cold-start.test.mjs`) e não foi alterada.

## Arquivos
- `app.js` (`renderProcessedResult` — pula a confirmação no caso de nome exato),
  `tests/v953-atualiza-direto-nome-exato.test.mjs` (novo), `package.json`/`package-lock.json`,
  `NOTAS-v953.md`, versão **952 → 953**.
