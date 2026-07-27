# v1011 — os "compromissos atrasados" ganharam uma lista de verdade (na Agenda)

## Contexto

Depois da v1010, o dono olhou o "9 compromissos atrasados" do sino e questionou: "9????".
O problema não era o número (a régua está certa: lembrete ou compromisso com data vencida nos
últimos 60 dias, de lead ativo, ainda não atendido hoje e não descartado) — era não existir
LUGAR NENHUM pra ver QUAIS são: o clique caía na Condução, que nem lista atrasados.

## O que mudou (app.js)

- **Agenda ganhou a seção "Atrasados — retome ou descarte" no topo**, com a MESMA régua da
  contagem do sino. Cada cartão mostra: há quantos dias venceu, o que era (lembrete com motivo,
  ou o compromisso lido da conversa com o trecho literal de prova), o botão de abrir o lead
  (retomar) e um **×** pra descartar quando a IA leu errado (o descarte já existia no aviso do
  topo da Home — mesma memória, agora acessível também aqui).
- **O aviso do sino agora leva pra Agenda** (onde a lista mora), com o texto "Veja a lista na
  Agenda — retome ou descarte um a um".
- Se a Agenda só tiver atrasados, ela não diz mais "Nada agendado".

## Testes

Novo `tests/v1011-atrasados-tem-lista-na-agenda.test.mjs` (seção presente com a mesma régua,
"Nada agendado" não engole atrasados, × de descartar atualiza a tela, sino leva pra Agenda).

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`app.js`, `tests/v1011-atrasados-tem-lista-na-agenda.test.mjs` (novo),
`package.json`/`package-lock.json`, `NOTAS-v1011.md`, versão **1010 → 1011**.
