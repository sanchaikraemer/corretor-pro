# Corretor Pro v743 — Unidade escolhida pelo contexto

Correção da regra de unidade na simulação financeira.

## Ajuste principal

A IA não deve priorizar número fixo de unidade quando houver mais de uma unidade citada na conversa.

Agora a regra correta é:

- identificar qual unidade o cliente realmente escolheu ou consolidou como preferência;
- não comparar unidades apenas porque foram citadas no histórico;
- usar como base a unidade vinculada ao próximo passo comercial, simulação ou proposta;
- analisar elogio, preferência, continuidade da negociação e vínculo com a simulação.

## Caso Inaie

No contexto da Inaie, a unidade base é o 1302 porque ela consolidou essa preferência na conversa. O 1402 não deve aparecer como comparação automática.

Mensagem esperada:

> Inaie, vi que ficou pendente da minha parte a simulação do Renaissance considerando o 1302, sem o box, com parcelas próximas dos R$ 4 mil. Vou atualizar os valores e te envio uma composição com entrada, mensais, reforços e saldo para vocês avaliarem.

## Arquitetura

- v743-unidade-escolhida-pelo-contexto
