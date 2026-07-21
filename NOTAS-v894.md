# v894 — topo do lead: barra de ícones (Modelo 2) + "Atendido" como interruptor

O dono escolheu o Modelo 2 dos mockups e pediu pra repensar o "Desmarcar".

## Barra de ícones
Os pills grandes do topo (Reanalisar / Agendar retorno / Editar lead / Marcar atendimento +
o link Desmarcar) viraram uma **barra de ícones compacta** (`.cp704-toolbar` / `.cp704-ico`):
ícone + legenda curta, numa linha só. No mobile os 4 dividem a largura igualmente. Fiel às
cores do app e funciona nos dois temas (borda/texto por token; verde do "done" nos dois).

## "Desmarcar" virou interruptor (fim do link solto)
O dono não gostou do "Desmarcar" como item à parte. Agora o próprio ícone **"Atendido"** é o
interruptor: não atendido → ícone "Marcar" (chama `ui667MarcarAtendido`); atendido → ícone
verde "Atendido" (chama `ui667DesmarcarAtendido` — toca de novo e desmarca). Sem link extra,
nada acidental sobrando. A lógica robusta de desmarcar (otimista, 30s, reverte, limpa todo
contato_manual do dia — v891/v893) continua.

## Arquivos
- `app.js` — markup da toolbar + CSS `.cp704-toolbar`/`.cp704-ico` (base e mobile).
- `tests/v894-toolbar-icones.test.mjs` (novo); `v823`, `v866-ui-limpeza`, `v888`, `v891`
  atualizados pro novo topo.
- `package.json` — versão 893 → 894.

## Observação
As classes/CSS antigos (`.cp704-attended`, `.cp704-reanalyse*`, `.cp704-desmarcar`) seguem
definidos mas sem uso no lead — deixados pra não mexer em quem ainda referencia; podem ser
limpos depois.
