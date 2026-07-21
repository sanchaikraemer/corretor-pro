# v896 — barra de interesse em 90 dias + "Última análise" não muda ao marcar

## 1. "Última análise" parava de refletir a análise (bug)
Marcar/desmarcar atendimento atualiza a linha (`atualizado_em`), e a "Última análise" caía num
fallback pra `lead.updatedAt` — então marcar mudava o horário da "Última análise" sem ter
reanalisado. Correção: `cp865UltimaAnaliseISO` usa só carimbos da PRÓPRIA análise
(`reanalisadoEm`/`geradoEm`/`analisadoEm`/`iaComercialV2.geradoEm`) e não usa mais
`updatedAt`/`atualizadoEm`. Sem carimbo real, cai em `criadoEm` (estável) — nunca no updatedAt.

## 2. Barra "Interesse do cliente" = mensagens do cliente nos últimos 90 dias
A pedido do dono, para medir o interesse ATUAL (não engajamento antigo): `mensagensDoCliente`
passa a contar só as mensagens do cliente dentro da janela `CP_JANELA_INTERESSE_DIAS = 90`.
Mensagem sem data legível entra (benefício da dúvida = recente). Como o ranking "Fazer agora"
usa a mesma função, ele também passa a valorizar engajamento recente.

## Arquivos
- `app.js` — `mensagensDoCliente` (janela 90d) + `CP_JANELA_INTERESSE_DIAS`; `cp865UltimaAnaliseISO`.
- `tests/v896-interesse-90dias-e-analise.test.mjs` (novo); `tests/v865-ultima-analise.test.mjs`
  atualizado (não usa mais updatedAt).
- `package.json` — versão 895 → 896.
