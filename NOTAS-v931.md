# v931 — Home sem porta redundante + tile Agenda batendo com a Agenda

## 1. "Ver todas as oportunidades" saiu da Home (porta redundante)

O dono percebeu, na própria conversa: "se condução e o mesmo q ver todos, ou o q tem na
home, é redundante, nao acha?" — e confirmou com "nao seja retundante".

De fato, o link "Ver todas as oportunidades" da Home e o item "Condução do atendimento" do
Menu levavam pro MESMO lugar: `show('pipeline')`, sem filtro nem diferença nenhuma. Dois
caminhos pra abrir a mesma tela, um deles sem motivo de existir.

**O que mudou**: removidos da Home o botão "Ver todas as oportunidades", a variável
`temLista` (só existia pra decidir se mostrava o botão) e a função `abrirTodosLeads`
(só era usada por esse botão), junto com o listener órfão `.navTodos`. A Condução continua
acessível do jeito de sempre, pelo Menu.

## 2. Tile "Agenda" da Home: ia pra tela errada E mostrava número errado

Dois prints do dono no mesmo print/mensagem: "tem 3 na agenda e na home marca 11... esta
errado", e "agenda vai pra condução, e nao pode, tenque ir pra agenda, isso é óbvio".

Dois bugs no mesmo tile:

- **Navegação errada**: o tile "Agenda" da Home abria `cp786AbrirConducao('programados')` —
  a aba "Agenda" DENTRO da Condução do atendimento — em vez da tela Agenda de verdade (a
  mesma que a barra de baixo abre). Corrigido pra `show('agenda')`.
- **Número errado**: o tile contava `cp786Categoria(l)==='programados'`, que TAMBÉM inclui
  compromisso/lembrete **vencido** (fica em destaque na Condução até o corretor marcar
  atendimento — decisão de outra tela, da v886). A tela Agenda de verdade nunca lista
  vencido de um lead ativo (só mostra hoje, futuro, ou compromissos confirmados) — daí o
  11 (Home) vs 3 (Agenda) do print.

**O que mudou**: nova função `cpAgendaContagem(items)` conta exatamente o que a tela Agenda
lista — lembrete de hoje ou futuro (nunca vencido) + compromissos confirmados — e o tile da
Home passou a usar essa mesma conta, em vez de `cp786Categoria`. Mesmo número nos dois
lugares, sempre.

## Verificação

- `tests/v931-sem-porta-redundante.test.mjs` (novo): confirma que o botão/variável/função
  duplicados saíram e que a Condução continua acessível.
- `tests/v931-agenda-tile-bate-com-agenda.test.mjs` (novo): confirma que o tile Agenda abre
  `show('agenda')` (não a Condução) e que `cpAgendaContagem` conta hoje/futuro/compromissos
  mas ignora vencido — com um caso de exemplo batendo a conta esperada.
- Suíte inteira verde (`npm test`); `node --check` em todos os arquivos de API e
  `node build.js` OK.

## Arquivos
- `app.js` (Home: remove `temLista`/`abrirTodosLeads`/`.navTodos`; tile Agenda usa
  `show('agenda')` + nova `cpAgendaContagem`), `tests/v931-sem-porta-redundante.test.mjs`
  (novo), `tests/v931-agenda-tile-bate-com-agenda.test.mjs` (novo),
  `tests/v905-limpeza-7-itens.test.mjs` e `tests/v925-vamos-atender-mais-um.test.mjs`
  (ajustados pra remoção do link redundante), `package.json`/`package-lock.json`,
  `NOTAS-v931.md`, versão **930 → 931**.
