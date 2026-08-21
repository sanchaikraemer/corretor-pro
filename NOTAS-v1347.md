# v1347 — o "Top 3 do dia" foi apagado (era peça morta dentro do app)

Você pediu: *"apara código morto da régua antiga q não aparece."* Feito.

## O que foi tirado

Existia dentro do app um bloco chamado **"Top 3 do dia"**: três cartõezinhos que apareciam no topo
da tela inicial, com os três clientes escolhidos pela **régua antiga** (compromisso vencido primeiro,
depois retorno combinado pra hoje, depois negociação em aberto, e assim por diante).

Esse bloco **não aparece na sua tela há muito tempo**. Quando a tela inicial passou a montar a
própria lista do dia, nada mais preencheu os três cartões — e a parte que os desenhava ficou lá,
completa, sem nunca ser usada. Interruptor na parede com o fio cortado: continua pregado, você
aperta, não acende nada.

Saíram junto os pedaços que só existiam para servir aquele bloco:

- os dois espaços vazios que ele ocupava dentro da tela inicial;
- as regras de aparência dos três cartões (cor, borda, tamanho, versão para celular);
- **cinco trechos diferentes** do app que gastavam linha só para *esconder à força* esses dois
  espaços vazios toda vez que a tela era montada;
- dois selinhos (⏳ "esfriando" e 🏠 "permuta") que só apareciam ali dentro;
- o atalho de teclado **1, 2 e 3**, que servia para escolher o primeiro, o segundo ou o terceiro
  cartão — e há tempos procurava cartão que não existe mais.

## O que NÃO foi tocado — e é o ponto

A **régua antiga continua inteira onde ela realmente aparece**:

- a ordem da tela de **Relatório**;
- a coluna a mais na **planilha** que você exporta;
- a divisão da tela inicial em grupos (Ação hoje / Retomar com cuidado / Pode aguardar…).

A ordem da **lista do dia** também continua exatamente a mesma: ela é decidida pela chance de
fechar (quem responde, quem pergunta, quem já falou de preço, documento, financiamento ou proposta).
Nada disso mudou nesta versão. Aparar peça morta não pode virar desculpa pra mexer no que você vê.

## Como eu conferi que nada sumiu da tela

Não bastava a bateria de testes passar — regra do projeto e lição da 1078. Abri as duas versões
lado a lado (a 1346 e esta) num navegador de verdade, no computador (1440px) e no celular (390px), e
comparei **regra por regra de aparência**: das 26 que saíram, 13 eram só dos cartões mortos, 9 eram
regras compartilhadas que voltaram idênticas sem a parte morta, e 4 são só a troca do número da
versão nos endereços de imagem. **Nenhuma regra de tela viva foi levada junto.** A tela inicial
desenhou os mesmos elementos nos mesmos lugares, com as mesmas cores e tamanhos, nas duas versões —
a única diferença foram os dois espaços vazios que deixaram de existir.

## O que muda pra você

Na tela, **nada** — é esse o objetivo. O app fica com cerca de 90 linhas a menos e 16 regras de
aparência a menos para carregar. O ganho real é de manutenção: quem for mexer no app depois (inclusive
eu, numa próxima conversa) não vai mais perder tempo com uma tela que parece existir e não existe.

Ficou de fora, esperando sua palavra: **unificar as duas réguas** (fazer o Relatório e a planilha
usarem a mesma ordem da sua tela inicial, pra o que você vê num lugar bater com o outro). É mudança
que aparece na tela, então não fiz por conta própria.
