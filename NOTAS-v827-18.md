# v827-18 — resgata o conteúdo real da IA em vez de descartar tudo pro fallback genérico

## O problema

Um corretor comparou uma sugestão de mensagem do Corretor Pro (que veio do fallback
determinístico da v827-12) com a mesma conversa colada direto no ChatGPT. O ChatGPT
produziu uma mensagem específica, referenciando a pergunta real que tinha ficado em
aberto ("pronto pra morar ou na planta") e oferecendo uma alternativa concreta. O
Corretor Pro devolveu um texto genérico: "Vi que ficamos de conversar sobre
Apartamento de 3 suítes no Renaissance (construtora). Como você quer seguir a partir
daqui?".

Investigando: a IA do pipeline (`analyzeWithBrain`, `api/_pipeline.js`) tinha, sim,
gerado 3 mensagens — só que 2 delas reprovaram na regra objetiva do Cérebro que exige
"exatamente uma pergunta, terminando a mensagem" (`validarMensagensCerebro`). Depois de
2 tentativas de correção automática (`corrigirMensagensPelasRegras`) sem sucesso, a
v827-12 descartava o rascunho da IA por completo e substituía as 3 mensagens pelo
fallback 100% mecânico (`construirMensagensDeterministicasCerebro`) — que nunca lê o
motivo real da pendência, só monta frases genéricas a partir de fatos soltos do
diagnóstico. Ou seja: o fallback existe pra nunca travar a análise (correto), mas
estava sendo acionado — e jogando fora conteúdo bom — por causa de reprovações que
eram só de FORMATAÇÃO, não de conteúdo.

## A correção

- `sanitizarMensagemDeterministica` (`api/_pipeline.js`) passou a:
  - remover uma saudação que já viesse no início do texto recebido, antes de reaplicar
    a saudação correta uma única vez — necessário porque agora essa função também roda
    em cima de rascunhos reais da IA (que já podem vir com "Boa noite..." próprio),
    não só nos templates do fallback (que nunca tinham saudação embutida);
  - normalizar corretamente a contagem de perguntas: qualquer "?" vira "." e uma única
    "?" é reaposta no final, não importa se o texto original tinha zero, uma (fora do
    final) ou várias interrogações. A versão antiga só cortava quando havia MAIS de uma
    "?", então um texto com uma única pergunta fora do final ("Prefere pronto ou na
    planta? Me conta mais.") escapava ileso e ganhava uma segunda "?" ao final — virando
    duas e reprovando de novo à toa.
- `analyzeWithBrain`: quando a validação das 3 mensagens da IA falha mesmo após as
  tentativas de correção, antes de acionar o fallback 100% genérico o pipeline agora
  tenta primeiro **consertar só a formatação** do próprio rascunho da IA (mesma função
  `sanitizarMensagemDeterministica`, reaproveitada) e revalida. Se o reparo for
  suficiente, usa esse resultado — que ainda é o conteúdo real e específico da IA — e
  não marca `mensagensGeradasPorFallback` nem guarda `motivoFallbackMensagens` (deixou
  de se aplicar: a mensagem exibida não é mais a que foi reprovada). Só quando o reparo
  de formatação não resolve (ex.: mensagem vazia, duplicada, ou com dado numérico
  inventado — problemas de CONTEÚDO, não de formato) é que o fallback mecânico
  continua entrando, exatamente como antes.

## Por que isso não enfraquece nenhuma regra do Cérebro

Nenhuma regra objetiva mudou de critério — a mensagem final ainda precisa passar
exatamente na mesma validação (`validarMensagensCerebro`) de sempre. A diferença é
só ONDE o conserto acontece: em vez de jogar fora um rascunho bom por causa de um
detalhe de formatação e substituir por texto genérico, o pipeline tenta primeiro
aparar esse detalhe no próprio texto da IA. O fallback determinístico continua
existindo como rede de segurança final, sem mudanças no comportamento dele.

## Validação

- Versão interna: `7.127.18`. Versão exibida: `827-18`.
- Novo teste `tests/v827-18-resgate-mensagens-ia.test.mjs`:
  - regressão direta do bug de contagem de perguntas (uma "?" fora do final não pode
    virar duas depois do reparo);
  - uma saudação já presente no rascunho da IA não pode duplicar;
  - o conteúdo real da IA (nome do cliente, produto) precisa sobreviver ao reparo;
  - confirma por ordem no código-fonte que a tentativa de reparo (`validacaoReparo`)
    vem antes do fallback 100% genérico (`construirMensagensDeterministicasCerebro`).
- Suíte completa (38 conjuntos) sem erro.

## Próximo passo

Se mesmo com o reparo de formatação o fallback genérico continuar aparecendo com
frequência, o próximo ponto a investigar é o PROMPT de geração/correção das mensagens
(`systemPromptAnalise` e `corrigirMensagensPelasRegras`) — pode faltar um exemplo
explícito de como terminar com uma pergunta específica sem soar telegráfico, pra IA
acertar de primeira com mais frequência e precisar cada vez menos de qualquer reparo.
