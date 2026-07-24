# v970 — "cliente esperando resposta" errado: nome do corretor cravado no código

## Contexto

Reportado ao vivo pelo dono com print: o card "Fazer agora" de um lead mostrava a frase (em
laranja) "cliente esperando sua resposta", mas ele confirmou que a última mensagem daquela
conversa era DELE (corretor), não da cliente.

## O problema

`ehMsgDoCliente(m, primeiroNomeCliente)` — a função que decide se uma mensagem da timeline é do
CLIENTE ou do CORRETOR — só reconhecia o autor como "o próprio corretor" quando o rótulo batia
EXATAMENTE com `"sanchai"` ou `"miguel kirinus"`, dois nomes **cravados no código-fonte**
(violação direta da regra do CLAUDE.md: nome de pessoa não pode ficar fixo no código, só vem do
Cérebro configurado ou da própria conversa — o mesmo achado grande já registrado desde a v955,
agora com um bug real e reproduzível em cima dele).

Se o rótulo do autor no export do WhatsApp pro próprio corretor for QUALQUER outra coisa (nome
completo, com sobrenome, apelido, etc. — qualquer coisa que não seja literalmente "sanchai" ou
"miguel kirinus" sozinhos), a mensagem dele caía no último `else` da função ("em conversa
individual, qualquer outro autor é o contato") — e o sistema passava a tratar a MENSAGEM DO
PRÓPRIO CORRETOR como se fosse resposta da cliente. Isso alimenta `ui670UltimaMensagemReal` →
`cpFatoresRankingLead`/`cpProbabilidadeFechamento` → a frase "cliente esperando sua resposta" em
`cpMotivoFechamento`, entre outros ~13 pontos do app que usam essa mesma classificação
(prioridade da fila, "aguardando cliente" na Condução, etc.).

## O que mudou

`ehMsgDoCliente` passa a também reconhecer o autor como o corretor quando bate com o
`corretorNome` configurado no Cérebro (campo "Seu nome", já existente na tela Inteligência
Comercial — lido via `obterCerebroConfigParaAnalise()`, a mesma função já usada pra anexar o
Cérebro nos payloads de análise). Os dois nomes hardcoded continuam como fallback, sem quebrar
quem ainda não preencheu o campo — mas agora qualquer corretor, com qualquer nome, fica
corretamente protegido assim que configura "Seu nome" no Cérebro.

## O que NÃO foi feito agora

O mesmo padrão de nome hardcoded (`sanchai`, `miguel kirinus`, `senger`) também existe em
`api/_pipeline.js`, `api/lead-update.js` e no `BUSINESS_RE` de `app.js` — achado grande já
registrado desde a v955, com decisão adiada por ser heurística central de classificação sem
teste automatizado cobrindo o caso todo. Esta correção resolve especificamente o bug
REPRODUZIDO (client-side, `ehMsgDoCliente`, a fonte da frase "cliente esperando resposta"). Os
outros pontos continuam pendentes de decisão do dono — ver `NOTAS-v955.md` e
`REVISAO-COMPLETA.md`.

## Verificação

- `npm test` verde, incluindo o teste novo.
- Novo teste `tests/v970-nome-corretor-dinamico-cerebro.test.mjs`: reproduz o cenário do print
  (corretor com nome completo configurado no Cérebro, autor da mensagem não bate com o hardcoded
  exato) e confirma que a mensagem do corretor não vira "fala do cliente"; confirma que mensagem
  real do cliente continua reconhecida; confirma que o fallback hardcoded segue funcionando sem
  Cérebro configurado; confirma prioridade correta em caso de nome ambíguo.
- Teste antigo `tests/v921-mensagem-manual-nao-e-cliente.test.mjs` (mensagem copiada não vira
  "fala do cliente") continua verde.
- `node --check app.js` OK.

## Arquivos
- `app.js` (`ehMsgDoCliente`),
  `tests/v970-nome-corretor-dinamico-cerebro.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v970.md`, versão **969 → 970**.
