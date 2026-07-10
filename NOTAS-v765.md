# v765 — Análise comercial usa o modelo bom, não o rápido

## O problema (relatado pelo usuário com exemplo real)

Comparando a mesma conversa (Marina) analisada pelo Corretor Pro vs. colada direto no ChatGPT com a própria chave: o ChatGPT lia a conversa, entendia que a última pergunta do corretor (sobre contrapartida financeira na troca do apê) ainda estava sem resposta, recomendava esperar a cliente responder antes de insistir, e gerava 3 mensagens de retomada naturais e coerentes entre si. O Corretor Pro, na mesma conversa, ignorava a pergunta pendente e sugeria mensagens genéricas de reabordagem, como se fosse o primeiro contato.

## Causa raiz

`analyzeWithBrain` (usado tanto na importação quanto no botão "Reanalisar agora") estava chamando a IA com `modeloAnaliseRapida()` — `gpt-4o-mini`, o modelo rápido/barato pensado para não estourar tempo durante importação em lote. Só que esse modelo mais simples é significativamente pior em raciocínio comercial do que o modelo principal (`gpt-4.1`) que o resto do app já usa — e o próprio código já dizia, no comentário de `modeloMensagens()`, que "diagnóstico e mensagens usam o mesmo modelo [principal]", mas a implementação usava outro. Nenhuma quantidade de regra extra no prompt compensa um modelo mais fraco.

Uma tentativa anterior (nesta mesma sessão) tentou compensar isso adicionando uma regra explícita e um campo obrigatório no JSON pedindo pra IA identificar "pergunta pendente do corretor". Path errado: regra de código rígida em cima de um modelo fraco, exatamente o tipo de remendo que o app já tem demais (vários `mensagensFallback*` em `api/_pipeline.js` usando match de frase). Foi revertido.

## O que foi corrigido

- `analyzeWithBrain` agora usa `modeloAnalise()` (`gpt-4.1`) na chamada principal de diagnóstico + mensagens, tanto na importação quanto na reanálise manual. Isso está dentro do limite de 60s da function (é uma conversa por chamada, não lote).
- A segunda tentativa (só acontece se a primeira falhar tecnicamente — timeout/erro) continua usando o modelo rápido, como rede de segurança, com contexto mais curto.
- O prompt voltou a ser enxuto: sem lista numerada de regras nem campo extra no JSON — só uma frase orientando a IA a ler a conversa como um corretor experiente leria, prestando atenção em quem falou por último. Confiar no modelo bom para interpretar, em vez de empilhar regras de código.

## Testes

- `npm test` e `npm run build` passaram.
- Não foi possível rodar a reanálise real aqui (sem credenciais de OpenAI/Supabase neste ambiente). Validar reanalisando o lead da Marina em produção e comparando com o exemplo do ChatGPT.
