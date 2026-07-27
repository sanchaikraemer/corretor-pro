# NOTAS v1030 — proposta com dica visível pra abrir + botão "Voltar" travava a Home vazia

## 1. Proposta salva: dica visível de que dá pra tocar e abrir

O dono confirmou (perguntado direto) que quer exatamente o que a v1025 já fazia: tocar na
proposta salva na linha do tempo reabre a proposta pronta, com o "Imprimir/Salvar PDF" já
disponível ali — não um arquivo PDF separado guardado à parte. O que faltava era deixar isso
claro NA PRÓPRIA TELA: a única pista que existia era uma dica que só aparece passando o **mouse**
por cima (nunca aparece no celular), então o balão da proposta parecia só um texto informativo
comum, sem nenhum convite visível pra tocar. Agora tem uma frase visível, "Toque para abrir e
imprimir", destacada na cor de destaque do sistema, direto no balão.

## 2. Botão "Voltar" travava a Home vazia (regressão da correção anterior)

Depois de marcar um atendimento e tocar em "Voltar", a tela "Hoje" ficava só com a busca de lead
e "Nenhum lead pra atender agora" — sem os cartões (Fazer agora, Total de leads, Agenda,
Aguardando cliente) nem a lista de Oportunidades esquecidas.

Isso é consequência direta da correção anterior do botão "Voltar" (parar de usar o histórico do
navegador e sempre cair na Home, pedido do próprio dono). O destino certo (sempre Home) tinha um
efeito colateral: o histórico do navegador, quando usado, também disparava por trás o
recarregamento do painel inteiro. Sem passar mais por ali, esse recarregamento parou de
acontecer — "Voltar" mostrava a Home, mas com o painel congelado do jeito que estava antes.

Corrigido: "Voltar" agora manda recarregar o painel primeiro (a mesma chamada que a tecla física
de voltar do celular já usava com sucesso) e só depois mostra a fila/lista certa. Cai na Home
igual antes, mas agora com tudo atualizado — sem precisar de um F5.

## Testes novos

`tests/v1029-proposta-dica-visivel-pra-abrir.test.mjs` — confirma a dica visível na proposta.
`tests/v1026-9-pontos-refresh-voltar-reaproveita-proposta-ditado.test.mjs` (Parte D, ampliada) —
confirma que "Voltar" recarrega o painel antes de mostrar a fila/lista, na ordem certa.

## Ainda em andamento

Investigando por que um lead marcado como atendido (caso relatado: "Wilson") ainda aparecia em
"Oportunidades esquecidas" pouco depois — suspeita de uma corrida entre a marcação local e um
recarregamento buscando dados do servidor antes da marcação terminar de salvar. E a tela "Hoje"
ainda demorando pra ficar pronta de verdade logo depois de abrir o site. Nenhum dos dois entrou
nesta atualização.

## `npm test`

Suíte inteira verde.
