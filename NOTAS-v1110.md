# NOTAS v1110 — Planos Pro e Pro Master (limite por dia E por mês)

## O que o dono pediu

Evolução da conversa de comercialização (v1108/v1109): três degraus, com estratégia de
chamariz ("a pipoca do cinema" — o plano do meio existe pra fazer o grande parecer barganha):

> "no plano pró, ele teria vinte e cinco análises por dia, com teto máximo por mês [...] e o
> plano pró master, ele teria o dobro, seriam cinquenta análises por dia por um preço próximo
> ao pró."

Tetos mensais definidos em conjunto: **Pro 250/mês, Pro Master 500/mês** (o dobro em tudo,
âncora: o próprio dono — usuário pesado com 200+ clientes — fez 70–80 análises no mês).

## A régua completa

| Conta | Por dia | Por mês | Ao bater no limite |
|---|---|---|---|
| Teste grátis (7 dias) | 5 | — | Convite pra contratar (botão WhatsApp) |
| **Pro** | 25 | 250 | Convite pro **Pro Master** ("tem o dobro") |
| **Pro Master** | 50 | 500 | Convite pra plano maior/personalizado |
| Conta original (dono) | 200 (fusível técnico) | — | Aviso neutro, sem botão |

O **preço nunca aparece no app** — fica na conversa do WhatsApp (54 99901-3331), onde o dono
negocia caso a caso. Por que dia E mês: o diário absorve o pico (importou 20 conversas hoje),
o mensal segura o custo (25×30 seriam 750; o teto de 250 é o que protege de verdade).

## Como funciona por dentro

- O plano de cada conta fica em `direciona_config` (chave `plano-contratado`,
  valor `{tipo:"pro"|"pro-master"}`) — **sem migração de banco**. Conta ativa sem registro = Pro.
- `verificarLimiteAnalises` (novo, em `api/_pipeline.js`) resolve teste/plano/conta original e
  aplica os dois contadores (`limite-diario:analises-ia` + novo `limite-mensal:analises-ia`,
  mês no calendário de Brasília). O `verificarLimiteDiario` genérico continua igual pros outros
  contadores (voz, diagnóstico). Mesma regra de sempre: falha de leitura/gravação nunca
  bloqueia análise real.
- Cada degrau manda pro app o rótulo do botão e a mensagem pronta do WhatsApp
  (`upgrade: { botao, mensagemWhats, whatsapp, motivo }`) — a tela só monta.
- **Painel administrativo**: "Marcar pago" virou **"Pago · Pro"** e **"Pago · Pro Master"**
  (a ação grava o plano E marca a conta como ativa, tudo pelo servidor, exclusivo do
  administrador). A conta ativa mostra a etiqueta do plano ao lado do status. A conta original
  não aceita plano (o servidor recusa e explica).

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 283 testes verdes (novo: `v1110-planos-pro-e-pro-master`) |
| `npm run build` | ok, versão 1110 |
| Navegador de verdade | painel com etiqueta de plano e os 2 botões; convite renderizado |

O teste novo cobre com servidor de mentira: 25ª análise entra / 26ª bloqueia (Pro), teto
mensal segurando com o dia folgado, Pro Master com o dobro, teste grátis com 5, conta
original fora dos planos (fusível 200, sem consultar status), gravação dos dois contadores,
mensagens de cada degrau, e o painel com os botões novos.

## Arquivos alterados

**Código:** `api/_pipeline.js`, `api/admin-contas.js`, `admin-plataforma.html`, `app.js`

**Documentação:** `ESTADO-ATUAL.md`, `NOTAS-v1110.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes:** `tests/v1110-planos-pro-e-pro-master.test.mjs` (novo),
`tests/v1108-limite-teste-10-e-convite-whatsapp.test.mjs` (atualizado)
