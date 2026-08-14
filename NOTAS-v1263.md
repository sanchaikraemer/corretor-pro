# v1263 — conferência final: o diagnóstico está certo, as mensagens é que não o executam

Diagnóstico diferente das dez versões anteriores. Desta vez o problema era **meu jeito de
consertar**, não uma regra faltando.

## O que a tela inteira revelou

O dono mandou a tela do cliente inteira, e ela mostra uma coisa que os prints só das sugestões não
mostravam: **a análise entendeu tudo certo.**

> **Resumo:** "Cliente procura apartamento menor, mas ainda com 3 dormitórios. O imóvel de
> interesse (Ed. Personalité) era muito além do orçamento. Cliente e família querem trocar o imóvel
> atual (motivo: acham o imóvel onde moram muito grande). Querem encaixar o imóvel próprio na
> negociação, mas ainda não sabem o valor exato deste. Está em consulta interna com esposo e
> filhos. Última resposta: 'Vou ver o valor correto'."
>
> **Fazer agora:** "Oferecer exemplos práticos de opções semelhantes enquanto o cliente verifica o
> valor e/ou facilitar a avaliação do imóvel atual pedindo detalhes fáceis (endereço, metragem,
> dormitório)."

Está tudo certo. O motivo da mudança, a permuta, quem decide, a promessa dela — e o próximo passo
exato. **A extração da v1259 funcionou.**

E logo abaixo disso, as três mensagens **esperando a cliente agir**.

Ou seja: **a análise sabia o que fazer e escreveu outra coisa.** O buraco não está no
entendimento — está entre o diagnóstico e a mensagem.

## E a variação entre rodadas

Duas reanálises da mesma conversa, com dez minutos de diferença:

| Hora | Como abria a nº 1 |
|---|---|
| 21:45 | *"já posso montar uma lista das opções que aceitam a entrada do imóvel de vocês"* — certo |
| 21:55 | *"**Assim que você tiver o valor** do seu imóvel, já consigo separar... **Se preferir**... **me sinaliza** caso prefira assim"* — três construções proibidas |

Mesma conversa, mesmas regras, resultados opostos. Isso não é regra faltando: é **variação**.

## A causa: fui eu que entupi o prompt

Entre a v1253 e a v1262 empilhei bloco de proibição em cima de bloco de proibição. O prompt
principal chegou a **~25 mil caracteres com 15 blocos de "É PROIBIDO"**, espalhados por milhares
de palavras. A cada rodada a IA honra um subconjunto diferente.

Escrever a 16ª proibição no meio do paredão daria exatamente no mesmo.

## O que mudou

Nada foi adicionado ao paredão. O que decide a qualidade das três mensagens foi **concentrado numa
lista curta, colocada DEPOIS da conversa** — a última coisa que a IA lê antes de escrever.

**O item mais importante, antes dos sete:** as três mensagens são a **execução do próximo passo que
a própria análise acabou de definir**. Se a mensagem não faz o que o "Fazer agora" diz, ela está
errada — por melhor que soe. Diagnóstico e mensagem têm que contar a mesma história.

**E os sete itens**, cada um amarrado a um erro que apareceu de verdade nas reanálises:

1. Começa pelo que o corretor faz? (não por "só preciso de", "me manda", "se quiser")
2. Alguma diz que vai esperar? ("assim que você tiver", "me avisa quando souber", "fico no aguardo")
3. Pede algo que a conversa já respondeu? (confere contra os campos da v1259)
4. Pede o que o cliente já prometeu trazer?
5. O fecho é escolha, pergunta útil ou passo? (nada de "quer que eu faça?"; escolha com dois
   caminhos diferentes de verdade)
6. A nº 1 é a mais forte das três?
7. Tem imóvel do cliente sem valor conhecido? Então uma das três oferece a avaliação.

E a conferência **manda reescrever**, não só verificar — conferência que não corrige vira enfeite.

## Por que depois da conversa

Porque é a última coisa lida antes de a IA escrever. Regra no meio de um texto de 25 mil caracteres
compete com tudo o que vem depois dela; regra no fim, não. O teste verifica essa posição de
propósito — se alguém mover a conferência pra cima, ele falha.

## Ajuste em teste antigo

`tests/v855` exigia que o prompt terminasse exatamente em `${timelineText}`. A conferência entra
depois disso agora, de propósito. O teste foi atualizado mantendo o que ele realmente protege
(horário e conversa no conteúdo de entrada, separados do Cérebro) e ganhou uma verificação nova: a
conferência tem que vir **depois** da conversa.

## Teste

`tests/v1263-conferencia-final.test.mjs` — trava a posição da conferência, os sete itens com as
frases reais que apareceram nas reanálises, o elo com o "Fazer agora" e a ordem de reescrever.
