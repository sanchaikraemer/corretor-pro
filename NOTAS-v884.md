# v884 — "Fazer agora" volta a ter serventia (responder + retomar)

## O problema (dono)

O card **"Fazer agora"** vivia em **0**. Numa carteira de imports antigos quase nada é
"preciso responder AGORA" (categoria `agora`), então o número ficava zerado e o card não
servia pra nada — enquanto a home mostrava dezenas de "Oportunidades esquecidas" e o
Raio-X gritava "37 clientes valiosos parados, retome".

Decisão do dono: **não é pra remover o card — é pra ele funcionar.**

## A correção

Novo `cpPrecisaAcaoHoje(l)` = a **ação real do dia**:

- **precisa responder** (`cp786Categoria === 'agora'`), OU
- **vale retomar hoje** (`entraEmRetomada`: parado 5+ dias, lembrete vencido, compromisso
  pra hoje/amanhã, quente-fechar...),
- **exceto** quem já foi **atendido hoje** e quem tem **compromisso futuro** (esse é da Agenda).

Com isso:

- O card **"Fazer agora"** para de viver em 0 e passa a mostrar quantos leads valem uma ação
  hoje. Clicar abre a **lista** desses leads (do mais quente pro mais frio), via
  `abrirFazerAgora` → `abrirGrupoHome('__fazeragora', …)` — reaproveitando a lista avulsa
  criada na v883.
- A **saudação laranja** do topo usa a MESMA base (`cpPrecisaAcaoHoje`), então o número de
  cima e o card batem — resolvendo de vez a divergência do primeiro print ("10 pra atender"
  em cima × "0 fazer agora" embaixo).
- Os cards da home particionam a carteira sem sobreposição: **Fazer agora** (ação hoje) +
  **Agenda** (compromisso marcado) + **Aguardando cliente** (o resto).

Respeita o atendimento: um lead atendido hoje (como a Sara) não entra em "Fazer agora".

## Arquivos

- `app.js` — `cpPrecisaAcaoHoje(l)`, `abrirFazerAgora()`; `renderResumoDia` (card + clique) e
  `renderSaudacao` passam a usar `cpPrecisaAcaoHoje`.
- `tests/v884-fazer-agora-retomadas.test.mjs` — novo.
- `tests/v876-telas-refino.test.mjs` e `tests/v881-saudacao-bate-fazer-agora.test.mjs` —
  atualizados pro novo comportamento (onclick `abrirFazerAgora()`; saudação via
  `cpPrecisaAcaoHoje`).
- `package.json` — versão 883 → 884.
