# v1118 — o preço aparece: convite de limite e tela de "teste acabou" mostram os planos

## Por quê

A auditoria mostrou que o preço não aparecia em lugar nenhum, e o pior vazamento do funil era a
tela de teste vencido: o corretor usava 7 dias, gostava, e ao esbarrar no fim do teste caía numa
mensagem seca ("é preciso confirmar o pagamento") **sem preço, sem botão, sem WhatsApp** — o momento
de maior vontade de comprar terminava sem saída. Decisão do dono (03/08/2026): preços definidos —
**Pro R$ 67/mês, Pro Master R$ 97/mês** — e passam a aparecer onde o cliente decide pagar.

## O que mudou na tela

- **Quando o teste de 7 dias acaba** (tela de entrar): em vez da mensagem seca, aparece
  *"Continue usando o Corretor Pro: Pro por R$ 67/mês ou Pro Master por R$ 97/mês"* com um **botão
  verde que abre o WhatsApp** já com a mensagem pronta ("meu teste acabou e quero assinar").
- **Quando bate o limite diário de análises**: o convite que já existia passou a mostrar o preço —
  no teste, os dois planos; no Pro, o preço do Pro Master.

## Onde o preço fica (pra ajustar depois)

O preço vive no servidor (`api/_pipeline.js`, `PRECOS_PLANOS`), e pode ser mudado **sem publicar
nada** pelas variáveis `CORRETOR_PRO_PRECO_PRO` e `CORRETOR_PRO_PRECO_PROMASTER` na Vercel. A tela
de login usa os mesmos valores (R$ 67 / R$ 97) — se um dia mudar no servidor, mudar também em
`entrar.html` (o teste `v1118` cobre os dois lados).

## Observação importante

Isto é o preço da **assinatura da plataforma** (o que o corretor paga pra usar o app) — não é preço
de imóvel. A regra de "nada comercial cravado no código" continua valendo pro que é do LEAD
(empreendimento, condição), que segue vindo só do Cérebro e da conversa.

## Teste de regressão

`tests/v1118-preco-nos-convites.test.mjs` — confere o preço definido no servidor (com override por
env), o preço nos dois convites e na tela de teste vencido, o botão de WhatsApp e o escape do nome.
