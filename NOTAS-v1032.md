# NOTAS v1032 — a Home só se atualizava sozinha uma vez (na primeira vez que abria)

## O relato

Depois da correção da v1031 (Wilson sumir de "Oportunidades esquecidas" ao marcar atendido
pela cópia de mensagem), pedi uma checagem extra só por precaução, porque o dono tinha visto o
mesmo sintoma persistir mesmo sem repetir a ação. A checagem achou uma segunda causa, bem mais
funda, e completamente separada da v1031.

## O que estava acontecendo

A tela Hoje (cartões do topo + "Fazer agora", "Aguardando cliente", "Oportunidades esquecidas")
carrega os dados uma vez quando você abre o app — e depois disso, ela **só olhava pro que já
tinha guardado na memória do celular**, mesmo quando duas rotinas automáticas tentavam forçar
uma leitura nova: a sincronização a cada 30 segundos e o momento em que você volta pra aba do
Corretor Pro depois de ter usado outro aplicativo. As duas realmente tentavam avisar "busca de
novo, não confia no que já tem" — mas esse aviso estava sendo silenciosamente ignorado.

Na prática: uma vez que a Home carregava pela primeira vez (ao abrir o app), ela só se atualizava
de verdade em duas situações — uma ação sua ali mesmo na tela (marcar atendido, copiar mensagem
etc, que já se corrige sozinha) ou um recarregamento completo da página (F5, ou fechar e abrir o
app de novo do zero). Passar pela tela de Atendimentos, esperar o tempo passar, ou só deixar o
celular na Home não bastava — o número de "Oportunidades esquecidas" podia continuar mostrando
a "fotografia" de horas atrás.

## O que mudou

A Home agora respeita de verdade o pedido de "busca de novo" das duas sincronizações automáticas
(30 segundos e voltar pra aba). Sem precisar de F5: com o tempo, ou ao voltar pro Corretor Pro
depois de usar outro app, a lista se atualiza sozinha. Também tomei cuidado pra essa atualização
de fundo não "piscar" a tela — ela troca os dados por trás, sem mostrar carregamento nem sumir
com o que você já estava vendo.

## O que NÃO mexi (registrado pra próxima vez, sem ação agora)

A investigação também notou um ponto de atenção, de confiança bem mais baixa e sem qualquer
sintoma confirmado até agora — uma possível corrida rara entre duas gravações simultâneas no
banco de dados. Não mexi nisso agora porque não tem nada que comprove que isso já causou algum
problema real; fica anotado pra olhar com calma numa sessão futura, se algo relacionado aparecer.

## Testes novos

`tests/v1032-home-nunca-atualiza-sozinha.test.mjs` — confirma que a sincronização automática
agora busca dado novo de verdade no servidor (e não só reaproveita o que já estava na memória),
que o carregamento de fundo não apaga a tela com um carregamento visível, e que a primeira
abertura do app (tela vazia) continua funcionando exatamente como antes.

## `npm test`

Suíte inteira verde.
