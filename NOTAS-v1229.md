# v1229 — agendar no celular: não fecha mais sozinho e volta pro topo depois de salvar

Dois pedidos do dono, 12/08/2026, os dois no painel "Agendar" de dentro do cliente, no celular.

## 1. "Toco na data e fecha sozinho — só na segunda vez deixa marcar"

Ao abrir um cliente, a tela é montada em duas etapas: primeiro com o que já está no aparelho,
depois com o que o servidor devolve. No celular a resposta do servidor demora — e chegava bem
na hora em que o corretor já tinha aberto o painel "Agendar" e tocado no calendário. A segunda
montagem reconstruía a tela inteira do zero e o painel renascia FECHADO, com dia e hora zerados:
parecia que o app "fechou sozinho e voltou pro lead". Na segunda tentativa os dados já estavam
no aparelho, não havia remontagem tardia, e aí funcionava.

É a mesma doença já corrigida no card "Últimas mensagens" (v1028) e no campo "Registrar
observação" (v1081) — o painel de agendar tinha ficado de fora da proteção. Correção em duas
camadas:

- **A remontagem tardia agora espera**: se o painel "Agendar" está aberto (muito provavelmente
  com o calendário/relógio nativo na tela), a segunda montagem aguarda e tenta de novo depois —
  não fecha mais o calendário na cara do corretor.
- **E se qualquer outra remontagem acontecer** (reanalisar, marcar atendimento etc.), o painel
  volta aberto e com o dia/hora já escolhidos preservados.

## 2. "Depois que salva, volta pra parte de Detalhes comerciais — quero o topo"

Depois de confirmar o agendamento, a tela remontava e a restauração de rolagem devolvia a página
pra onde ela estava — lá embaixo, na altura de "Detalhes comerciais" (onde o painel fica). Agora,
ao confirmar o agendamento estando na tela do cliente, o painel fecha e a página sobe pro TOPO da
tela do lead antes da remontagem — o corretor cai de volta no nome do cliente e nos botões,
não no meio da página.

## Proteção pra não voltar

`tests/v1229-agendar-nao-fecha-sozinho-e-volta-pro-topo.test.mjs` prende as três peças: a captura
e devolução do painel na remontagem (aberto + dia + hora), a espera da remontagem tardia com o
painel aberto, e a subida pro topo ANTES da remontagem no fluxo de confirmar agendamento.
