# NOTAS v1017 — Retorno do teste do v1016: cartão duplicado, 90 dias no Fazer Agora, lentidão de verdade e janela de espera

## O relato

O dono testou a v1016 e voltou com seis pontos, em mensagens seguidas:

1. O cartão da conta na barra lateral e o botão "Sair da conta" logo abaixo fazem exatamente a
   mesma coisa — "não tem sentido isso, ambos servem para a mesma coisa, retire esse card de cima".
2. A barra de mensagens do "Fazer agora" (na tela inicial) ainda mostrava o histórico inteiro de
   mensagens, não os últimos 90 dias — mesmo depois do "Total de mensagens" já ter sido corrigido
   na v1016.
3. "O sistema continua puxando leads antes mesmo dos 5 dias de descanso, já falamos umas mil vezes
   sobre isso e nunca resolve" — o lead volta pra tela de "Fazer agora" como prioridade principal
   mesmo sem respeitar o prazo configurado.
4. Sobre o site travando/lento: o dono provou que a teoria anterior (reprocessar a conversa
   inteira de cada lead) estava incompleta — testou numa conta de teste **sem nenhum lead
   cadastrado** e o mesmo travamento aconteceu, no mesmo tempo.
5. (a pendência de lentidão já conhecida antes desta leva, ver histórico da branch anterior)
6. Um texto explicativo (motivo) dentro do card "Fazer agora" de dentro do lead — "pode deletar,
   excluir e sumir com isso que só serve pra incomodar, não me ajuda em nada, só polui tela".

## Correção 1 — cartão da conta deixa de ser botão

O cartão (avatar + nome + setinha "⌄") tinha virado um `<button>` clicável na v1015, disparando
`cpSairDaConta()` — exatamente a mesma ação do botão dedicado "Sair da conta", que já existia logo
abaixo, sempre visível. Ter os dois fazendo a mesma coisa não ajudava em nada. O cartão voltou a
ser um `<div>` só informativo (mostra nome/avatar, sem clique, sem setinha, sem cursor de mãozinha).
"Sair da conta" continua sendo o único jeito de encerrar a sessão pela barra lateral.

## Correção 2 — barra do "Fazer agora" também respeita 90 dias

`mensagensDoCliente(l)` (a contagem de mensagens do cliente usada nessa barra) é **de propósito**
o histórico inteiro — ela também alimenta o ranqueamento da fila e o radar de "Oportunidades
esquecidas" (que existe justamente pra resgatar um lead antigo que esfriou; se essa contagem fosse
cortada em 90 dias, um lead parado há mais tempo apareceria com "0 mensagens" nesse radar, e o
recurso quebraria). Por isso não dava pra simplesmente trocar a régua ali.

Em vez disso, o servidor ganhou um número novo, só do cliente e só dos últimos 90 dias
(`clientMessageCount90d`), calculado na mesma varredura de sempre (sem custo extra). O app ganhou
`mensagensDoClienteRecente`, que lê esse número novo — e só a barra do "Fazer agora"
(`cpBarraMensagensMini`, incluindo o cálculo de "qual é o maior da lista" que define o tamanho da
barra) passou a usar essa versão. Todo o resto — ordenação da fila, "Oportunidades esquecidas", o
texto "X mensagens do cliente" dentro do radar — continua com o histórico inteiro, sem mudança.

**Fica de olho:** como só essa barra específica mudou, um lead que teve bastante conversa há mais
de 90 dias mas nada recente vai mostrar um número bem menor nessa barra do que mostrava antes
(ou até zero) — é exatamente o comportamento pedido, mas é uma mudança visual real que vale
confirmar que ficou como esperado.

## Correção 3 — lentidão: a causa real (o teste com a conta vazia)

A teoria anterior — recontar números relendo a conversa inteira de cada lead — é um custo real,
mas só cresce com a QUANTIDADE de leads. Não explica travar igual numa conta sem nenhum lead.

Investigando de novo com essa pista, achamos: praticamente toda ação no site (abrir a lista de
clientes, marcar atendimento, abrir o Cérebro, qualquer coisa) passa primeiro por uma checagem de
"de quem é essa conta?" — e essa checagem fazia **duas idas e voltas ao banco de dados a cada
clique**, sem guardar o resultado por nenhum tempo. Isso é um custo fixo: acontece do mesmo jeito
numa conta vazia ou numa conta com milhares de leads. É a explicação que bate com o que o dono
observou.

Correção: esse resultado agora fica guardado por 30 segundos (o suficiente pra uma sequência de
cliques não pagar esse preço de novo, pouco o bastante pra continuar checando se a conta foi
bloqueada ou o teste grátis venceu). Continua seguro: cada conta só usa o resultado guardado
dela mesma, nunca o de outra.

## Correção 4 — a lentidão de reprocessar cada lead (pendência antiga) também foi resolvida

Além da correção 3, a pendência mais antiga (recontar os números de cada lead relendo a conversa
inteira toda vez que a lista carrega) também foi corrigida nesta versão: esses números agora ficam
guardados prontos e só são recalculados quando a conversa daquele lead realmente muda (chegou
mensagem nova) ou quando vira o dia. Sem coluna nova no banco — o número pronto fica guardado
dentro do mesmo lugar que já guarda a análise do lead.

## Correção 5 — janela de espera de 5 dias (o bug "de sempre")

Esse era o mais antigo e mais repetido dos relatos. A causa: o sistema decidia se "a bola está com
o cliente" olhando **só quem escreveu por último**, nunca **o que foi escrito**. Um simples "Ok" ou
"Obrigada" do cliente — sem pedir nada — já contava como "cliente respondeu", e o prazo de espera
(5 dias, ou 3 pra lead recém-importado) encerrava na hora, antes do previsto.

Esse exato problema já tinha sido corrigido antes — só que só na conta que decide a ORDEM da fila,
nunca na regra que decide se o lead pode ou não voltar a aparecer. Corrigido agora nos dois
lugares: uma despedida ou agradecimento do cliente, sem pergunta nem pedido, não encerra mais o
prazo de espera. Só uma pergunta ou pedido de verdade encerra.

## Correção 6 — motivo dentro do lead removido

O card "Fazer agora" de dentro do lead mostrava uma frase explicando por que aquele lead estava
priorizado (ex.: "Já se falou de valor ou condição de pagamento · cliente esperando sua resposta
· voltou a conversar em 3 dias diferentes"). Esse texto já tinha sido tirado da tela inicial antes
(a pedido do dono, por ser redundante) — agora foi removido também de dentro do lead, por pedido
explícito. O card "Fazer agora" continua mostrando a próxima ação e as sugestões de mensagem,
só sem esse texto.

## Testes novos

`tests/v1017-lentidao-cache-90dias-fazer-agora-cartao-duplicado.test.mjs` — cobre: o cache de
estatísticas por lead (calcula, grava, usa cache válido, invalida por tamanho de conversa e por
dia), o cache de autenticação (por token, sem misturar contas, revalida bloqueio), a janela de
espera (despedida não encerra, pergunta/pedido encerram), o cartão lateral sem duplicidade e a
barra do Fazer Agora usando 90 dias sem afetar o ranqueamento.

Testes existentes atualizados pra continuar batendo com o código atual (sem mudar o que cada um
garante, só a forma como verificam): `v1015`, `v943`, `v944`, `v946`, `v972`, `v975`, `v1016`,
`v942`.

## `npm test`

Suíte inteira verde (199 verificações).
