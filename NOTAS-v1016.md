# NOTAS v1016 — Duas abas brigando pela mesma conta, saudação piscando, mensagens dos últimos 90 dias, confirmação de sair

## O relato

Numa única mensagem, o dono trouxe quatro coisas:

1. A saudação da Home muda de nome depois que a página termina de carregar — antes disso mostra
   um nome genérico à toa.
2. "Total de mensagens" continua contando o histórico inteiro, mesmo depois de já ter sido pedido
   pra contar só os últimos 90 dias (pedido feito de novo — da primeira vez ficou só anotado como
   pendência, não foi feito).
3. O cartão da conta na lateral (a setinha "⌄", virou botão na v1015) agora sai da conta na hora
   do clique — sem perguntar nada antes, o que não é o esperado, já que a setinha sugere que abre
   alguma opção.
4. E, testando ao vivo durante esta atualização: com a conta de teste e a conta real abertas ao
   mesmo tempo em duas abas do navegador, uma aba "puxou" os leads da outra — o dono chegou a
   confirmar sozinho, no meio do teste, que o problema é exatamente ter duas abas abertas ao mesmo
   tempo, uma de cada conta.

## Correção 1 — nome genérico "piscando" na abertura

Existia uma linha em `app.js` que escrevia `"Bom dia, corretor!"` no título assim que o script
carregava, **antes** de saber o nome de verdade — só pra não deixar o título vazio por uma fração
de segundo. Assim que os dados chegavam, `renderSaudacao()` trocava pelo nome certo. O problema:
esse nome genérico (ou, num aparelho com mais de uma conta, o nome da conta anterior ainda na
tela) aparecia visivelmente antes da troca, dando a impressão de erro.

Removido: o título fica parado no "Hoje" estático (já definido direto no HTML) até
`renderSaudacao()` escrever o nome de verdade — sem nome nenhum piscando no meio do caminho.

## Correção 2 — "Total de mensagens" agora conta só os últimos 90 dias

`api/_persistence.js` já varria o histórico inteiro de cada lead pra calcular outros números
(mensagens do cliente, dias com mensagem etc.) — aproveitando essa MESMA varredura (sem custo
extra), passou a contar também quantas mensagens caem dentro dos últimos 90 dias
(`messageCount90d`). Esse número é enviado pro app e agora é ele que aparece pro corretor em
"Total de mensagens" / "Mensagens" / "Últimas mensagens" em vez do histórico completo
(`messageCount`, que continua existindo só para o ranqueamento interno de leads — isso não muda).

## Correção 3 — confirmação de verdade antes de sair da conta

O clique no cartão da conta lateral já pedia confirmação antes de sair (`confirm()` do próprio
navegador), mas a "tela feia" do navegador (aquela caixinha cinza com a URL do site) não deixava
claro que era uma pergunta de verdade — parecia que tinha saído direto. Trocado pelo modal com a
cara do próprio Corretor Pro (o mesmo estilo já usado ao arquivar ou perder um lead): título "Sair
da conta", pergunta clara, e o botão de confirmar destacado como ação que não tem volta.

## Correção 4 — 🔴 duas abas do site, duas contas, uma "puxando" a outra

**O relato:** com a conta de teste aberta numa aba e a conta real aberta em outra aba do mesmo
navegador, depois de um tempo uma aba passou a mostrar os leads da OUTRA conta — mesmo com o nome
certo na saudação. O dono testou e confirmou sozinho: acontece exatamente quando há duas abas do
site abertas ao mesmo tempo, uma por conta.

**Causa:** o navegador guarda a sessão de login (o "crachá" que diz quem está logado) numa única
gaveta compartilhada por TODAS as abas do mesmo site — não existe uma gaveta por aba. Quando se
loga numa conta nova numa aba, a aba ANTIGA (ainda aberta, com a conta de antes) continua rodando
em segundo plano e, de tempos em tempos, renova sozinha o próprio login — e ao fazer isso,
sobrescreve a gaveta compartilhada com a sessão da conta ANTIGA de novo. A aba nova, na próxima
vez que busca os leads, acaba usando essa sessão errada que voltou pra gaveta — mesmo com o nome
certo na saudação, que já tinha carregado um instante antes disso acontecer.

**Correção:** toda aba do site agora fica de olho nessa gaveta. Se QUALQUER outra aba muda a
sessão guardada nela (por exemplo, por ter logado numa conta diferente), a aba atual recarrega
sozinha na hora — assim nenhuma aba "esquecida" de uma conta antiga consegue renovar-se em segundo
plano e devolver a conta errada depois. Na prática: pode continuar usando duas abas se precisar
comparar duas contas, mas ao trocar de conta numa delas, a outra vai recarregar sozinha (é
esperado piscar/recarregar) — e nenhuma das duas vai mais ficar "grudada" na conta errada.

## Teste novo

`tests/v1016-saudacao-flash-90dias-confirmacao-sair-abas.test.mjs` — cobre as quatro correções:
placeholder genérico removido, `messageCount90d` calculado e exibido, `cpSairDaConta` usando o
modal do app, e o listener de `storage` que recarrega a aba quando outra aba troca a sessão.

## `npm test`

Suíte inteira verde.
