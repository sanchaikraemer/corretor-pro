# NOTAS v1112 — Fusível técnico baixado pra 50 análises/dia

## O que o dono pediu

> "Muda meu teto ali como trava técnica pra cinquenta por dia. Pode limitar por cinquenta dia
> pra nós ter uma segurança."

## O que mudou

Só o fusível técnico (`LIMITE_ANALISES_IA_DIA_PADRAO`, em `api/_pipeline.js`): **200 → 50
análises por dia**. Desde a v1110/v1111 esse número só alcança a **conta original** (as contas
pagas usam os limites dos planos — Pro 15/150, Master 30/300 — e o teste usa 5/dia), então na
prática é a trava de segurança da própria conta do dono.

Aviso registrado na conversa: com 50/dia, o botão "Reanalisar todos" numa carteira de 200+
clientes para no 50º — pra rodar a carteira inteira de uma vez, subir temporariamente
`CORRETOR_PRO_LIMITE_ANALISES_DIA` na Vercel (sem publicar nada) ou rodar em partes.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 283 testes verdes (v1013 e v1110 recalibrados pro fusível de 50) |
| `npm run build` | ok, versão 1112 |

Sem mudança visual (o aviso neutro mostra o número em vigor sozinho).

## Arquivos alterados

**Código:** `api/_pipeline.js`

**Documentação:** `ESTADO-ATUAL.md`, `NOTAS-v1112.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes (atualizados):** `tests/v1013-limite-diario-uso-ia.test.mjs`,
`tests/v1110-planos-pro-e-pro-master.test.mjs`
