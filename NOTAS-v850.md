# v850 — o Cérebro Comercial passa a ser a ÚNICA autoridade sobre as mensagens

## Contexto

O corretor mostrou, em três prints seguidos, a análise **desobedecendo o Cérebro**:
mensagens começando com "Olá"/"Oi" (proibido — era pra ser "bom dia"), usando frases
genéricas ("Passando para saber", "Só passando", "Se quiser") e sem terminar em pergunta.

Investigando, encontramos DOIS defeitos no código, ambos comprovados rodando o Cérebro
real do corretor pelo motor:

1. **O parser de regras estragava as regras do corretor.** A regra "Não use 'faz x dias
   que conversamos', então diga 'faz alguns dias que conversamos'" fazia o código guardar
   como **proibidas** as DUAS frases — inclusive a que o corretor mandou usar. E como ele
   guardava a string literal "faz x dias que conversamos" (com o "x"), a mensagem real
   "faz 24 dias" passava batida.
2. **O código tinha regras comerciais próprias**, cravadas no prompt e no pós-processamento,
   competindo com o Cérebro (regras de tempo, saudação, "não use frase genérica", modo
   retomada, fallback determinístico que trocava tudo por texto genérico).

Decisão do corretro (dono do produto): **tirar TODA a lógica de regra do código. Só o
Cérebro editável manda.** A regra anti-invenção (não inventar valor/data/informação que
não está na conversa) foi movida para o texto do Cérebro (prompt), não para o código.

## O que mudou (`api/_pipeline.js`, função `analyzeWithBrain` e adjacências)

**Item 1 — removido o motor de regras do código (411 linhas apagadas):**
`compilarRegrasObjetivasCerebro`, `validarMensagensCerebro`,
`aplicarCorrecoesDeterministicasCerebro`, `corrigirMensagensPelasRegras`,
`sanitizarMensagemDeterministica`, `construirMensagensDeterministicasCerebro`, mais os
helpers exclusivos deles (`ancorasDaConversa`, `fatosMonetarios`, `valorNumericoProximo`,
`PADROES_GENERICOS_RETOMADA`, `STOPWORDS_ANCORA`, etc.). As três mensagens da IA agora vão
**direto** para o resultado, sem reprocessamento, validação, correção ou fallback.

**Item 2 — removidas as regras comerciais cravadas no prompt:** saíram do `systemPrompt` e
do prompt principal as regras de tempo ("siga à risca (a)(b)(c)"), de adiamento, de
saudação, a lista de frases genéricas proibidas e o "Modo obrigatório: RETOMADA". Ficou só
o **operacional** (ler a conversa inteira, os fatos de data/dias, o formato JSON,
"não inventar no diagnóstico") — que não é regra de estilo, é como a IA é acionada.

**Item 3 — o Cérebro virou autoridade absoluta:** o `systemPrompt` agora abre com
"AUTORIDADE ABSOLUTA: o Cérebro foi escrito pelo corretor e manda em TUDO... nunca
contrarie... em qualquer conflito, o Cérebro vence", e o prompt reforça "as TRÊS MENSAGENS
devem seguir integralmente o Cérebro (autoridade máxima), sem exceção".

A única checagem que sobrou é **técnica, não de estilo**: a IA devolveu três mensagens
preenchidas? (`sugestoesPendentes`/`trioOk`) — serve só para a importação saber se precisa
tentar de novo. Os campos antigos de fallback (`mensagensGeradasPorFallback`,
`motivoFallbackMensagens`, etc.) continuam no retorno como valores inertes (`false`/`[]`)
para não quebrar quem os lê — o aviso amarelo de fallback simplesmente nunca mais aparece.

## Testes

- Removidos 7 testes que validavam o motor de regras agora inexistente
  (`v825-cerebro-obrigatorio`, `v827-12/14/17/18`, `v827-conhecimento`,
  `retomada-validator`).
- Novo `tests/v850-cerebro-autoridade.test.mjs`: garante que o motor de regras não volte —
  as funções não podem mais existir/ser exportadas, o código não pode mais mencioná-las,
  o prompt precisa declarar o Cérebro como autoridade absoluta, e a função factual de tempo
  (`calcularContextoTemporalMensagens`, que ainda alimenta o prompt) continua viva.
- `npm test`: 32 conjuntos verdes. `node build.js`: build limpo, versão 850.

## Limite de validação desta sessão (honesto)

Esta sessão **não tem a chave da OpenAI**, então não deu para testar a IA de verdade.
Está garantido que o código é válido, carrega e passa em toda a suíte. Quem confirma que a
IA passou a obedecer melhor é o corretor, **em produção**, depois de:
1. Colar o novo texto do Cérebro (enviado no chat) no campo "Método".
2. **Reanalisar** as leads antigas — os prints com erro eram análises SALVAS antigas; elas
   só pegam o comportamento novo quando reanalisadas.

## Verdade que fica

Com o Cérebro absoluto no prompt + um modelo forte + o código parando de brigar, a
obediência fica muito mais confiável e os erros dos prints param. Mas obediência por prompt
não é trava 100% mecânica (a única trava 100% seria código conferindo depois — que foi o
que removemos, porque estava estragando as regras). Se algum dia a IA escorregar, a
mensagem aparece como ela escreveu, para o corretor editar — nunca mais texto genérico,
nunca mais uma regra do corretor sendo estragada pelo código.
