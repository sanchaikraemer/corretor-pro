# v1369 — interesse positivo sem qualificação financeira

## O problema

No histórico real do Julsimar, o cliente já tinha visto o material, disse que gostou da ideia e informou que já conhecia aproximadamente as condições de pagamento. Depois de receber as condições completas, respondeu apenas "Joia." a uma pergunta aberta do corretor.

A leitura comercial correta não é voltar a perguntar se ele gostou, se ficou com dúvida ou se quer mais material. Também não há objeção confirmada. O atendimento está interessado, mas ainda sem a informação financeira que permite selecionar e montar uma proposta objetiva.

## O que mudou

- O fichário comercial agora reconhece o padrão geral **interesse positivo + pagamento já em pauta + faixa de valor ainda desconhecida**.
- Respostas curtas de cortesia como "Joia", "ok" e "beleza", quando vêm depois de uma pergunta genérica, são identificadas como reconhecimento da conversa, não como resposta comercial útil.
- Números de telefone presentes em respostas automáticas do WhatsApp (ex.: “em caso de urgência, ligar para...”) deixam de ser confundidos com faixa de valor/orçamento do cliente.
- Nesse estágio, a IA recebe orientação factual para não repetir pergunta aberta nem voltar a dúvidas/material genérico.
- A prioridade sugerida passa a ser descobrir **faixa de valor/orçamento**; depois, se ainda faltar, entrada disponível e capacidade/forma de pagamento, sem transformar a conversa em interrogatório.
- Nenhum cliente, produto, preço ou condição foi cravado como regra: o detector usa apenas o padrão da conversa e continua válido para outras carteiras e corretores.

## Regressão

Adicionado `tests/v1369-julsimar-qualificacao-comercial.test.mjs` com o histórico real que revelou o problema.
