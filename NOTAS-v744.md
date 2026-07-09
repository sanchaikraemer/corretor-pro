# v744 — unidade escolhida sem alternativa aberta

Correção sobre o caso Inaie/Renaissance:

- Remove a lógica errada de escrever “1302 ou 1402” quando a conversa já consolidou uma unidade para a simulação.
- A IA deve identificar a unidade escolhida pelo contexto, não por número fixo.
- Se houver unidade consolidada, as sugestões e o próximo passo citam apenas essa unidade.
- Se não houver segurança, o sistema não inventa número e usa “a unidade que vocês ficaram de avaliar”.
- Bloqueia mensagens de compromisso do corretor com “ok”, “tudo certo?” ou nova confirmação desnecessária.
- Mantém a regra: se o corretor ficou devendo simulação, ele assume a ação.

Teste esperado no caso Inaie:

> Inaie, vi que ficou pendente da minha parte a simulação do Renaissance considerando o 1302, sem o box, com parcelas próximas dos R$ 4 mil. Vou atualizar os valores e te envio uma composição com entrada, mensais, reforços e saldo para vocês avaliarem.
