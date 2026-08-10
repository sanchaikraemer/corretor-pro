# v1199 — preço da assinatura recalibrado: Pro R$ 49,90 e Pro Master R$ 99,90

Enquanto montava o resumo executivo pra um sócio investidor (fora do sistema, um PDF à parte), o
dono me passou os valores R$ 49,90 (Pro) e R$ 99,90 (Pro Master) pra colocar no documento. Ao
conferir contra o que está de fato programado no Corretor Pro, o preço configurado ainda era o da
decisão anterior (03/08/2026): R$ 67 e R$ 97. Perguntei diretamente se era pra atualizar o sistema
também — o dono confirmou que sim, R$ 49,90/R$ 99,90 é o valor novo e vale pra valer, e autorizou
publicar.

(Esta atualização ia sair como "v1171" — número já em uso por outra rodada de trabalho que chegou
ao `main` entre o começo e o fim desta sessão, v1171 até v1198. Refeita em cima do código mais
recente, com o próximo número livre.)

## O que mudou

- `PRECOS_PLANOS` em `api/_pipeline.js`: `{ "pro": 67, "pro-master": 97 }` →
  `{ "pro": 49.9, "pro-master": 99.9 }`.
- `precoPlanoBR` passou a formatar sempre com duas casas decimais
  (`minimumFractionDigits`/`maximumFractionDigits: 2`) — com os valores antigos (inteiros, sem
  centavo) isso não fazia diferença nenhuma, mas 49,9 sem essa correção apareceria como "R$ 49,9"
  em vez de "R$ 49,90". Corrigido antes de publicar.
- `entrar.html`, tela de teste vencido: mensagem trocada de "Pro por R$ 67/mês ou Pro Master por
  R$ 97/mês" para "Pro por R$ 49,90/mês ou Pro Master por R$ 99,90/mês" (o comentário já avisava:
  "se mudar lá, mudar aqui").
- Os limites de uso (15 análises/dia · 150/mês no Pro; 30/dia · 300/mês no Pro Master) **não
  mudaram** — só o preço.

## Onde o preço aparece (sem precisar mexer em mais nada — já vem do mesmo lugar)

- Convite de upgrade quando o teste grátis acaba (`entrar.html` + `api/_pipeline.js`).
- Aviso de limite batido do plano Pro, convidando pro Pro Master.
- Convite de assinatura quando o teste grátis atinge o limite diário.

## Conferência

- `tests/v1118-preco-nos-convites.test.mjs` atualizado (o teste é estático, lê o texto-fonte —
  tinha os valores antigos escritos direto na regex, precisava mudar junto).
- `npm test`: 24 arquivos + 367 testes, verdes.
- Chromium headless, tela de "teste acabou" renderizada contra o `contas-estilo.css` publicado: o
  texto novo cabe sem cortar, botão intacto.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
