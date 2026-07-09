# v737 — Lapidação de linguagem das sugestões

Ajuste pequeno sobre a v736, sem alterar a lógica comercial aprovada.

## O que mudou
- Mantém a diferença entre mudança de jornada real e direcionamento comercial do corretor.
- Mantém retomada contextual quando existe histórico antigo.
- Reduz repetição mecânica do produto completo nas três sugestões.
- Usa nomes curtos e naturais, como `o Personalité`, `a Premium Office` e `o Renaissance`.
- Remove frases negativas como `opções que não tenham relação`.
- Ajusta fallbacks para WhatsApp mais natural.

## Testes esperados
- Eder: retomada + mudança de jornada, sem convite direto para visita antes de descobrir objetivo.
- Silvana: direcionamento comercial do corretor, retomando o Personalité e a pendência com o esposo, sem perguntar de novo moradia/investimento.
