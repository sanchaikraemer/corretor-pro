# Atualização v732 — Prompt com mudança de jornada

Ajuste do motor de análise comercial para identificar quando o cliente muda de jornada durante o histórico.

## O que mudou

- Detecta mudança de produto principal, finalidade, faixa de valor, padrão ou tipo de imóvel.
- Trata retorno por novo anúncio após tempo parado como novo fato comercial importante.
- Evita conduzir direto para visita/proposta quando o cliente apenas perguntou valor de um novo produto.
- Obriga a IA a identificar produto anterior e produto atual.
- Gera 3 sugestões diferentes quando houver mudança de jornada:
  1. Entender o motivo da mudança.
  2. Redefinir o objetivo atual.
  3. Direcionar a venda conforme o objetivo.

## Exemplo de comportamento esperado

Se o cliente começou em sala comercial/Premium Office e depois voltou por anúncio de apartamento/Personalité perguntando valor, a IA não deve tratar como simples venda do apartamento nem como retomada antiga da sala. Deve usar a mudança como gancho e descobrir se o objetivo atual é moradia, investimento, comparação ou curiosidade.

## Arquivos alterados

- api/_pipeline.js
- app.js
- package.json
- package-lock.json
