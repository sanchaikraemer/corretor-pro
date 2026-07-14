# Corretor Pro — Atualização 824

## Correção: lead atendido não volta mais pra prioridade na Home

- A Home, quando entra no modo de segurança, montava a lista com os primeiros leads
  crus (sem aplicar nenhuma regra de prioridade). Por isso um lead atendido no dia
  anterior reaparecia como "Atendimentos prioritários".
- Agora o modo de segurança também respeita a categoria real: só entra quem é "agora"
  (precisa de ação). Lead atendido recentemente (proteção de 5 dias -> "aguardando") não
  aparece mais na lista de prioridade.

## Validação

- Versão interna: `7.124.0`.
- Versão exibida: `824`.
- Novo teste `tests/v824-fallback-prioridade.test.mjs`.
- Simulação da cadeia completa (categoria real + filtro do modo de segurança) confirma:
  lead atendido = "aguardando" = fora da prioridade; lead que precisa de ação = "agora" = na prioridade.
- Testes de sintaxe e regressão concluídos; build limpo.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
