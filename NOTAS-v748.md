# Corretor Pro — v748

Correção de rumo: remoção do prompt comercial e das regras/fallbacks que estavam competindo entre si.

## Alterações

- Removido o prompt comercial longo da análise.
- Removido o bloco de regras comerciais injetado no prompt.
- Removida a lista de termos proibidos aplicada pelo validador da análise.
- Removido fallback comercial local que inventava produto, unidade, simulação ou próximo passo.
- A IA passa a receber somente:
  - metadados mínimos do lead para identificação;
  - conversa completa como fonte comercial;
  - pedido técnico para retornar JSON compatível com o app.
- Removido o bloco “Atendidos hoje” da tela principal/home.
- Atualizada arquitetura das mensagens para `v748-sem-prompt-sem-regras`.

## Observação

Ainda existe uma instrução técnica mínima para a API retornar JSON no formato que o front entende. Não há mais prompt comercial orientando estratégia, hierarquia, regras de produto, retomada, mudança de jornada ou fallback de mensagem.

## Testes

- `npm test` passou.
- `npm run build` passou.
- Build gerou Atualização #748.
