# v1362 — o painel mostrava o custo da análise 5x maior do que é

Fui conferir no código cada ponto daquela análise de custo. Três coisas:

## 1. Achei um erro grande — e ele é a favor de você

A análise principal usa o modelo `gpt-5.6-terra`. **Esse modelo nunca entrou na tabela de preços do
app.** Quando o app não conhece o preço de um modelo, ele usa um valor propositalmente exagerado
(pra ficar visível que faltou mapear). Resultado: **toda análise aparecia com custo cerca de cinco
vezes maior do que o real.**

Com o preço certo (US$ 1 por milhão de tokens de entrada, US$ 6 de saída):

| | Painel mostrava | Custo real |
|---|---|---|
| Análise de conversa normal | US$ 0,080 | **US$ 0,022** |
| Análise de conversa gigante | US$ 0,230 | **US$ 0,052** |

Ou seja: cerca de **12 centavos de real** numa análise normal, **29 centavos** no pior caso de uma
conversa de anos. Isso muda a conta de tudo — inclusive se vale a pena cortar qualidade pra economizar.

## 2. Uma das economias sugeridas já está feita

"Trocar Terra por Luna em tarefas simples" — as tarefas simples do app **já não usam Terra**. O
aprendizado automático, o resumo do atendimento e a leitura de link usam `gpt-4o-mini`, que já é
barato. Essa alavanca já está puxada.

## 3. O que a análise acertou

A conversa vai inteira em toda análise (até 120 mil caracteres) e o modo incremental está
desligado. Isso é verdade — mas ele está desligado porque, quando estava ligado, foi você quem
flagrou o resultado: *"que ridículas essas sugestões"*. Ele manda **resumo** no lugar das mensagens
antigas, e a inteligência fica com pouco material real.

Com o número real na mão, a economia possível ali é de alguns centavos por análise, no risco de
voltar aquilo. Se ainda quiser tentar, o caminho seguro é religar **só para conversa muito longa** —
e eu meço antes na bateria das 32 conversas, pra você decidir com número e não com opinião.

Já feito e sem risco nenhum: o envio parou de repetir os áudios que o servidor já tem em texto
(versão 1361).
