# v924 — "Fazer agora" simplificado: meta do dia menos quem já foi atendido

## O que aconteceu

A v922 tentou resolver "atendi e o número não desceu" guardando os 10 leads do dia numa lista
fixa, persistida no aparelho (`localStorage`). Só que isso criou um problema novo: o dono
atualizou o app **no meio do dia**, depois de já ter atendido 8 leads pela versão antiga. Quando
a versão nova rodou pela primeira vez, ela montou a lista fixa NAQUELE momento — excluindo só
quem já tinha sido atendido até ali, escolhendo 10 leads novos pra completar. Resultado: o card
voltou a mostrar "10", e pra quem está olhando de fora parece o mesmo bug de novo (mesmo não
sendo). Além disso, a lista fixa só existia no aparelho onde foi criada — não sincronizava
celular ↔ PC.

## O que mudou

Trocado por uma conta bem mais simples e sem estado nenhum pra guardar:

**`cpFazerAgoraDose(items)` = META do dia (10) MENOS `cpAtendidosHojeTotal(items)`** (quantos
leads já têm um atendimento registrado hoje — a mesma contagem que já aparece em "Atendimentos",
ex.: 9/10 lá = falta 1 aqui). Sem lista travada, sem `localStorage`, sem depender de quando o
app foi atualizado: qualquer atendimento de hoje, feito em qualquer aparelho (celular ou PC),
já reduz esse número na hora que a tela recarrega, porque `ehContatadoHoje` lê o evento
`contato_manual` que vem do servidor (Supabase) — não de um cache local.

- `cpFilaFazerAgora` (a fila ranqueada por engajamento + tempo parado) continua exatamente
  igual — ela já excluía quem foi atendido hoje.
- A LISTA mostrada em "Fazer agora" (Home, Condução, o card em si) passa a ser o topo dessa fila
  cortado pela dose (`fila.slice(0, cpFazerAgoraDose(items))`) — quem tira uma vaga de hoje some
  da lista, e o corte vai encolhendo (10→9→8...) até 0, sem repor.
- "Atender +1" volta a funcionar como na v914/v884: revela mais um além da meta, por clique,
  enquanto o corretor quiser continuar atendendo no mesmo dia (`state.fazerAgoraExtra`).
- `cpDoseIdsHoje`/`cpDoseFixaHoje`/`cpAdicionarNaDoseHoje`/`cpLerDoseSalva`/`cpGravarDoseSalva`/
  `cpHojeBR`/`CP_DOSE_STORAGE_KEY` (tudo da v922) foram removidos — não tem mais nada persistido
  no aparelho pra essa conta.

## Verificação

- `tests/v924-fazer-agora-meta-decrescente.test.mjs` (novo, substitui
  `tests/v922-fazer-agora-dose-fixa.test.mjs` e `tests/v923-sem-linguagem-aleatoria.test.mjs`,
  removidos): confirma que a dose é `10 - atendidosHoje` mesmo quando os 8 atendimentos já
  existiam ANTES do cálculo rodar (simula a atualização chegando no meio do dia), que passar da
  meta trava em 0 (nunca negativo), e que a lista mostrada é o topo da fila ranqueada cortado
  pela dose.
- `tests/v914-fazer-agora-dose-e-fds.test.mjs` e `tests/v884-fazer-agora-retomadas.test.mjs`
  ajustados pra nova assinatura de `cpFazerAgoraDose`/`abrirFazerAgora`.
- Suíte inteira verde (`npm test`); `node --check app.js` e `node build.js` OK.

## Arquivos
- `app.js` (`cpAtendidosHojeTotal` novo, `cpFazerAgoraDose` simplificado, `abrirFazerAgora`,
  `leadsEsquecidos`, `renderBotoesHome`, `carregarPipeline` — todos revertidos pra usar a dose
  simples em vez da dose fixa da v922), `tests/v924-fazer-agora-meta-decrescente.test.mjs` (novo),
  `tests/v922-fazer-agora-dose-fixa.test.mjs` e `tests/v923-sem-linguagem-aleatoria.test.mjs`
  (removidos), `tests/v914-fazer-agora-dose-e-fds.test.mjs` e
  `tests/v884-fazer-agora-retomadas.test.mjs` (ajustados), `package.json`/`package-lock.json`,
  `NOTAS-v924.md`, versão **923 → 924**.
