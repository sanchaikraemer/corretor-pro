# v1212 — o aprendizado real da carteira passa a ser usado na hora de escrever as mensagens

## O que aconteceu

O dono mandou três prints de sugestões geradas pelo app e as mensagens que ele mesmo escreveu no
lugar delas, e depois a tela do Aprendizado com a planilha exportada. O que ele apontou, uma por
uma:

- *"Espero que esteja indo bem"* — frase pronta de e-mail, ninguém escreve isso no WhatsApp.
- *"Quis saber se você conseguiu conferir..."* — tempo verbal errado; no WhatsApp se pergunta direto.
- *"opções mais acessíveis" / "valor acima do esperado" / "menor investimento"* nas três mensagens —
  a cliente **nunca** disse que estava caro. A IA transformou "mandei o valor e ela sumiu" em
  objeção de preço confirmada. Nas palavras dele: *"ela vai pensar 'será que eles acham que não
  tenho dinheiro?'"*.
- *"faz sentido" / "se fizer sentido"* — jargão desgastado, ele odeia.
- Fechos longos e explicativos ("Me fala o que acha melhor pra facilitar sua busca") onde ele
  escreve curto ("o que acha?").

E a pergunta que abriu o caso: **se o sistema enxerga tudo isso, aprende, gera planilha e ainda
sugere o que colocar no Cérebro — por que não usa isso sozinho na hora de gerar as mensagens?**

## A verificação (a resposta é: realmente não usava)

Conta dele: **661 casos comerciais reais**, 316 históricos processados, 96 observações de estilo.
Cada caso guarda situação, sinal do cliente, impedimento, **a condução real dele**, o resultado, a
evidência e a regra prática. Tudo isso é extraído por IA (custa dinheiro), gravado no banco... e o
banco de casos era lido em exatamente dois lugares: a planilha de exportação e o contador da tela.
**Nenhum caso chegava em `analyzeWithBrain`.**

O único material de estilo que chegava era o bloco "tom" do `jeitoAprendidoCompacto` — e só os
**três últimos**, fossem eles o que fossem. Na conta dele a maioria é descrição abstrata:
*"conversação amigável e informativa"*, *"mantém um tom amigável e prestativo, sempre se colocando à
disposição"*. Pedir pra IA escrever "prestativo, se colocando à disposição" devolve exatamente
"fico à disposição" e "espero que esteja indo bem". A IA estava imitando um adjetivo, não uma
pessoa.

Ainda: `exemplosDoCorretor()` — função que extrai as mensagens reais do corretor **da própria
conversa analisada** — existia no arquivo e **não era chamada por ninguém**.

Não foi decisão de ninguém, é resíduo: a v1092 apagou uma `casosSemelhantesPrompt` por "sem
chamador", tratando como código morto o que era uma ligação que nunca chegou a ser feita. Mesmo
padrão do bug corrigido na v1084 (aprendizado gravado e nunca lido) e na v1115 (fatos ensinados
gravados e nunca lidos — a IA chegou a inventar a cidade errada). Terceira vez do mesmo erro.

## O que mudou (tudo em `api/_pipeline.js`, dentro do pedido da análise)

1. **Casos reais entram no prompt** — nova `casosSemelhantesPrompt(memoria, contexto, n)`. Não vão
   os 661: vão os **4 mais parecidos com a conversa analisada**, escolhidos pela mesma função de
   relevância que já filtra o resto do aprendizado, com desempate por resultado (validado vale mais
   que observado). Cada linha leva situação, sinal do cliente, **a condução real dele**, o resultado
   com a evidência e a regra que ficou. Caso marcado como `nao-funcionou` entra **identificado como
   contraexemplo** ("não repita este caminho aqui") — saber o que esfriou o lead vale tanto quanto
   saber o que destravou. Teto de tamanho no bloco, pra o prompt não crescer sem controle.
2. **As mensagens reais dele nesta conversa entram no prompt** — `exemplosDoCorretor()` foi ligada.
   É a régua de voz mais fiel que existe: é ele falando com aquele cliente. Custa zero (sai da
   timeline que já está na mão). Com instrução explícita: **copie a forma, nunca o conteúdo** — não
   reaproveite fato, valor, produto ou promessa dessas mensagens.
3. **Mensagem real na frente da descrição abstrata** — o bloco "tom" parou de ser `slice(-3)` cego:
   agora separa o que é mensagem real do que é descrição, manda até 2 mensagens reais primeiro e a
   descrição só completa. Sem nenhuma mensagem real guardada, o comportamento é o de antes.
4. **Lista negra de linguagem de IA**, escrita no prompt item por item, com as frases que ele
   rejeitou: "espero que esteja bem/indo bem", "faz sentido", "se fizer sentido", "fico à
   disposição", "não hesite em", "sinta-se à vontade", "quis saber se..." e companhia. Mais a regra
   do fecho curto no lugar do fecho explicativo.

Nada de informação comercial foi cravada no código: tudo o que entra vem do Cérebro do corretor, do
aprendizado das conversas dele ou da conversa analisada.

## O que isto NÃO resolve

A objeção de preço inventada (item 3 da lista dele) é regra de condução, e a regra certa está no
documento novo do Cérebro Comercial V3 que ele ainda não colou nas 6 caixas ("silêncio depois do
preço é sinal fraco, não confirma objeção"). O Cérebro que gerou aquelas mensagens é o antigo. Os
casos reais ajudam (mostram como ele conduz de verdade), mas quem manda nessa regra é o Cérebro.

## Testes

- Novo `tests/v1212-casos-reais-entram-na-analise.test.mjs`: monta um banco de casos, confere que a
  condução real do corretor entra no bloco, que o caso que não funcionou entra marcado como
  contraexemplo, que sem casos nada é inventado (bloco vazio) e que o limite de casos e o teto de
  tamanho são respeitados.
- Novo `tests/v1212-voz-real-do-corretor-no-prompt.test.mjs`: roda uma análise com a IA simulada e
  confere no pedido realmente enviado que a mensagem real do corretor entra antes da descrição
  abstrata, que as mensagens dele NESTA conversa entram (e as do cliente não), que está escrito
  "copie a forma, nunca o conteúdo" e que cada jargão proibido está listado.
- `npm test`: 24 arquivos checados + 379 testes, todos verdes.

Sem verificação visual em navegador: nenhum arquivo de tela foi tocado — a mudança é só no texto
que o sistema manda pra IA.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
