# Corretor Pro — Atualização 818

## Fila de prioridades: atendimento é respeitado

- Ao marcar atendimento, o lead descansa de verdade e não volta pra fila de prioritários
  no dia seguinte.
- Antes, um lembrete vencido furava a proteção de 5 dias e o lead reaparecia como "agora"
  mesmo tendo acabado de ser atendido. Agora o atendimento recente silencia inclusive o
  lembrete vencido, desde que o atendimento tenha acontecido depois que o lembrete venceu.

## Tela do lead

- O resumo do cliente aparece inteiro, sem cortar com "..." (havia um limite de 180
  caracteres). Há espaço de sobra no card.
- A etapa da negociação passou a ter nome fácil de entender, com o passo na jornada e cor
  que esquenta pro verde conforme aproxima o fechamento:
    1 de 6 — Conhecendo (cinza)
    2 de 6 — Interessado (azul)
    3 de 6 — Comparando opções (ciano)
    4 de 6 — Vendo se cabe no bolso (verde-água)
    5 de 6 — Negociando (verde)
    6 de 6 — Decidindo (verde vivo)
  Vendido aparece em verde; Perdido e Arquivado em tom neutro.

## Estabilidade

- O lead aberto não volta mais sozinho pra Home. O detalhe do lead é renderizado dentro
  da tela Hoje, então o auto-refresh (a cada 3 minutos e ao voltar a aba) disparava mesmo
  com o lead aberto e reescrevia a área. Agora esse refresh só roda quando você está de
  fato na Home, com uma proteção extra pra o fallback da Home nunca sobrescrever um lead
  aberto.

## Validação

- Versão interna: `7.118.0`.
- Versão exibida: `818`.
- Testes de sintaxe e regressão concluídos, incluindo o novo `tests/v818-fixes.test.mjs`.
- Build limpo concluído.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
