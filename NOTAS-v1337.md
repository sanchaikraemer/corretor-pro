# v1337 — fatos primeiro, IA depois

## O problema

O sistema já tinha vários detectores bons no fichário, mas eles eram chamados como peças separadas.
Isso deixava a leitura, a redação e a conferência das mensagens dependentes de blocos soltos e ainda
obrigava a IA a redescobrir respostas óbvias em conversas longas.

Também havia uma falha objetiva nas promessas do corretor: uma promessa composta como "te mando o
valor, as fotos e as condições" podia ser considerada cumprida porque QUALQUER entrega aparecia logo
depois, mesmo que o valor continuasse faltando.

## O que mudou

1. **Estado comercial determinístico único**
   - `montarEstadoComercialDeterministico()` calcula uma vez os fatos da conversa.
   - o mesmo estado alimenta o fichário, as duas etapas da IA e a conferência final das mensagens.
   - não muda regra comercial e não reescreve mensagem; só organiza fatos.

2. **Tópicos já respondidos pelo cliente**
   - respostas explícitas passam a ser classificadas em tópicos como dormitórios, finalidade,
     pronto/planta, faixa de valor, financiamento, entrada, permuta, garagem, metragem, prazo e decisor.
   - cada tópico guarda a fala original e a data como prova.
   - pergunta do cliente não vira preferência por inferência.
   - o fichário passa a avisar claramente quais perguntas genéricas não devem ser repetidas.

3. **Promessas conferidas pelo conteúdo**
   - promessa composta só é fechada quando todos os itens identificáveis aparecem depois.
   - oferta condicionada à escolha do cliente (ex.: “o que prefere receber primeiro?”) não vira pendência automática.
   - o fichário mostra o que ainda está faltando (valor, fotos, planta, condições etc.).

4. **Conferência das três mensagens**
   - se a IA volta a perguntar genericamente algo já respondido (ex.: "2 ou 3 dormitórios?"), o
     sistema gera aviso de qualidade.
   - pergunta de aprofundamento continua permitida (ex.: "os 3 precisam ser suítes?").

## Proteções

- o miolo do prompt NÃO foi alterado; a assinatura da bateria continua igual.
- nenhuma mensagem é reescrita por regra local.
- nenhum catálogo de outra conversa entrou no prompt.
- nenhuma regra nova de venda foi inventada.

## Testes desta versão

- novo: `tests/v1337-estado-comercial-deterministico.test.mjs`;
- compatibilidade conferida em v1317, v1323, v1329, v1332, v1334 e v1335;
- bateria estrutural das 32 conversas canônicas continua verde;
- porteiro do prompt v1327 continua verde, confirmando que o miolo não mudou.
