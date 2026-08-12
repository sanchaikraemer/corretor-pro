# v1231 — salvar observação também volta pro topo da tela do cliente

Pedido do dono, 12/08/2026, na sequência da v1229: *"após salvar uma obs, quero que volte a tela
para o topo do lead também"*.

## O que mudou

Depois de salvar uma observação, a tela remontava e a restauração de rolagem devolvia a página
pra onde ela estava — na altura do painel "Registrar observação". Agora, ao salvar, a página sobe
pro TOPO da tela do cliente (nome e botões), exatamente como o confirmar agendamento passou a
fazer na v1229. A subida acontece antes da remontagem, pra restauração de rolagem já capturar o
topo.

Todo o resto do salvar observação continua igual (v1228: aparece na hora na linha do tempo, marca
atendido, ensina o sistema em segundo plano e NÃO reanalisa sozinho).

## Proteção pra não voltar

`tests/v1231-obs-salva-volta-pro-topo.test.mjs` prende a subida pro topo dentro do salvar
observação e exige que ela venha ANTES da remontagem da tela.
