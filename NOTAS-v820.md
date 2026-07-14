# Corretor Pro — Atualização 820

## Produto: preenche sozinho quando o cliente cita o empreendimento

- Quando a IA deixava o produto em branco, o lead mostrava "Não identificado" mesmo com
  o cliente tendo citado claramente o empreendimento (ex.: Boulevard Residence).
- Agora, se a IA não preencher o produto, o sistema busca o empreendimento REALMENTE
  citado na conversa a partir do catálogo oficial (só nomes reais — nunca inventa) e usa
  ele como produto.
- Vale para novas análises e reanálises. Em um lead já analisado antes, toque em
  "Reanalisar" para o produto ser preenchido.

## Validação

- Versão interna: `7.120.0`.
- Versão exibida: `820`.
- Novo teste comportamental `tests/v820-produto-empreendimento.test.mjs`: roda a função de
  verdade e confirma que "Boulevard Residence" e "Renaissance" são detectados na conversa,
  que o nome mais específico vence e que nada é inventado quando nenhum empreendimento é
  citado.
- Testes de sintaxe e regressão concluídos; build limpo.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
