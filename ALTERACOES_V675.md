# Alterações — Versão 675

- A atualização comercial não depende mais de uma única resposta da função de reanálise.
- Se a API principal responder sem o objeto atualizado, o app relê o lead no banco antes de considerar falha.
- Persistindo a incompatibilidade, o app consolida os fatos determinísticos e grava por uma rota independente.
- Nova ação `analise-comercial-set` valida e persiste a análise comercial no servidor.
- O schema comercial passa para 675 em reanálises, novas oportunidades e fallback.
- O botão só informa sucesso depois de receber a análise efetivamente persistida.
- Oportunidade encerrada continua sem mensagem, sem lembrete e sem prioridade indevida.
- Cache PWA atualizado para a versão 675.
