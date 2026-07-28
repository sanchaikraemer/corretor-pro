# NOTAS v1056 — revisão dos prompts do Cérebro usando uma conversa real como caso de teste

## O pedido

"vamos rever a analise de cliente (prompts do cerebro)" — com uma conversa real de WhatsApp em
anexo (lead da Construtora Senger, interessada no Renaissance) — seguido de "quero saber pq a
analise do corretor pro nao é a mesma q d chat gpt" e, depois de eu mostrar o texto fixo do
sistema, o dono colou o conteúdo real salvo no Cérebro dele (Método, Tom de voz, Diferenciais,
O que evitar).

## Achados reais, cruzando o texto fixo do sistema com o Cérebro do dono e a conversa da Karine

1. **"Reserva de unidade" contradizia o próprio Cérebro do dono.** O piso comercial fixo
   (`INTELIGENCIA_CARTEIRA`) dizia "reserva só com negociação avançada", enquanto o "O que evitar"
   do dono diz explicitamente "evite falar em reserva de unidade, não fizemos isso normalmente".
   O sistema já dava prioridade ao Cérebro em caso de conflito, mas depender do modelo resolver
   esse empate sozinho, toda análise, era desnecessário — a frase saiu do texto fixo.

2. **"Investir" é ambíguo e ninguém avisava a IA disso.** Na conversa real, a cliente disse "se
   formos investir, vai ser mais pra frente" — um jeito comum de dizer "se a gente topar comprar",
   sem necessariamente indicar perfil de investidor. O próprio atendimento real bateu nessa
   armadilha (respondeu com um produto de investimento pra alguém que só usou a palavra de
   passagem). O Método do dono já manda descobrir "moradia ou investimento" quando não estiver
   claro (regra 8) — o piso fixo agora reforça que essa palavra sozinha não fecha a resposta.

3. **Foto, vídeo e PDF enviados pelo corretor somem inteiramente da conversa que a IA lê.**
   `parseWhatsappTxt` descartava a linha inteira de qualquer anexo de imagem/vídeo/documento — não
   só o conteúdo (que já era certo não tentar adivinhar), mas o **fato** de que algo foi enviado
   naquele momento. Na conversa da Karine isso aconteceu 5 vezes, incluindo o vídeo e a foto do
   apartamento enviados na hora em que ela perguntou da infraestrutura do prédio. Isso ia direto
   contra a regra 2 do Método do dono ("não afirme que um material foi enviado se o envio não
   estiver claramente registrado") — o sistema apagava o registro antes da regra ter chance de
   valer. Agora fica um marcador factual (ex.: "[Arquivo enviado nesta mensagem: vídeo — conteúdo
   não analisado pela IA]") no lugar da linha removida — sem inventar o conteúdo, só preservando o
   fato do envio.

4. **Pedido específico do cliente sem resposta direta não ficava registrado em nenhum campo.**
   Na conversa real, a cliente pediu "opções prontas com 2 quartos" e a resposta ofereceu outro
   produto (investimento) e depois o Renaissance (na planta) — nenhum dos dois era o que foi
   pedido. O diagnóstico já tinha um campo pra "promessa do corretor não cumprida", mas não pra
   "pedido do cliente que a resposta não atendeu direto". Novo campo `pedidoSemResposta` no
   diagnóstico, com instrução própria no prompt, mapeado no resultado (padrão `"Nenhum"` quando não
   há pedido em aberto) e uma linha nova na tela do lead ("Pedido do cliente ainda sem resposta
   direta", escondida quando não há nada pendente).

5. **A regra de retomada do dono não tinha nenhum número real pra comparar.** A regra 5 do Método
   ("RETOMADA OBRIGATÓRIA APÓS DIAS DELIMITADOS NO PRÓPRIO SISTEMA") fala em "o prazo de dias"
   sem nunca dizer qual — o sistema não fornecia nenhum prazo configurado pro modelo comparar com
   os dias corridos desde a última interação. O dono confirmou usar o mesmo número já configurado
   em "Descanso após atender" (`diasDescansoPosAtendimento`, 7 no caso dele). Esse campo existia no
   sanitizador de `api/cerebro-config.js` mas não no sanitizador equivalente de `api/_pipeline.js`
   (o que realmente alimenta `analyzeWithBrain`) — por isso o valor salvo nunca chegava no prompt.
   Agora chega, como "Prazo configurado pelo corretor para reconhecer intervalo/retomada: N dias
   corridos", com o mesmo padrão de 5 dias e o mesmo teto de 60 usado no resto do sistema.

## O que NÃO mudou

O conteúdo do Método/Tom/Diferenciais/Evitar salvos pelo dono continua intocado — essa sessão não
tem acesso ao banco (Supabase) pra editar o que ele escreveu. A regra 5 do Método dele continua com
o texto "o prazo de dias" sem o número — o item 5 acima resolve isso fornecendo o número real no
prompt técnico (o modelo passa a ter o que precisa pra aplicar a regra), mas o próprio texto da
regra, se ele quiser deixar mais explícito, precisa ser editado por ele na tela do Cérebro.

## Testes

- `tests/v1056-cerebro-midia-prazo-e-pedido-sem-resposta.test.mjs` (novo): cobre os 5 achados —
  ausência de "reserva" e presença do aviso de "investir" no texto fixo e no prompt vivo enviado
  ao modelo; PDF/vídeo/imagem preservando um marcador factual em vez de sumir (e áudio continuando
  com o comportamento antigo, sem virar marcador); prazo configurado chegando no prompt (com
  padrão 5 e teto 60); campo `pedidoSemResposta` pedido à IA, mapeado no resultado e com padrão
  `"Nenhum"`; e a linha nova aparecendo em `cp704DetailRows` (app.js).
- `npm test`: suíte inteira verde (`node --check` em todos os arquivos de API + suíte completa).

## Arquivos

`api/_pipeline.js` (`INTELIGENCIA_CARTEIRA` sem "reserva" e com aviso de "investir";
`parseWhatsappTxt` preserva marcador de mídia; `sanitizeCerebroConfig` interno ganha
`diasDescansoPosAtendimento`; `analyzeWithBrain` injeta o prazo configurado no prompt, pede e mapeia
`diagnostico.pedidoSemResposta`), `app.js` (`cp704DetailRows` ganha a linha "Pedido do cliente ainda
sem resposta direta"), `tests/v1056-cerebro-midia-prazo-e-pedido-sem-resposta.test.mjs` (novo),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1056.md`, versão
**1055 → 1056**.
