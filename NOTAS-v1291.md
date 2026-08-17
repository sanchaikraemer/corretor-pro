# v1291 — o dono reescreveu as instruções da IA e mandou subir sem mexer

Dono, 17/08/2026. Ele atualizou o Cérebro pelo próprio app e mandou, em anexo, um zip com **um
arquivo só** (`api/_pipeline.js` — o miolo que monta o pedido enviado à IA), com a instrução:
**"quero q suba o q esta em anexo sem mexer em nada nele"**. Depois mandou também o texto do
Cérebro novo (Cérebro Corretor Pro V2.6, em blocos), só para registro — ele já tinha salvo esse
conteúdo direto no app.

O arquivo foi publicado **exatamente como veio**. Nenhuma linha dele foi alterada. O que este
documento registra é **o que mudou dentro dele** e, principalmente, **o que deixou de existir** —
porque parte das proteções escritas nas versões anteriores saiu junto.

## O que a versão faz

As instruções que acompanham o Cérebro em toda análise foram reescritas de ponta a ponta. O desenho
novo é: **o Cérebro do corretor decide o método, a estratégia, o tom e a condução**, e o sistema
entrega só (a) as proteções de fato e (b) o contexto técnico da conversa.

O que continua igual, ponto a ponto:

- **O Cérebro é a autoridade máxima** sobre método, análise, estratégia, tom, objeções e condução, e
  nada pode montar um segundo manual por fora dele.
- **As proteções de fato valem sempre**, inclusive na conta que ainda não configurou o Cérebro: não
  inventar fato, data, material, valor, condição, disponibilidade, promessa ou ação; não transformar
  silêncio em aceite, objeção ou diagnóstico sobre o cliente; separar fala do cliente, fala do
  corretor, observação manual e evento do sistema; e, quando a fonte não sustentar a afirmação,
  **manter a incerteza em vez de completar a lacuna**.
- **O contexto técnico chega inteiro**: data e hora no Brasil, fuso, saudação correta do horário,
  data da última mensagem, dias corridos parados, prazo de retomada configurado pelo corretor e o
  texto das tentativas dele que ficaram sem resposta.
- **O formato da análise continua completo** — todos os campos que a tela do cliente mostra
  continuam sendo pedidos à IA (faixa de valor, imóvel do cliente, quem decide, o que ele já contou,
  o que falta descobrir, pedido sem resposta, as três mensagens, recomendação de aguardar, etc.).
- **O código continua sem reescrever o texto da IA.** O corte determinístico de frase
  (`limparFrasesProibidas`) segue removido, como o dono mandou na v1247, e não voltou.
- **A revisão final continua sendo a última coisa que a IA lê** antes de escrever — agora com dez
  perguntas ("o que você chamou de fato está sustentado?", "alguma mensagem inventa novidade,
  urgência ou ação do corretor?", "a resposta está fiel ao Cérebro atual?").

## O que SAIU — leia esta parte

Estas eram regras escritas dentro do pedido enviado à IA, cada uma nascida de um print ou de uma
cobrança do dono. Na reescrita elas não têm mais texto próprio: **quem passa a decidir esses pontos
é o Cérebro Comercial**. Se algum defeito antigo reaparecer nas sugestões, é aqui que se procura.

| O que saiu | Nasceu de |
| --- | --- |
| Lista **"LINGUAGEM DE IA — PROIBIDO"** ("fico à disposição", "espero que esteja bem", "não hesite em", "sinta-se à vontade", "quis saber se", "faz sentido") | v1212 |
| Lista **"PALAVRA EM INGLÊS E JARGÃO DE ESCRITÓRIO"** (overview, insight, feedback, budget, call, follow-up, timing, update) com as traduções e a exceção de studio/duplex/garden/closet | v1280 |
| **"REGRA DA DATA — quem dá o dia é o cliente"** (proibição de cravar dia da semana e horário) | v1287 |
| **"RETOMADA DEPOIS DE DIAS SEM CONVERSA"** (abrir cumprimentando, trazer motivo real, proibição das desculpas prontas "sei que a vida corre" / "se ainda tiver interesse") | v1225 / v1274 |
| **"TEMPO PARADO NÃO ENTRA NA MENSAGEM"** | v1255 |
| **"A MENSAGEM QUE JÁ FOI IGNORADA NÃO VOLTA COM OUTRAS PALAVRAS"** e **"AS TRÊS NÃO PODEM SER TRÊS PEDIDOS DE LICENÇA"** | v1277 / v1225 |
| **"CLIENTE JÁ DISSE SIM — não peça a mesma permissão de novo"** | v1127 |
| **"PRODUTO ESPECÍFICO"** (capturar lote/quadra/apartamento/bloco/torre e listar unidade por unidade) | v935 |
| Parágrafo que proibia, com todas as letras, **afirmar endereço, rua, bairro ou CIDADE** sem fonte | v1115 / v1184 |
| Blocos do fecho, da entrega, do catálogo e do dado pessoal (v1256, v1257, v1260, v1261, v1262, v1267, v1279, v1289) | vários prints de agosto |

**Mudança de comportamento visível na tela:** até a v1290, quando a IA devolvia uma sugestão sem
cumprimentar e a conversa estava parada havia dias, o próprio sistema colocava "Bom dia, Fulano!" na
frente antes de mostrar. Isso **não acontece mais** — o texto sai exatamente como a IA escreveu. A
correção da faixa do dia (quando a IA escreve "boa noite" às 17h, o app troca por "boa tarde")
continua funcionando normalmente.

## O que foi feito na suíte de testes

O arquivo do dono não foi tocado; **os testes foram**. 42 arquivos de teste cobravam, letra por
letra, parágrafos que agora não existem mais.

- **27 foram reapontados** para a redação nova, guardando a mesma garantia (ex.: "única autoridade"
  virou "autoridade máxima"; "Prazo configurado pelo corretor para reconhecer intervalo" virou
  "Prazo de retomada configurado pelo corretor").
- **15 foram reescritos** para guardar o que sobrou e para registrar, dentro do próprio arquivo, o
  que saiu e o que precisa voltar se o defeito reaparecer. Nenhum foi apagado: o histórico de cada
  print e de cada cobrança continua legível ali.
- **Um teste novo** (`v1291-instrucoes-do-dono-chegam-inteiras`) trava a forma da entrega: Cérebro
  como autoridade, proteções de fato antes do Cérebro (valendo também pra conta nova), contexto
  técnico completo, formato de resposta completo e o Cérebro do corretor chegando inteiro na IA.

Suíte inteira verde: 24 arquivos checados + 447 testes.
