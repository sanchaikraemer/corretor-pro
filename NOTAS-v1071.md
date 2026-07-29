# NOTAS v1071 — "Aguardando cliente" ganha prazo de validade + novo contador de 30 dias sem atender

## Contexto

O dono percebeu (pelo print da Home: 104 de 222 leads em "Aguardando cliente") que o número não
tinha coerência, e pediu dois ajustes: corrigir isso e adicionar um contador de quem está sem
atendimento há 30 dias.

## 1. "Aguardando cliente" agora respeita o prazo de descanso

**Causa**: "Aguardando cliente" (você atendeu, cliente não respondeu — a bola está com ele) nunca
tinha prazo de validade. Um cliente atendido há 2 dias e um atendido há 60 dias, os dois sem
resposta, contavam igual — pra sempre. Isso contradizia a regra do "Fazer agora" (v1069): depois
que passa o prazo de descanso configurado no Cérebro, esse MESMO cliente também volta a aparecer
em "Fazer agora" — as duas telas diziam coisas opostas sobre a mesma pessoa, e o balde de
"aguardando" só crescia com o tempo, nunca esvaziava sozinho.

**Correção**: "Aguardando cliente" agora só conta enquanto ainda está **dentro** do prazo de
descanso configurado. Assim que vence sem resposta, o cliente sai desse balde e passa a contar
como ação pendente (aparece em "Fazer agora"/"Condução"), do jeito que já deveria ter acontecido.
Isso corrige tanto o número na Home quanto a lista de verdade na tela de Condução (aba
"Aguardando cliente").

## 2. Novo contador: "Sem atender 30d+"

Pedido direto do dono: um contador simples de quem está **sem nenhum atendimento há 30 dias ou
mais** (ou nunca foi atendido). Esse prazo é **fixo em 30 dias** — diferente do "descanso após
atender" configurável no Cérebro, que é usado só pra decidir quando um lead JÁ atendido volta a
ser candidato em "Fazer agora". São duas réguas diferentes, de propósito: uma configurável (pra
decidir a fila do dia a dia) e uma fixa (pra um alerta de "isso está esquecido faz tempo",
independente da configuração de cada corretor).

Aparece como um quinto quadro na Home, ao lado de "Fazer agora", "Total de leads", "Agenda" e
"Aguardando cliente" — é só um contador (sem lista clicável por trás, por enquanto).

## Verificação

- `tests/v1071-aguardando-respeita-prazo-descanso.test.mjs` (novo): confirma que "aguardando" só
  vale dentro do prazo, e que passado o prazo o lead cai no fluxo normal.
- `tests/v1071-contador-sem-atender-30-dias.test.mjs` (novo): confirma a conta de "nunca atendido
  ou 30+ dias sem atender", incluindo o caso de borda (exatamente 30 dias já conta).
- Suíte inteira (`npm test`) verde, incluindo os testes antigos que citavam a regra antiga de
  "aguardando" (v818, v824, v885, v906 — todos atualizados pra regra nova).
- `npm run build` limpo.

## Arquivos

`app.js`, `tests/v1071-aguardando-respeita-prazo-descanso.test.mjs` (novo),
`tests/v1071-contador-sem-atender-30-dias.test.mjs` (novo), `tests/v818-fixes.test.mjs`,
`tests/v824-fallback-prioridade.test.mjs`, `tests/v885-prioridade-por-fatos.test.mjs`,
`tests/v906-aguardando-cliente-real.test.mjs` (assertions atualizadas pra regra nova),
`package.json`/`package-lock.json` (versão **1070 → 1071**), `NOTAS-v1071.md` (este arquivo).
