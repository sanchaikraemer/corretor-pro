# v765 — IA ignorava a pergunta que o corretor já tinha feito

## O problema (relatado pelo usuário com conversa real)

Na conversa com a Marina, a última mensagem era do corretor perguntando se ela teria uma contrapartida financeira para a troca de apartamento — pergunta ainda sem resposta da cliente. As 3 sugestões de mensagem geradas, porém, ignoravam essa pergunta pendente e voltavam a oferecer "mostrar opções de apartamento menor com 3 quartos" como se fosse o primeiro contato — exatamente o que o próprio Cérebro instrui a NÃO fazer ("não reinicie a venda", "não pergunte o que já foi respondido").

## Causa raiz

O prompt de análise (`analyzeWithBrain` em `api/_pipeline.js`) pedia um diagnóstico com vários campos (`ultimoCompromissoCliente`, `quemDeveAgirAgora` etc.), mas nenhum deles obrigava a IA a identificar explicitamente "o corretor fez uma pergunta e ainda não foi respondida" — então o modelo, sem essa âncora, gerava mensagens genéricas de reengajamento em vez de cobrar a resposta pendente.

## O que foi corrigido

- Novo campo obrigatório no diagnóstico: `perguntaAbertaSemResposta` — a pergunta exata do corretor que ficou sem resposta, quando ele foi o último a falar.
- Nova regra explícita no início do prompt (independente do Cérebro configurado pelo usuário): se o corretor foi quem falou por último com uma pergunta, as 3 mensagens sugeridas têm que cobrar exatamente essa pergunta antes de qualquer coisa — nunca "recomeçar" oferecendo o que já foi oferecido.
- O campo aparece agora também em "Detalhes comerciais" na tela do lead, como "Pergunta pendente sua", pra dar visibilidade de que a IA identificou certo.

## Testes

- `npm test` passou.
- `npm run build` passou.
- Não foi possível rodar a reanálise real (sem credenciais de OpenAI/Supabase neste ambiente) — validar reanalisando o lead da Marina em produção.
