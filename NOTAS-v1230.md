# v1230 — sugestões não podem repetir o que já foi dito na conversa

Print do dono, 12/08/2026 (conversa com o Pablo): as 3 sugestões de mensagem repetiram o que já
tinha sido dito. A "Recomendada" pedia pra confirmar o prazo de 90 dias que o **próprio corretor
tinha acabado de perguntar** (última mensagem dele, ainda sem resposta por escrito — o cliente
tinha reagido só com 👍, e reação não vem no arquivo exportado do WhatsApp), e a "Direta ao
ponto" pedia a data de entrega que o **cliente já tinha respondido** ("Dia 06/08 início").

## O que existia e o que faltava

As instruções que geram as sugestões já proibiam parentes disso: repetir pedido de permissão
quando o cliente já disse "sim", e recitar de volta os números/unidades que o cliente citou. Mas
não havia regra dura contra **repetir uma pergunta já feita ou já respondida** — e a regra de
"retomar pergunta em aberto" até incentivava trazer a pergunta de volta, sem deixar claro que
retomar não é repetir.

## A regra nova (nas instruções da análise)

**NÃO REPETIR O QUE JÁ FOI DITO — REGRA DURA**, com três frentes:

1. Informação que o **cliente já respondeu** em qualquer ponto da conversa (data, prazo, valor,
   escolha) não pode ser perguntada de novo em nenhuma das três mensagens — a mensagem usa o dado
   e avança a partir dele.
2. Se a **última fala do corretor** já é uma pergunta ainda sem resposta, nenhuma das três pode
   reescrever a mesma pergunta como se fosse nova. Quando o momento pedir retomada, a mensagem se
   apoia nela explicitamente ("conseguiu ver aquele prazo que te perguntei?") ou avança por outro
   ângulo — nunca a repetição literal nem a parafraseada.
3. Afirmações que o corretor já fez na conversa não voltam reescritas como novidade.

A regra de "retomar pergunta em aberto" continua valendo (retomar o que ficou no ar segue sendo o
passo que mais destrava conversa), agora remetendo explicitamente à regra nova: retomar ≠ repetir.

## Proteção pra não voltar

`tests/v1230-nao-repetir-o-que-ja-foi-dito.test.mjs` prende as três frentes da regra e a ponte
com a regra de retomada no prompt da análise.
