# Corretor Pro — v730

## Ajuste principal

Atualização final do prompt de análise comercial e das regras de geração das 3 sugestões.

## O que mudou

- Substituído o prompt antigo por um prompt único, mais rígido e comercial.
- A análise agora deve ler toda a conversa e gerar diagnóstico antes das mensagens.
- A IA deve identificar:
  - última pessoa a falar;
  - último compromisso do cliente;
  - última informação prometida pelo corretor;
  - produto principal;
  - produtos paralelos;
  - objeção explícita ou ausência de objeção;
  - pendência financeira;
  - quem deve agir agora;
  - etapa do funil;
  - probabilidade de venda;
  - tempo de conversa parada.
- Conversas paradas há mais de 7 dias agora devem gerar retomadas contextuais, não continuidade como se a conversa fosse recente.
- As 3 sugestões passam a ter ganchos diferentes:
  1. Retomar o compromisso.
  2. Facilitar a decisão.
  3. Reativar com objetividade.
- Quando a conversa não estiver parada, as 3 sugestões seguem lógica diferente:
  1. Avanço direto.
  2. Consultiva.
  3. Natural/leve.

## Regras reforçadas

- Não inventar objeção.
- Não perguntar o que já foi respondido.
- Não perguntar se ainda há interesse.
- Não usar frases genéricas de retomada.
- Não usar emojis.
- No máximo uma pergunta por mensagem.
- Cada pergunta deve mover a venda para frente.
- Não oferecer condição, financiamento, desconto, troca ou outro produto sem base no histórico, catálogo ou regra ensinada pelo corretor.

## Arquivos alterados

- `api/_pipeline.js`
- `api/reanalisar-lead.js`
- `package.json`
- `package-lock.json`
- `NOTAS-v730.md`
