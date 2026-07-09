# v752 — correção real de reanálise, legado e tema claro

## Correções técnicas
- Corrigido erro `leadIA is not defined` que impedia a IA de gerar análise/mensagens.
- Corrigida variável interna indefinida `contextoOrdemMaterial` no pós-processamento da análise.
- Arquitetura de mensagens atualizada para `v752-ia-direta-sem-legado`.
- Mensagens antigas de arquitetura anterior ficam bloqueadas até reanálise nova.
- Reanálise não reutiliza mais análise antiga quando o histórico não mudou.
- Reanálise não envia produto/unidade/nextAction antigos como metadados para IA.
- Fallback comercial local desativado no front: se a IA falhar, o app pede reanálise em vez de inventar mensagem.
- Tela não usa mais `diagnostico.mensagemQueEuEnviariaHoje` nem mensagem antiga como fallback para sugestão.

## Tema claro
- Corrigidos blocos remanescentes escuros na Preparação da carteira.
- Corrigido contraste dos cards/listas de leads no tema claro.
- Corrigido botão/progresso de reanálise no tema claro.
- Corrigida área “Mensagem ainda não gerada” no tema claro.

## Testes
- `npm test` passou.
- `npm run build` passou.
- Build gerou Atualização #752.
