# Corretor Pro — Atualização 822

## Ajuste do topo e das ferramentas na tela do lead

- Topo em 2 cards com o tamanho certo: o card do lead (esquerda) ficou maior e o da
  observação (direita) menor.
- "Ferramentas e ações" saiu do accordion e agora fica aberta no rodapé do lead, com
  todos os botões lado a lado, em largura total.
- "Últimas mensagens" continua sendo o único bloco que abre/fecha (com a setinha).
- "Editar lead" fica só na barra de ações, sem duplicar nas ferramentas.

## Validação

- Versão interna: `7.122.0`.
- Versão exibida: `822`.
- Novo teste `tests/v822-layout-lead.test.mjs`: confirma o card esquerdo maior, as
  ferramentas abertas no rodapé, "Últimas mensagens" ainda com setinha e a observação única.
- Testes de sintaxe e regressão concluídos; build limpo.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
