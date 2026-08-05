# v1133 — "deletei e não saiu daí": o Excluir da Agenda funcionava, a tela é que não mudava

## O relato

Print da Agenda, seção "Atrasados — retome ou descarte". O dono excluiu o lembrete vencido de um
cliente e o cartão **continuou na lista, no mesmo lugar**, como se nada tivesse acontecido:

> *"deletei e nao saiu dai"*

## O que estava acontecendo

A exclusão **funcionava**: o servidor apagava o lembrete de verdade. O que não acontecia era a tela
mudar.

`carregarAgenda()` começa assim:

```js
if(state.todosLeads?.length){ renderAgenda({ items: state.todosLeads }); return; }
```

Ou seja: a Agenda se redesenha a partir da **carteira que já está na memória** — e nem chega a
buscar o dado novo. Isso existe por um bom motivo (evita um "Carregando..." toda vez que ele entra
na tela), mas cria uma armadilha: quem muda um dado no servidor **precisa** atualizar essa memória,
senão a tela redesenha idêntica.

`invalidarLeadsCache()`, que a exclusão já chamava, limpa o cache de rede — mas não mexe em
`state.todosLeads`. Então a Agenda se redesenhava com o lembrete que acabara de ser apagado. Só
saindo e voltando da tela (ou dando F5) a lista ficava certa.

**O "Reagendar" tinha o mesmo defeito**: a data nova era gravada no servidor e o cartão continuava
mostrando a data antiga. Ninguém tinha relatado ainda.

Vale registrar que esta é a **mesma classe de erro que a v1125 corrigiu no arquivar** (a Home também
renderiza de uma lista em memória, e o card "Arquivados" não subia até dar F5). A correção segue o
padrão de lá.

## A correção

Uma função só, `cpAtualizarLembreteLocal(id, lembrete)`, que põe a carteira em memória no estado que
o servidor acabou de gravar — `null` apaga, um objeto remarca — e atualiza as **três** listas de onde
as telas renderizam (`todosLeads`, `leads`, `itemsAtivos`). Excluir e reagendar passam a chamá-la.

Sem o lembrete, o cartão deixa de ser "atrasado" (a régua olha justamente o lembrete vencido) e sai
da lista na hora, sem sair da tela.

## Bônus: quatro testes que quebravam toda noite

Rodando a suíte às 23h17 de Brasília, cinco testes falharam **sem ninguém ter mexido em nada**.
Não era regressão: eles montavam o "dia de hoje" com a data em **UTC**, enquanto o código conta os
limites diários pelo **dia civil de São Paulo**. Depois das 21h em Brasília já é o dia seguinte em
UTC — o teste gravava a contagem no dia de amanhã, o código procurava a de hoje, não achava, e
concluía que o corretor não tinha usado nada. Resultado: a suíte ficava vermelha das 21h à
meia-noite, todo dia, e verde no resto do tempo.

Ninguém tinha percebido porque ninguém rodava a suíte nessa faixa. Corrigidos os cinco
(`v1013`, `v1041`, `v1068`, `v1108`, `v1110`): todos passam a usar o mesmo dia civil que o código.
Isso importa de verdade — o CI roda a cada envio, e um envio feito à noite acusaria falha em testes
que não têm nada a ver com a mudança.

## Arquivos

- Alterado: `app.js` (`cpAtualizarLembreteLocal` + as chamadas em `removerLembrete` e
  `reagendarLembrete`), e os cinco testes do dia civil.
- Novo: `tests/v1133-excluir-lembrete-sai-da-agenda.test.mjs` — cobre o apagar, o remarcar, o não
  tocar em outros leads, e exige que as três listas sejam sincronizadas (deixar uma de fora é
  exatamente como o bug volta).

## Conferido

- Suíte completa: **306 testes verdes** — inclusive às 23h de Brasília, que até hoje era horário de
  suíte vermelha.
