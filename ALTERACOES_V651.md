# Alterações V651

## Objetivo

Eliminar os travamentos causados pelo transporte e pela renderização simultânea do histórico de todos os leads, sem cortar nenhuma mensagem.

## Arquitetura aplicada

- `GET /api/leads-recentes`: retorna a carteira leve, com prévia das 8 mensagens mais recentes, `messageCount` e `hasProposal`.
- `GET /api/lead-update?action=detalhe&id=...`: retorna um único lead com o histórico completo.
- O front abre o lead imediatamente com os dados já carregados e atualiza a tela quando o detalhe completo chega.
- O histórico é renderizado em páginas de 100 mensagens.
- Exportações e cópia do histórico solicitam o detalhe completo sob demanda.

## Resultado esperado

Trocas de tela e cliques em cards deixam de baixar e processar a conversa inteira de toda a carteira. O histórico completo continua disponível em cada lead.
