## v1411 — revisão final da condução interativa

- estado sem mensagem deixa de ser considerado válido por `messageNeededNow=false` + resumo genérico: agora exige `next_actor`/`operational_state` coerentes e motivo, ação, gatilho ou open loop verificável;
- a importação e a tela passam a usar a mesma régua de segurança, impedindo análise vazia de substituir ou aparecer no lugar de uma análise útil;
- `Reanalisar` repassa os participantes reais do WhatsApp ao motor, evitando inversão cliente/corretor quando o nome salvo é apelido, sobrenome diferente ou outro rótulo;
- `aguardar=true` sem obrigação objetiva do corretor normaliza o estado para espera do cliente/terceiro/sistema, eliminando a combinação contraditória “Sua vez” + “aguardar”;
- ação interna do corretor pode continuar com `next_actor=broker` e `messageNeededNow=false`, mas sem ser exibida como espera pelo cliente;
- versão atualizada para 1411 e regressões específicas adicionadas.

## v1410 — correção pós-publicação da 1409

- reanálise vazia com `messageNeededNow=false` deixa de ser considerada válida só por esse booleano; agora precisa trazer motivo, ação, resumo ou open loop real, preservando a análise anterior quando a nova vier sem conteúdo;
- `Reanalisar` passa a aceitar corretamente um estado válido de aguardar sem exigir três mensagens;
- o `aguardar` decidido pela IA deixa de ser descartado pela heurística genérica de “cliente falou por último”, salvo quando existe obrigação determinística do corretor (pergunta do cliente sem resposta ou promessa pendente);
- identificação de lado da conversa deixa de depender do nome salvo no cartão: apelido, sobrenome ou nome diferente não podem inverter cliente/corretor;
- conversa 1:1 usa o nome configurado do próprio corretor como evidência forte para reconhecer o outro autor como cliente, inclusive quando o nome do contato contém palavras como “Corretor”;
- o gate de publicação continua barrando teste vermelho e timeout, mas falha de máquina/pacote ausente volta a avisar e seguir, evitando repetir o bloqueio operacional da v1325;
- prompt deixa de mandar “escrever as três sugestões” e passa a pedir uma recomendação principal, com alternativas opcionais;
- Política de Privacidade e Termos passam a mostrar a versão 1410;
- novo teste de regressão `v1410-correcao-pos-publicacao.test.mjs` cobre os pontos acima.
- verificações históricas que ainda cobravam o contrato antigo (três mensagens, aviso de aguardar, revisão de privacidade e janela estreita do convite de upgrade) foram alinhadas ao comportamento atual; a função de envio explícito continua isolada e documentada, sem ligação com copiar.

## v1409 — estado comercial antes da mensagem e P0 da auditoria

- copiar sugestão deixa de ser tratado como mensagem enviada/atendimento;
- `messageNeededNow=false` passa a ser sucesso e não exige três textos;
- uma mensagem recomendada é suficiente; alternativas são opcionais;
- `nextActor`, `operationalState` e `qualificationStatus` passam a orientar a condução;
- `commercialState` v1 é persistido dentro da análise usando o motor determinístico existente;
- todos os caminhos de importação/reanálise aceitam o novo contrato (sem gate escondido de 3 mensagens);
- a métrica de desempenho deixa de chamar cópia de sugestão de "mensagem enviada" e passa a expor a limitação corretamente;
- bônus inicial também vale no período de teste;
- imagens/PDFs voltam por seleção inteligente (citados no TXT, com teto de quantidade/bytes);
- gate de publicação vira fail-closed;
- drift de configuração do orçamento da análise é corrigido para o padrão real de 240s;
- matriz de consolidação registrada em `AUDITORIA-v1409-MATRIZ.md`.

# Corretor Pro — Changelog

Este arquivo substitui a antiga prática de criar um `NOTAS-vNNN.md` para cada versão.

A partir da faxina documental feita após a v1377:

- mudanças novas entram neste arquivo, sempre no topo;
- `ESTADO-ATUAL.md` continua sendo a fonte de verdade sobre como o sistema funciona hoje;
- testes de regressão continuam registrando os bugs que não podem voltar;
- as antigas `NOTAS-v*.md` foram retiradas da árvore ativa do repositório porque o próprio histórico do Git já preserva essas versões;
- um backup externo das notas até a v1377 foi gerado antes da remoção.

## v1408 — o modelo da análise volta pro que ele considerava bom

**"esta tao bosta q to usando o chat gpt pra sugerir as mensagens"** e, depois de eu recomendar e
perguntar: **"nao adianta passar o problema pra mim, nesse caso nao preciso de vc, concorda?"**
(dono, 27/08/2026). Ele tem razão — decidir é trabalho meu. Decidido e feito.

A linha do tempo, do próprio histórico do projeto:

- **v1308** — o modelo da análise virou `gpt-5.6-terra` **sem ordem dele**;
- **v1315** — ele mandou desfazer as mudanças daquela janela; o prompt voltou, **o modelo ficou
  trocado**. É o caso que criou a REGRA ZERO do CLAUDE.md: ele achou que tinha voltado, seguiu
  insatisfeito por dias, e ninguém entendia por quê;
- **v1384** — o `gpt-5.6-terra` voltou como **teste**, pra ele comparar com o `gpt-4.1` e decidir.
  A comparação nunca foi fechada e o teste ficou valendo como padrão.

Fechado aqui: **`gpt-4.1`**, o modelo da v1292 — o que ele chamou de bom. Análise, mensagens e
orquestrador. `DIRECIONA_MAIN_MODEL` continua mandando na hospedagem, se um dia precisar.

Conferido junto, porque foi assim que a troca de 18/08 quebrou tudo: o parâmetro de tamanho da
resposta volta a ser `max_tokens` (a família 5 exige `max_completion_tokens`, e a v1311 nasceu de
TODA análise voltando erro 400 por causa disso), e o painel continua sabendo o preço do modelo.

Guarda: `tests/v1408-modelo-da-analise-volta.test.mjs` — não proíbe trocar de modelo, proíbe trocar
sem que ninguém perceba, que é o que aconteceu duas vezes.


## v1407 — a demora, e as três datas de volta pro topo

**"veja pq ta demorando demais a analise e tambem a reanalise... historico com 2 ou 3 mensagens
leva 1 min"** (dono, 27/08/2026).

Medido: numa conversa de 3 mensagens o app fazia **duas** chamadas à IA. A primeira é a análise.
A segunda era a reescrita — disparada porque a conferência reprovava *"posso te mostrar o
apartamento amanhã às 10h. Serve?"* com o motivo "inventa dia/horário sem compromisso real".

Não havia invenção nenhuma: é uma proposta, com pergunta no fim. E o Cérebro do dono manda
exatamente isso — *"Convite de visita, café ou reunião que você ofereceu e nunca virou data é
pendência ABERTA: retome-a com data e horário concretos"*. O app reprovava a mensagem que o
próprio Cérebro pede, pagava uma chamada a mais e ainda entregava a versão reescrita, sem a data.
Mesmo erro que a v1394 corrigiu para o convite; agora para o dia e a hora. **Conversa curta voltou
a custar uma chamada só.** Continua pego o que sempre foi o risco: AFIRMAR que o horário já estava
combinado ("conforme combinamos, terça às 10h").

No caminho do atalho/compartilhar, a leitura de link (janela de 20s) e a de imagem/PDF (22s) eram
sequenciais — até 42 segundos de fila por nada. Agora rodam juntas, como já rodavam na importação
normal.

O que o código leva pra montar tudo: **110ms**. Toda a espera restante é a IA respondendo.

**As três datas voltaram pro topo do lead** — "preciso q as 3 informações estejam mais no topo do
lead". Última análise, último atendimento e última mensagem moravam dentro do recolhível "Resumo
do contato" desde a v1365; agora ficam em linha logo abaixo do nome e da situação. Conferido no
navegador em 390px (uma embaixo da outra) e 1280px (lado a lado), sem rolagem lateral. O
recolhível continua guardando as últimas mensagens da conversa.

Guarda: `tests/v1407-propor-horario-nao-e-inventar.test.mjs`.


## v1406 — o manual de vendas do app sai de cima do Cérebro

Ordem do dono, 27/08/2026: *"Tente ensinar ele a analisar a conversa e sugerir... não adianta
ficar proibindo mil e uma coisa... ele tem o cérebro, tem as informações, tem inteligência
comercial, tem o aprendizado, e não está sendo usado em nada."*

Medido na conversa real do Rafael (73 mensagens): o pedido enviado à IA tinha **44.713 letras**,
das quais **31.069 de instrução do app** e só 13.644 da conversa do cliente. Boa parte dessa
instrução era uma versão pior do que o Cérebro do corretor já diz melhor — a mesma ordem escrita
duas vezes, em palavras diferentes.

Agora, quando o corretor tem Cérebro configurado, seis blocos do app deixam de ir junto: a
INTELIGÊNCIA COMERCIAL BASE, o "IMPORTANTE SOBRE O HISTÓRICO", o "Reconstrua a situação comercial
sem checklist", os três itens depois do formulário, a lista de regras das três mensagens e os nove
primeiros itens da revisão final. **Pedido: 37.688 letras — 7.025 a menos, todas de repetição.**

Continua indo sempre: integridade, fato medido pelo app (relógio, fichário, contexto técnico),
formato da resposta, regra fixa de abertura, regras de escrita (v1247) e a conversa inteira.
Conta sem Cérebro continua recebendo o manual inteiro. Desligar as quatro chaves continua
deixando só a conversa.

Guarda nova: `tests/v1406-cerebro-manda-nao-o-manual-do-app.test.mjs`. Dois testes foram
atualizados de propósito, com o motivo escrito dentro deles: `tests/v1400` (o assert "o manual de
vendas também continua indo" virou o contrário, e ganhou um item novo garantindo o manual na
conta sem Cérebro) e `tests/v945` (a checagem do playbook vivo passou a rodar na conta sem
Cérebro, que é quem depende dele).


> Referências antigas a `NOTAS-vNNN.md` em comentários e documentos significam “consulte o histórico Git daquela versão”. Elas foram mantidas quando ajudam a explicar a origem de uma regra, mas os arquivos individuais não voltam a ser criados.

## v1405

**Ordem do dono, 27/08/2026: "funde os quatro pares repetidos".**

Cada par virou **um** campo. Quem ficou de cada par foi escolhido por **uso real**, não por gosto — medido campo a campo antes de mexer:

| par | ficou | saiu | por quê |
|---|---|---|---|
| 1 | **O cliente já contou** (`jaSabemos`) | *O que o cliente quer*, *Condição que o cliente colocou* | `jaSabemos` é o único dos três citado como **regra** dentro do próprio pedido |
| 2 | **Impedimento principal** (`objecaoPrincipal`) | *Por que ele quer mudar* | `objecaoPrincipal` alimenta `objecaoIdentificada`, `impedimentoPrincipal` e outras telas |
| 3 | **Imóvel do cliente na negociação** (`imovelDoCliente`) | *Permuta / entrada com imóvel* | é o card **factual**; o outro era ação, e a condição estava misturada no par 1 |
| 4 | **O que ainda falta descobrir** (`faltaDescobrir`) | *Pedido do cliente ainda sem resposta direta* | o app **já mede sozinho** o pedido em aberto, no fichário (v1367) |

### Fundir não é apagar

Cada campo que ficou **absorveu o sentido** do que saiu — senão "fundir" viraria "perder":

- `jaSabemos` passou a pedir os critérios **com a força de cada um** (exigência ou preferência), que era o que o card removido dava, e traz a ordem explícita: *"não repita esses fatos em outro campo"*;
- `objecaoPrincipal` passou a incluir *"o motivo declarado de estar procurando/mudando quando é ele que aperta"*;
- `imovelDoCliente` passou a incluir *"a condição que ele colocou em cima disso"*;
- `faltaDescobrir` passou a incluir o pedido em aberto — e ele **abre** a lista, não some no meio dela.

### O objeto gravado manteve a forma

Nenhum lead antigo, exportação ou tela perdeu conteúdo: cada campo removido do pedido caiu na **reserva** do que o absorveu (`pedidoSemResposta` ← primeiro item de `faltaDescobrir`; `pendenciaFinanceira` ← `imovelDoCliente`; `motivoDaMudanca` ← `objecaoPrincipal`). A coluna *"Pendência financeira já identificada"* da planilha continua preenchida.

### O resultado, medido

O **pedido** quase não encolhe (25.501 → 25.488 letras): as definições que ficaram são maiores, porque absorveram sentido. A economia está na **saída**, que é onde o tempo vai — nesse caso real a IA deixa de escrever:

| campo removido | letras |
|---|---|
| O que o cliente quer | 331 |
| Condição que o cliente colocou | 226 |
| Permuta / entrada com imóvel | 100 |
| Por que ele quer mudar | 77 |
| Pedido do cliente ainda sem resposta direta | 70 |
| **total** | **804 por análise** |

Somando com as 540 da v1404: **1.344 letras a menos de escrita por análise**.

Regressão: `tests/v1405-quatro-pares-fundidos.test.mjs` — guarda os dois lados (o que saiu **e** que quem ficou absorveu o sentido), e que o objeto gravado manteve a forma, rodando a análise de verdade contra uma IA simulada.

Cinco guardas antigas foram atualizadas **de propósito**, com o motivo escrito em cada uma: `v1058`, `v1253`, `v1256`, `v1259` e `v1279`. Nenhuma passou batido — todas quebraram, foram lidas e reescritas uma a uma.

## v1404

**Ordem do dono, 27/08/2026: "tira os tres blocos novos de 25/08".** São os três cards que a v1388 criou na ficha do cliente:

- **"O que o cliente exige"** (campo `requisitos`)
- **"O que o imóvel em análise não atende"** (`compatibilidade.naoAtende`)
- **"Conflito com o que existe hoje"** (`compatibilidade.conflito`)

Medido no texto real de uma análise dele: os três somavam **540 letras por análise**, repetindo o que os cards vizinhos já diziam — "O cliente já contou", "Faixa de valor que a conversa já indica" e "Imóvel do cliente na negociação".

### A ordem foi cumprida inteira, não pela metade

Sair só os campos deixaria no pedido as instruções que existiam *por causa* deles — que era a parte mais cara. Saíram junto:

- os campos `requisitos` e `compatibilidade` (todos os sub-campos, inclusive `existeOpcaoQueReuneTudo`, que também nasceu na v1388);
- a seção inteira **"O QUE O CLIENTE EXIGE × O QUE EXISTE"** — três blocos de regras que iam em toda análise;
- os itens 15 e 16 da revisão final, que só falavam desses campos;
- a normalização e a **gravação** no banco (campo gravado que ninguém pede é lixo que cresce);
- o formatador `cp1388Requisitos` na tela, que perdeu o único chamador.

**E nada além disso.** Três regras chegaram na mesma v1388 mas não são os blocos que ele mandou tirar — *"não pergunte o que já está respondido"*, *"três coisas diferentes: anúncio × imóvel em análise × necessidade atual"* e *"timing"*. Ficaram, só perderam a citação ao campo que não existe mais. `tests/v1404` guarda as duas coisas: o que saiu **e** o que ficou.

### Resultado medido

| | letras no pedido |
|---|---|
| antes da v1404 | 28.814 |
| depois | **25.501** |
| economia | **3.313 por análise (11%)** |

E isso é só a entrada — some a isso as ~540 letras que a IA deixa de **escrever** em cada análise, que é a parte onde o tempo realmente vai.

O teto de resposta (4.000 tokens) **fica onde está**: ele é rede contra JSON cortado, não meta de tamanho. Baixá-lo criaria risco sem economizar nada, porque o modelo escreve o que precisa, não o teto.

Regressão: `tests/v1404-tres-blocos-de-25-08-removidos.test.mjs`, que **substitui** `tests/v1388-estado-da-negociacao-antes-das-mensagens` — invertido para guardar a ausência, mesmo padrão que a v1381 usou com a bateria no painel.

Conferido em Chromium (390 px): nenhum dos três cards aparece, sem erro de JavaScript e sem estouro horizontal. A guarda `tests/v827-catalogo` pegou, no caminho, que eu tinha escrito nome de cliente e de empreendimento dentro de comentário de código — corrigido antes de publicar.

## v1403

*"muita coisa informando q deve gastar tempo e tokens, coisas q nunca sao lidas ou usadas, muita coisa repetida e desnecessária"* (dono, 27/08/2026, com quatro prints da análise do Rafael Renaissance).

Ele está certo, e eu estava errado quando disse que "não existe corte grátis". **Os 43 campos aparecem na tela — mas dizendo a MESMA coisa várias vezes.**

### A duplicação, medida no texto real da análise do Rafael

Nesses campos a IA escreveu **3.860 letras** para dizer, no fundo, sete fatos:

| fato | em quantos campos aparece |
|---|---|
| a casa da Rua Presidente João Goulart, 265 | **11** |
| não pode esperar 4 ou 5 anos | **6** |
| negócio de até R$ 800 mil | **6** |
| 3 dormitórios / Rui Barbosa / área de recreação | **5** |
| a avaliação da casa está pendente | **5** |
| o café na construtora sem dia | **5** |

Dois campos chegaram a sair praticamente com a mesma frase: *"Por que ele quer mudar"* = "Não **teria** como esperar 4 ou 5 anos pela construção de um novo empreendimento" e *"Impedimento principal"* = "Não **consegue** esperar 4 ou 5 anos pela construção de um novo empreendimento".

### O que foi cortado nesta versão

Varridos os 43 campos um a um, como **acesso de propriedade** — a busca por palavra solta não serve, porque "atende" e "conflito" são palavras comuns em português e aparecem em comentário e no texto do prompt (foi o erro da minha primeira varredura, que deu "0 campos mortos").

Dois campos eram escritos pela IA, gravados no banco e lidos por **ninguém** — nem tela, nem servidor, nem o raciocínio do próprio pedido:

- **`compatibilidade.imovelEmAnalise`**
- **`compatibilidade.atende`** (a lista do que o imóvel CUMPRE — só a lista do que ele NÃO cumpre é mostrada)

Saíram, pela regra da **v1145**, do próprio dono: *"se não aparece na tela, não precisa existir"*.

**`existeOpcaoQueReuneTudo` ficou**, mesmo sem aparecer na tela: ele muda o comportamento da IA dentro do próprio pedido (quando não existe opção que reúna tudo, fica proibido prometer procurar). Campo de raciocínio não é campo morto — a diferença importa e está travada no teste.

Regressão: `tests/v1403-campo-morto-nao-e-pedido-a-ia.test.mjs` — inclui a varredura virada em guarda: **se alguém acrescentar um campo ao formato e ninguém ler, a suíte falha** e cobra a leitura, em vez de o campo virar peso morto por meses.

## v1402

*"está demorando demais"* (dono, 27/08/2026, print da importação parada em **"Abrindo o arquivo · 68%"**, 103 s no relógio).

**Não estava travada** — e desta vez o problema era a tela, não o motor.

A v1359 já tinha consertado **metade** disto: a legenda passou a dizer *"abrindo e já analisando pelo seu Cérebro, tudo numa viagem só · Ns"*. Mas a **etapa em destaque continuou sendo a 2** ("Abrindo o arquivo"), com duas etapas ainda apagadas embaixo — "Ouvindo os áudios" e "Analisando pelo seu Cérebro". Quem olha lê: *estou no passo 3 de 6, faltam três, e já se passaram 103 segundos*. Parece travado, e parece faltar o triplo do que falta de verdade.

A verdade: quando a análise vem na mesma viagem, o servidor só aceita esse caminho se **não houver áudio pendente** (`!audiosPendentes.length`, em `api/processar-storage.js`). Logo, "Ouvindo os áudios" não vai acontecer, e a etapa que está rodando **é** "Analisando pelo seu Cérebro". A tela passa a mostrar isso: etapa 4, **86%**, com as anteriores marcadas.

Não deixa mais rápido — deixa honesto, que é o que faltava aqui desde a v1359.

### Onde o tempo vai, medido no mesmo dia

- **Não é o preparo:** o servidor só analisa junto se a preparação levou menos de 45 s; acima disso ele devolve e a análise vai numa chamada própria.
- **Não são os casos religados na v1401:** pontuar os 661 casos e montar o bloco custa **56 ms**.
- **É a saída da IA:** 43 campos de JSON mais as três mensagens, com teto de 4.000 tokens. Escrever é o que demora, não ler.
- O pedido cresceu ~30% hoje (fichário 4.796 letras na v1395 + casos 1.863 na v1401), as duas por ordem do dono. Isso pesa na entrada, que é a parte barata.

Regressão: `tests/v1402-etapa-honesta-na-importacao.test.mjs` — trava o índice da etapa contra a lista de rótulos (se alguém reordenar as etapas, o teste falha em vez de a tela voltar a mentir) e confere que a condição de "sem áudio pendente" continua no servidor, que é o que torna honesto pular a etapa de áudio.

Conferido em Chromium (390 px): com a análise junto, a lista mostra as quatro primeiras marcadas e "Analisando pelo seu Cérebro" como etapa ativa.

## v1401

**Ordem do dono, 27/08/2026: *"liga com o corte"*.** Veio da pergunta dele — *"como assim te contar como retomo cliente, e o aprendizado e o histórico serve pra que então?"* — depois de eu pedir que ele **digitasse** o método de retomada dele.

**Ele tinha razão, e a medição prova.** `casosSemelhantes` estava **cravado em `""`** dentro do `analyzeWithBrain`: os **661 casos reais da carteira nunca chegavam à IA**. Alimentavam só a planilha de exportação e o contador da tela. Cada caso guarda a situação, **como ele conduziu**, o resultado e a regra que ficou — existe até a categoria `padroesFollowup` (*"depois de N dias de silêncio o corretor reaqueceu com Y e o cliente respondeu"*). Ou seja: o *"me conta como você retoma um cliente"* que eu pedi **já estava gravado no sistema dele o tempo todo**. Pedir foi empurrar pra ele trabalho meu — a REGRA ZERO-B do `CLAUDE.md`.

### Por que isto reverte a v1301, e por que pode

A fonte saiu em 18/08 porque empreendimento e endereço de um cliente apareceram na mensagem escrita para **outro**. O que segurava era um **pedido à IA** (*"nunca transfira fatos de outro lead"*) — e pedido não segura. Hoje existem **duas proteções por código**:

1. **`limparAprendizadoDeOutroCliente`** (v1326, criada *depois* do desligamento): apaga nome, empreendimento, valor e endereço **antes** de o texto entrar no pedido;
2. **o corte desta versão**: saem do bloco os dois campos mais literais de outra conversa — `sinalCliente` e `evidenciaResultado`, que são falas **copiadas** do outro cliente.

Medido antes de cortar, num caso típico: **método** (condução + regra) = 287 letras; **fato do outro cliente** (situação + fala do cliente + evidência) = 343 letras. O corte tira **172 letras de conversa alheia por caso**, sem perder nada de método. A superfície de conversa de terceiros ficou **menor do que era em 18/08**, quando ele foi queimado.

O que a IA passa a receber:

```
- Situação: Cliente pediu informações pelo anúncio e sumiu por 8 dias sem responder a pergunta
  de qualificação | Você conduziu assim: Retomei dizendo que a unidade seguia disponível e
  ofereci mandar um vídeo pelo WhatsApp antes de falar de visita | Resultado: validada |
  Regra que ficou: Em retomada de anúncio frio, entregar algo antes de pedir qualquer coisa
- Situação: Lead de anúncio parado, corretor insistiu na mesma pergunta de finalidade |
  Você conduziu assim: Repeti a pergunta sobre morar ou investir com outras palavras |
  NÃO FUNCIONOU — não repita este caminho aqui | Regra que ficou: Repetir pergunta ignorada
  queima o contato
```

O que **não funcionou** entra marcado: saber o que queimou o contato ensina tanto quanto saber o que destravou.

Os casos seguem a chave **"Usar o aprendizado"** da tela, e a linha da análise passa a mostrar quantos entraram (*"aprendizado aplicado: seu jeito de escrever, 3 casos seus"*) — se um fato estranho aparecer numa sugestão, o dono vê na hora de onde veio.

**As duas guardas que travavam isto (`tests/v1301` e `tests/v1212`) foram atualizadas de propósito, com o motivo escrito no próprio teste.** Numa primeira tentativa, mais cedo no mesmo dia, a religação passou por elas **por acidente de expressão regular** — a suíte ficou verde sem que as travas disparassem. Aquela tentativa foi revertida inteira antes de qualquer publicação; esta é deliberada e está registrada.

**Continua fora, e não volta sem ordem dele:** `conhecimentoCorretorTexto` (os "fatos ensinados" da carteira inteira). Outra fonte, outro risco, ordem inalterada.

Regressão: `tests/v1401-casos-reais-voltam-sem-vazar.test.mjs` — reprova se qualquer nome, valor, empreendimento ou endereço de outro cliente escapar, se a fala copiada do outro cliente voltar ao bloco, ou se a fonte voltar a ser uma string vazia cravada (o bug que ficou invisível desde 19/08).

## v1400

**Pergunta do dono, 27/08/2026: *"vc ta me dizendo que o cerebro nao estava ligado nem sendo usado?"***

**A resposta é NÃO — o Cérebro dele foi usado em toda análise.** Mas a pergunta expôs um risco que a v1399 tinha acabado de criar, e que precisou ser consertado na hora.

Da v1382 à v1399 os quatro botões não faziam nada: eram lidos, salvos e ignorados pela análise. Na conta do dono os quatro estavam gravados como **desligados** (conferido no print: no tema escuro um botão marcado renderiza verde chapado, e os dele estavam escuros e vazios) — e mesmo assim toda análise rodou com Cérebro, aprendizado, regras e piso **ligados**, porque as chaves não tinham efeito.

A v1399 religou as chaves. **Sem esta correção, a próxima análise dele rodaria sem o Cérebro:** um valor gravado numa época em que o botão não fazia nada viraria ordem de verdade. Ninguém pediu isso — seria a v1399 desligando o Cérebro dele sozinha.

**O carimbo `chavesAnaliseVersao`** separa as duas coisas:

- **sem carimbo** (todo Cérebro salvo antes desta versão) → as quatro valem **ligadas**, que é exatamente como a análise rodou esse tempo todo. A tela também mostra as quatro marcadas, para não voltar a haver tela dizendo uma coisa e motor fazendo outra — o problema que abriu esta investigação;
- **com carimbo** → a escolha do corretor vale. Ele é gravado na primeira vez que o Cérebro é salvo na tela nova.

Também corrigido: o carimbo estava sendo **apagado no saneamento** do `_pipeline.js` antes de a análise ler as chaves — a escolha nunca chegaria ao motor e as quatro ficariam ligadas para sempre. Pego pelo próprio teste de regressão, não na revisão a olho.

Regressão: `tests/v1400-chave-velha-nao-desliga-cerebro.test.mjs` — inclui o caso exato do dono (quatro desligadas, sem carimbo → tudo continua ligado), a guarda de que tela e servidor exigem o **mesmo número** de versão, e a guarda de que o carimbo sobrevive aos três saneamentos.

## v1399

**Ordem do dono (27/08/2026): religar as quatro chaves da análise.** Ele mandou o print da tela do Cérebro — *"não to entendendo todas essas opções"* — e, indo explicar o que cada botão fazia, a descoberta:

**Os quatro botões estavam desligados do motor desde a v1382.** Os valores `usarCerebro`, `usarAprendizado`, `usarRegrasEscrita` e `usarPisoComercial` eram lidos, sanitizados, salvos no banco e **nunca usados em lugar nenhum da análise**. Ligados ou desligados, o pedido enviado à IA saía idêntico.

Junto morreu **`modoAnalise`** — o campo que faz aparecer na tela a tarja *"Análise de teste: o seu Cérebro estava desligado"* (`cp1308FaixaModoHtml`, em `app.js`). Nada preenchia esse campo, então a tarja **nunca apareceu**, e por isso o dono nunca foi avisado de que os botões não valiam nada. Os quatro continuaram na tela mostrando um estado sem efeito.

As chaves são de 19–20/08 (v1308/v1310), então saíram junto na volta da análise ao estado de 17/08 e **essa remoção estava certa**. Voltam agora porque ele mandou.

**É a terceira peça encontrada morta pela mesma restauração**, depois da conferência das três mensagens (religada na v1393) e do fichário (religado na v1395, também por ordem dele).

O que cada chave volta a fazer:

- **Usar o meu Cérebro** — desligada, o método/tom/regras não vão no pedido, e a IA recebe um aviso explícito de que foi desligado de propósito (não que o Cérebro está vazio — são coisas diferentes e a IA precisa distinguir).
- **Usar o aprendizado** — desligada, não vão o "SEU JEITO" nem os exemplos reais de escrita deste corretor nesta conversa.
- **Usar as regras de escrita** — desligada, some a lista "LINGUAGEM DE IA — PROIBIDO" e a de palavras em inglês, **e o app deixa de refazer a sugestão reprovada** — que é exatamente o que a tela promete. A conferência continua rodando e o aviso continua aparecendo; o que some é o app reescrever.
- **Usar o manual de vendas do app** — desligada, o piso comercial (`INTELIGENCIA_CARTEIRA`) não vai. Com as quatro desligadas, vai só a conversa — a promessa escrita na própria tela.

**A garantia que sustenta o religamento:** com as **quatro ligadas**, que é o padrão, o pedido enviado à IA é **idêntico byte a byte** ao de antes desta versão (conferido com as duas versões do código lado a lado; a única diferença entre as execuções foi o relógio). As chaves não são camada de qualidade: só mudam alguma coisa quando o dono desliga uma de propósito, para comparar.

Regressão: `tests/v1399-quatro-chaves-religadas.test.mjs` — inclui a guarda de que as chaves precisam ser **usadas**, não só lidas (o bug exato da v1382), e a guarda de que a tela e o servidor continuam falando o mesmo formato de `modoAnalise`, senão a tarja volta a nunca aparecer.

## v1398

*"reanálise travou aí e não foi mais"* (dono, 27/08/2026, print das 09h12 — barra parada em 85%).

**Causa medida:** o orçamento de tempo da análise (240 s, dimensionado para caber nos 300 s da rota) começava a contar **imediatamente antes da chamada da IA**. Tudo o que acontece antes ficava fora da conta:

- a busca da memória comercial no banco — uma ida à rede, que leva o que a rede quiser;
- a montagem do estado comercial e do fichário — **4,7 s medidos** numa conversa de mil mensagens;
- o preparo da conversa.

Ou seja: o orçamento prometia caber nos 300 s e podia estourar, porque partia **depois** de um pedaço do trabalho já ter acontecido. Quando estoura, a função é morta no meio e o corretor não recebe erro nenhum — recebe a barra parada, que é exatamente o print.

Agora o cronômetro parte no início da análise e o que o preparo gastou é descontado da janela dada à IA, com piso de 15 s (preparo lento demais não pode virar erro instantâneo: a análise tenta, e quem corta é a rota). **Nada muda no que a IA recebe nem no que ela devolve** — muda só de onde o cronômetro parte.

Regressão: `tests/v1398-orcamento-cobre-a-analise-inteira.test.mjs`, incluindo a guarda de que existe **um** cronômetro só (dois seria voltar ao bug por outro caminho).

### Medição do tempo, feita no mesmo dia (conversa da Sirley: 3 mensagens, sem áudio)

| | letras |
|---|---|
| A conversa de verdade | **251** |
| Instruções fixas do sistema | 4.529 |
| Piso de inteligência comercial (texto fixo) | 2.836 |
| Fichário (religado na v1395) | 4.796 |
| **Total enviado à IA** | **28.552** |

A análise faz **uma** chamada de IA, não duas (a conferência não reprovou nada nesse caso). O tempo não está na entrada: está na **saída** — são 43 campos de JSON mais as três mensagens, com teto de 4.000 tokens de resposta.

**Não existe corte grátis:** conferido campo a campo, todos os 43 aparecem em algum card da tela (`requisitos` vira "O que o cliente exige"; `compatibilidade.naoAtende` vira "O que o imóvel em análise não atende"; e assim por diante). Encurtar a análise é uma **troca** — menos relatório em troca de mais velocidade — e essa escolha é do dono, não minha.

## v1397

*"revise antes de dizer q está resolvido"* (dono, 27/08/2026). Revisando o próprio código das versões anteriores, **dois defeitos que eu tinha introduzido** nas redes que ampliei:

- **"renda" e "rendimento" não são finalidade.** Ao ampliar o tópico `finalidade` na v1394 — para pegar "usar o apartamento ou alugar?", que era a sugestão 2 do print e escapava — entraram na lista as palavras `renda` e `rendimento`. Sozinhas elas querem dizer **salário**, não renda de aluguel, e passaram a puxar pergunta de **financiamento** para dentro de finalidade. Consequência real: numa conversa em que a pergunta ignorada fosse "morar ou investir", uma pergunta legítima como *"você pode usar o FGTS ou vai precisar de renda comprovada?"* levaria tarja vermelha de "repete a pergunta que o cliente já ignorou". As duas palavras saíram; "renda de aluguel" continua coberta pela palavra `aluguel`.
- **Idade desconhecida virava "recente".** O aviso condicional da v1396 usava `Number(v.diasAtras)`, e `Number(null)` é `0` — que nunca chega aos 60 dias. Um valor cuja data o app não conseguiu ler era então declarado recente, e o bloco afirmava *"todos os valores acima são recentes, o corretor já os conhece"* sobre um fato que ninguém mediu. Agora são **três** estados: velho (reconfirma), recente (não plante dúvida) e **desconhecido** (não afirme nada nas duas direções — seria inventar, que é o que este projeto proíbe).

Nenhum dos dois tinha aparecido em print: os dois foram achados relendo o diff das v1394–v1396 atrás de estrago colateral.

Regressão: `tests/v1397-revisao-das-redes-que-eu-ampliei.test.mjs` — inclui as duas pontas de cada rede, para o conserto não desfazer o motivo pelo qual elas foram ampliadas.

## v1396

Terceiro print do caso Sirley (dono, 27/08/2026 às 08h17), já com o fichário ligado. **A pergunta ignorada sumiu das três — a v1394/v1395 funcionou.** No lugar apareceram dois defeitos novos, os dois medidos no código:

- **DUAS das três abriram com "vou confirmar o valor atualizado".** A IA copiou essa frase **literalmente** do fichário: o bloco de valores entregava ela pronta, entre aspas, e disparava para QUALQUER valor citado, sem olhar a idade. No caso, os R$ 430 mil saíram da boca da própria cliente **há oito dias**, lidos do anúncio do corretor. Dizer isso a ela planta a dúvida de que o preço mudou — numa retomada, exatamente o oposto do objetivo — e contradiz o bloco vizinho do mesmo fichário, que diz que preço já dito é do CORRETOR, e ele sabe.
- **A terceira sugestão era promessa pura, sem pergunta nenhuma:** *"Vou confirmar o valor atualizado e a disponibilidade dessa unidade para te passar a informação certa."* Numa retomada de oito dias de silêncio, isso não dá à cliente nada para responder. A rede que pega isso (`PROMESSA_VAZIA`) existe desde sempre — ela só pedia o **plural** "informações" e deixava passar o singular "informação". Uma letra.

O que a v1396 faz:

- **A idade do valor continua indo sempre** (é o fato), mas a ordem de reconfirmar virou condicional: só a partir de **60 dias**. Abaixo disso o bloco diz o contrário, com todas as letras — *"são o preço desta negociação, e o corretor já os conhece; NÃO escreva mensagem dizendo que vai confirmar o valor atualizado nem sugerindo que o preço pode ter mudado"*.
- **A frase pronta entre aspas saiu do pedido.** Era ela que a IA estava copiando para a tela. O caso de valor velho continua coberto, agora descrito sem entregar o texto mastigado.
- **`PROMESSA_VAZIA` passou a pegar o singular** e as formas no infinitivo ("para te passar a informação", "posso te mandar o detalhe"). Prometer **e** perguntar continua liberado — só a promessa sozinha é o problema.

O bloco de valores nasceu na v1317 para o caso oposto (*"um preço de sete meses atrás e um preço de ontem chegam na IA com a mesma cara"*), e esse caso continua coberto: `tests/v1396` confere que um valor de janeiro ainda pede reconfirmação.

Regressão: `tests/v1396-valor-recente-nao-vira-duvida.test.mjs`.

## v1395

**Ordem direta do dono (27/08/2026): *"liga o fichário e mede com o caso da Sirley"*.** A v1394 tinha medido que `montarFicharioDaConversa` — o fichário da conversa (v1317) — não tinha um único chamador em produção desde a v1382, e deixou a decisão com ele. Ele mandou ligar.

O fichário é o bloco de FATOS lidos da própria conversa, e volta inteiro ao pedido da análise, no mesmo lugar em que ficava antes da v1382 (logo depois das tentativas sem resposta):

- **a pergunta comercial que está com o cliente** — no caso Sirley, "Ele seria para você morar ou para investimento?", 19/08, há 8 dias;
- **o que o corretor já perguntou** nesta conversa, com a data de cada pergunta;
- **o que o cliente já disse**, copiado da fala dele — para não pedir de volta o que ele já deu;
- **os valores em dinheiro já citados**, com a idade de cada um (R$ 430.000, dito por ela, há 8 dias);
- **há quanto tempo a conversa está parada**, e a proibição de abrir mensagem contando dia parado;
- **o que é do corretor nunca vira pergunta** (anúncio, imóvel da carteira, preço já dito);
- **com quem você está falando** (singular x plural, tratamento);
- e, quando a conversa dá base, sinais comerciais fortes, promessas não cumpridas, próximo passo já proposto e a lacuna comercial prioritária.

**Nada além do fichário entrou de carona.** As outras camadas de 18/08 em diante que saíram na v1382 continuam fora: análise de fundamento, episódio comercial, duas etapas, piso de forma, catálogo aprendido. REGRA ZERO vale nos dois sentidos — a ordem se cumpre inteira, e nada além dela entra junto. `tests/v1395` falha de propósito se alguma delas voltar.

**Uma contradição achada e resolvida na hora de ligar.** O fichário foi escrito antes da v1394 e autorizava a pergunta ignorada a voltar: *"Se a pergunta continua sem resposta e ainda é a mais importante, **reconheça que já perguntou** em vez de perguntar do zero — e **considere** se não há um caminho melhor que insistir na mesma pergunta"*. Isso é exatamente a sugestão 2 do print da Sirley ("Vi que ficou em aberto uma informação..."), e contradizia frontalmente a regra dura da v1394. Ligar o fichário sem acertar isso desfazia a v1394 pela porta dos fundos. As duas frases passaram a apontar para o relógio: quando o app MEDIU dias de silêncio, a pergunta não volta — nem reconhecida, nem reformulada, nem no meio do texto.

**Medição do caso Sirley (feita com a IA simulada, sem gastar um centavo de API):**

| | sem fichário | com fichário |
|---|---|---|
| Conversa da Sirley (2 mensagens) | 23.854 caracteres | **28.510** (+19%) |
| Conversa longa (32 mensagens) | 28.608 caracteres | **41.026** (+43%) |

Para comparar: a v1380, que o dono mandou desfazer por ter ficado ruim, mandava 52.829 caracteres. O fichário sozinho não chega perto disso — e o que ele acrescenta é fato lido da conversa, não instrução mandando a IA ser esperta.

O silêncio agora chega com **um número só** em todo o pedido (8 dias no fichário e 8 dias no relógio) — a v1394 já tinha consertado o relógio, e o fichário sempre contou por calendário.

Regressão: `tests/v1395-fichario-religado.test.mjs` — inclui a guarda contra a morte silenciosa se repetir (não basta a função existir e passar nos testes: ela precisa CHEGAR no pedido), a guarda de que fichário e relógio não se contradizem, e a guarda de que nada além do fichário voltou.

## v1394

Caso Sirley (prints do dono, 27/08). A cliente entrou pelo anúncio em 19/08 às 14:12 — "quero saber mais sobre o apartamento de R$ 430 mil". O corretor respondeu às 17:44 com os dados da unidade e perguntou se seria para **morar ou para investimento**. Ela nunca mais respondeu. Oito dias depois, a análise devolveu as **três** sugestões fazendo a MESMA pergunta que ela já tinha ignorado — inclusive a segunda, disfarçada de "usar o apartamento ou alugar?".

Causas medidas no código, não supostas:

- **O relógio da v1393 tinha só dois casos.** Ele sabia dizer "o cliente ainda não teve tempo de responder" (menos de 12h) e "o corretor prometeu e não cumpriu". Faltava o terceiro, que é este: o corretor perguntou e o cliente teve DIAS inteiros para responder e não respondeu. Esse fato não existia em lugar nenhum do pedido — a IA só recebia "quem falou por último: O CORRETOR, há 7 dias, a bola está com O CLIENTE". Com isso, repetir a pergunta é uma saída perfeitamente razoável.
- **A conferência das três só olhava o lado contrário.** Ela reprova pergunta sobre tópico que o cliente JÁ RESPONDEU. Este tópico ele nunca respondeu — foi exatamente o que ele ignorou. As três passavam limpas.
- **Dois números para o mesmo silêncio.** O contexto técnico dizia "Dias corridos desde a última mensagem: 8" (conta de calendário, a mesma da tela) e o relógio, três linhas abaixo, dizia "há 7 dias" — 181h ÷ 24 arredondado para baixo.

O que a v1394 faz:

- **`perguntaIgnorada` — a pergunta que o cliente deixou sem resposta.** Quando a bola está com o cliente, já passaram 2 dias corridos ou mais e a última mensagem do corretor terminou numa pergunta comercial, o pedido passa a dizer com todas as letras: qual foi a pergunta, quando foi feita, e que **o silêncio é a resposta que ela recebeu**. A consequência é obrigatória: nenhuma das três pode ser essa mesma pergunta com outras palavras. O que entregar no lugar continua sendo decisão do **Cérebro** — o código não escolhe vídeo, foto nem visita.
- **O relógio passa a contar em dias de calendário acima de 24h**, o mesmo número da tela e do resto do pedido. Abaixo de 24h continua mandando a hora, como a v1393 estabeleceu.
- **Tempo de resposta do corretor entra como contexto** (no caso, 3h32 para responder um lead de anúncio). É fato medido do esfriamento — e o bloco proíbe explicitamente que isso vire assunto da mensagem ("desculpe a demora" chama atenção para o que o cliente talvez nem tenha reparado).
- **"Finalidade" deixa de ser só "morar ou investir".** Passa a reconhecer usar/morar/uso próprio contra alugar/locação/renda/revenda — é a mesma pergunta, e era por aí que a segunda sugestão do print escapava da conferência.
- **A conferência ganha a rede que faltava:** mensagem que repete o tópico da pergunta ignorada leva "Confira antes de enviar", e entra na reescrita curta que a v1393 já ligou.
- **Convidar deixou de ser "inventar".** Medido no mesmo caso: a régua da v1370 reprovava "podemos combinar uma visita" com o motivo "inventa visita sem esse compromisso existir no histórico". Não havia invenção nenhuma — o corretor está OFERECENDO pela primeira vez, que é o movimento comercial mais normal que existe, e era justamente a retomada que o dono apontou como certa. Agora a rede só pega quem AFIRMA que o compromisso já existe ("conforme combinamos", "nossa visita"). Dia e hora sem base continuam cobertos pela conferência vizinha, que não mudou. Mesmo espírito da v1366, que o dono mandou apagar quando a régua carimbou três mensagens corretas.

Regressão: `tests/v1394-caso-sirley-pergunta-ignorada.test.mjs` — as três do print precisam levar tarja, e a retomada que o dono apontou como certa precisa passar limpa.

**Achado que NÃO foi mexido, e depende de decisão do dono:** `montarFicharioDaConversa` — o fichário da conversa (v1317) — **não tem um único chamador em produção desde a v1382**, quando a análise voltou ao estado de 17/08 por ordem dele. É o mesmo tipo de morte silenciosa que a v1393 encontrou na conferência. A diferença é que aqui a remoção foi correta: o fichário é de 20/08, posterior à data para onde ele mandou voltar. Religá-lo seria desfazer uma ordem direta, então fica como está até ele decidir. As funções e os testes continuam no repositório.

## v1393

Caso Nathalia / Renaissance (print do dono, 26/08). A cliente escreveu 25/08 às 22h49 pelo anúncio, perguntando só "Valores?". O corretor respondeu HOJE às 11h38 com o preço e o link de disponibilidade. Às 15h22 — menos de quatro horas depois — a análise recomendou **aguardar** e, logo abaixo, entregou **três perguntas de qualificação para mandar agora**, uma delas sobre dormitórios, que o próprio link já respondia.

Duas causas medidas no código, não supostas:

- **O app contava tempo só em DIAS.** Toda a régua temporal (`_diasDesde`, `_haQuantoTempo`) era em dias civis: "faz 4 horas" e "faz 3 dias" chegavam na IA com a mesma cara ("hoje" / "há 3 dias"). O fato que decide o caso — o cliente ainda nem teve tempo de ler — não existia em lugar nenhum do pedido. A hora estava nas linhas da conversa; a CONTA, ninguém fazia.
- **A conferência das três mensagens não tinha um chamador.** `avisosDeQualidadeDasMensagens` existe desde a v1332 e, medido em 26/08, só os testes a chamavam: ela saiu do caminho junto com a restauração da v1382 e ninguém percebeu. Ou seja, a única rede que conferia as três depois da IA estava desligada — a IA se conferia sozinha, no mesmo texto.

O que a v1393 faz:

- **`relogioDaConversa` — o relógio em horas.** Novo bloco no pedido da análise: quem falou por último, em que dia e hora, **há quantas horas**, de quem está a bola e o texto da última mensagem do corretor (700 caracteres, para o conteúdo do link lido caber junto). É fato medido, não ordem comercial.
- **"Ainda não respondeu" deixa de ser confundido com "esfriou".** Quando o corretor falou hoje (ou faz menos de 12 horas) e o cliente não voltou, o bloco diz isso com todas as letras e a consequência vira obrigatória: `aguardar` é `true`, as três são a RETOMADA de outro dia, e nada que a última mensagem do corretor já entregou pode virar pergunta.
- **`aguardar` deixa de depender só da opinião da IA.** Medida a espera pelo relógio, o campo é forçado a `true` na normalização — com o motivo escrito em português de corretor quando a IA não escreveu o dela.
- **Quem prometeu, deve.** Se a última fala do corretor foi uma promessa ("vou verificar e te retorno") sem entrega na própria mensagem, a bola continua com ELE e não entra modo de espera. Link na própria mensagem conta como entrega, não como promessa.
- **A conferência das três voltou a ser chamada**, e o resultado preenche `problemasPorSugestao` — campo que a tela já sabia mostrar desde a v1308 ("Confira antes de enviar"). Nenhuma mudança de tela foi necessária.
- **Duas conferências novas:** pergunta sobre tópico já respondido passa a valer para qualquer pergunta da mensagem, não só a última (as três da Nathalia perguntavam no meio do texto e passavam batido); e mensagem escrita para "agora" ("acabei de te mandar") quando o relógio manda aguardar.
- **Reescrita só quando reprova e só se couber no tempo.** Uma chamada curta, apenas com as mensagens reprovadas, com teto de 30 s de sobra no orçamento. Se falhar, não couber ou piorar a conferência, fica valendo o texto original da IA com o aviso na tela. **Continua proibida a cirurgia determinística no texto** (v1247/v1315): o código não corta frase, não emenda pedaço e não substitui por frase genérica.

Regressão: `tests/v1393-relogio-em-horas-e-conferencia-ligada.test.mjs` — inclui duas guardas contra o código voltar a morrer em silêncio (o relógio precisa entrar no pedido; a conferência precisa ser chamada, não só declarada).

## v1392

- **O Cérebro virou UMA caixa só** (ordem do dono, 26/08). Eram seis campos — Método, Tom de voz, Diferenciais, O que evitar, Regras comerciais e Sinais de objeção. Para a IA os seis sempre viraram um texto só: a divisão era organização de tela, e seis caixas vazias afastam quem está começando.
- A caixa única usa o campo de maior teto (60 mil caracteres) e pede títulos em MAIÚSCULAS **dentro** do texto — a IA lê os títulos e usa como separação, que é o que as seis caixas faziam por fora.
- **Nada se perde de quem já tinha os seis preenchidos:** ao abrir a tela, `cerebroTextoUnicoDeConfig` junta o conteúdo dos seis, cada um com o seu título por cima. Ao salvar, os cinco antigos vão vazios pro banco — senão o texto velho continuaria sendo enviado à IA por baixo, duplicando o novo.
- O SERVIDOR continua entendendo os seis nomes: há contas com o Cérebro salvo no formato antigo e nenhuma pode parar de chegar na IA (`formatCerebroPrompt` intocado, coberto pelo teste v858).
- Guardas atualizadas: `tests/v1060` (que travava os seis ids na tela) e `tests/v858`.

## v1391

- **Varredura CARD POR CARD do sistema, não só do que aparecia no print** (*"são mais de 2 cards, preste atenção vendo o sistema e não só meu print"*). Onze correções, achadas percorrendo todas as regras de fundo do app.
- **Ficha do cliente:** os cards deixaram de ser translúcidos (`.72`/`.58` — herança da época em que o fundo era petróleo e o card precisava "vazar"). Sobre o preto profundo isso deixava tudo lavado. Agora são fundo cheio: `.cp704-card`, `.cp704-details` e a lista de atendimentos.
- **Diagnóstico:** o card era turquesa e o bloco de pergunta era verde. Viraram card cinza; a pergunta ganhou uma faixa verde só na lateral.
- **Conversa:** os balões do CLIENTE tinham fundo verde. O documento manda o contrário — mensagem do cliente em grafite. Agora é grafite, com a lateral em turquesa pra diferenciar.
- **Faixa "Hoje na agenda"** e os blocos de aviso perderam o tapete de cor: fundo de card, cor só na borda.
- **Erros de semântica que o verde causou:** bloco de perigo, pílula vermelha, "atrasado" da lista, hover do ícone de excluir e o hover do botão de perigo das telas de conta estavam todos VERDES. Voltaram a ser vermelhos. A etiqueta de alerta, que estava turquesa, voltou a ser amarela.
- **Botão de proposta** perdeu o degradê verde→turquesa (vira verde chapado), e a proposta impressa ganhou tokens próprios de papel (`--paper`, `--paper-soft`, `--paper-line`, `--paper-text`) em vez de usar os tokens de TEXTO como fundo — funcionava por acaso e era armadilha pra quem mexesse em contraste depois.
- Varredura final: nenhum fundo colorido em card, bloco, painel ou balão. Sobrou cor só onde ela É a informação: botões, chips, estados e marcações.

## v1390

- **Fundo mais escuro e sem o tom musgo** (escolha do dono entre 4 modelos: "preto profundo"). Print do celular, 23h17: *"esse fundo precisa ser mais escuro, tá meio verde musgo… tem que ser cinza escuro, preto, grafite"*.
- **Causa:** o grafite do documento (`#262624`) tem o canal azul (36) mais baixo que o vermelho e o verde (38) — é um cinza quente, e no painel do celular ele lê como amarelado. Somado ao card "Fazer agora", que tinha um fundo esverdeado, a tela inteira puxava para o musgo.
- Fundo `#121212` → **`#0A0A0A`**; coluna de conteúdo `#1A1A19` → `#101010`; cards/menus `#262624` → **`#181818`**; campos `#1F1F1E` → `#141414`; elevado `#302F2D` → `#232323`; borda de `.10` para `.09`. Todos neutros: vermelho, verde e azul iguais.
- **O card "Fazer agora" perdeu o fundo verde.** O destaque continua — pela borda verde e pelo número em verde —, sem tapete de cor.
- Verde `#A7E601`, turquesa `#10C0BF`, cinza claro `#DDDDDD` e o `#121212` de texto SOBRE a marca continuam iguais aos do documento.
- Contraste reconferido no fundo novo: o pior caso de todos os textos e cores de estado ficou em 5,57:1 (mínimo exigido 4,5:1).
- PWA acompanhou: `manifest`, `meta theme-color`, tela de abertura e página offline do service worker agora abrem no `#0A0A0A`.
- **E o azul da ficha do cliente foi embora.** Segundo print (08h47): o card "Interesse do cliente" abria num degradê azul-petróleo e o "Fazer agora" tinha um halo verde em volta. Eram cores da identidade antiga escritas em `rgba()` — a varredura da v1389 pegou os códigos `#`, mas não esses. Agora os dois são card chapado: fundo grafite e o destaque só na borda.
- Varredura refeita cobrindo `rgba()` também, **preservando a transparência original** (uma tarja de aviso translúcida não pode virar um bloco cinza cheio). Sobrou zero cor fora da identidade nos arquivos publicados.

## v1389

- **Identidade visual nova, aplicada no app inteiro.** Documento oficial entregue pelo dono em 25/08/2026: preto/grafite + verde-limão + turquesa, no lugar do petróleo + coral. Só a aparência mudou — nenhuma regra comercial, prompt, banco, análise ou fluxo foi tocado.
- **Paleta oficial:** verde `#A7E601` (ação principal, sucesso, item ativo), turquesa `#10C0BF` (links, ação secundária, informação), grafite escuro `#121212` (fundo), grafite `#262624` (cards, menus), cinza claro `#DDDDDD` (textos). Sobre verde e turquesa o texto é SEMPRE `#121212` — branco sobre verde dá 1,5:1 e ficou proibido, com teste que reprova se voltar.
- **Uma cor, um lugar.** A identidade inteira passou a ser declarada num bloco só, no topo do `styles.css`, e os ~90 nomes de variável que já existiam viraram apelidos dele. As telas de conta (entrar, cadastro, senha, política, termos, painel) não carregam o `styles.css`, então o mesmo bloco existe em `contas-estilo.css` — e um teste reprova se os dois divergirem.
- Varredura completa: ~330 cores cravadas em `styles.css`, `app.js`, `index.html`, `contas-estilo.css`, `share.html`, `service-worker.js` e `js/*` viraram token. Restaram só o preto/branco/cinza da impressão em papel e quatro tons neutros de avatar, agora também em token (`--avatar-1..4`).
- **Menu lateral:** item selecionado com fundo verde e texto/ícone escuros (era um tingido com barra lateral). Hover discreto, sem brilho.
- **Contraste conferido** em todas as superfícies: texto auxiliar subiu para `#9A9A96` (≥4,7:1) e o vermelho ganhou dois tons — `--danger` (`#FF6B71`) para texto/borda e `--danger-strong` (`#C4353C`) para fundo cheio com texto branco. Erro continua vermelho, alerta continua amarelo: status nunca vira verde.
- **Tipografia:** Inter, a fonte do documento, agora carregada de verdade (com `display=swap`; se a rede falhar, cai na fonte do sistema sem travar nada). O CSP do projeto já liberava esse domínio.
- **PWA e marca:** ícones (192/512), favicon e logo trocados pelo símbolo novo; `theme_color`/`background_color` do manifesto, `meta theme-color`, tela de boot e a página de erro sem conexão do service worker agora abrem no `#121212`.
- Conferido em navegador de verdade (Chromium headless) em 1440, 1280, 834, 390 e 320 px: sem estouro na horizontal, sem erro de JavaScript, tokens resolvendo em todas as larguras.
- Guardas atualizadas para travar a identidade NOVA e barrar a volta da antiga: `tests/v874-identidade-tokens` (paleta oficial, ciclo de variável, branco sobre verde, item ativo do menu, PWA, Inter), `v1214`, `v1216`, `v1365` (contraste calculado, não HEX cravado) e mais oito testes que citavam cores antigas.

## v1388

- **A análise passa a raciocinar ANTES de escrever as mensagens.** Caso Loraci (24/08): o sistema extraía os fatos certos e conduzia errado — ela pediu 3 dormitórios, sacada, centro e até R$ 450 mil, nada no estoque reúne isso, foi mostrado um de R$ 550 mil sem sacada, e dali sairia tanto "vou procurar outras opções com sacada até R$ 450 mil" (prometer o inexistente) quanto perguntas que ela já tinha respondido.
- **Causa raiz, e é estrutural:** no JSON pedido à IA, `mensagens` vinha ANTES de `nextAction` e de `recomendacaoContato`. A IA escrevia as três mensagens e só DEPOIS concluía qual era o próximo passo e se era hora de falar. E não existia lugar nenhum onde ela precisasse confrontar o que o cliente exige com o que existe. As mensagens não eram consequência de raciocínio nenhum — eram a primeira coisa que ela escrevia.
- **Correção:** a ordem dos campos do JSON virou a ordem do raciocínio, dita como obrigatória. Entram dois campos novos, escritos antes das mensagens: `requisitos` (cada critério declarado pelo cliente com o status que ELE deu — exigência, preferência, abriu mão, não confirmado) e `compatibilidade` (o imóvel na mesa, o que ele atende, o que não atende, se existe alguma opção que reúne tudo, e o conflito em uma frase).
- Regras novas no pedido: requisito declarado continua valendo até o CLIENTE dizer outra coisa (mostrar um imóvel fora do critério não muda o critério; "vou analisar" e "me manda a foto" registram interesse em avaliar, não aceitação de preço); é proibido prometer procurar uma combinação que o Cérebro ou a conversa já mostram não existir; havendo conflito, o próximo objetivo é descobrir qual requisito o cliente flexibiliza, com UMA pergunta; nada que esteja em `jaSabemos`/`requisitos` pode ser perguntado de novo, por mais antigo que seja; anúncio de origem, imóvel em análise e necessidade atual são três coisas diferentes; e pergunta do corretor ainda sem resposta no mesmo dia é caso de aguardar.
- **Na tela** (regra da v1145): a ficha do cliente ganhou "O que o cliente exige", "O que o imóvel em análise não atende" e "Conflito com o que existe hoje", em Detalhes comerciais.
- Teto de resposta da análise: 3600 → 4000 tokens, folga para os campos novos (JSON cortado não é análise pior, é análise nenhuma).
- Regressão: `tests/v1388-estado-da-negociacao-antes-das-mensagens.test.mjs` (os 6 casos pedidos pelo dono). Com IA de verdade: `evals/conversas/33-combinacao-que-nao-existe.json`, e a bateria passou a aceitar Cérebro por conversa.

## v1387

- **Quando a leitura diz "aguardar", as três sugestões passam a ser a mensagem da RETOMADA.** Caso da Loraci (print do dono, 24/08, 18h30): a leitura e a recomendação estavam certas, mas as três sugestões eram cortesia — "Certo, Loraci. Analise com calma os materiais que te mandei" — e uma delas repetia à cliente os dois motivos para ela dizer não ("está em R$ 550 mil e não tem sacada").
- Causa: contradição entre a tela e o pedido. A tela chama o bloco de "Mensagem preparada para a retomada · escolha a melhor quando chegar a hora"; o pedido mandava a IA escrever "a melhor mensagem para ESTE momento". Concluindo que não era hora de mandar nada, sobrava à IA escrever o que o corretor escreve sozinho em quatro segundos.
- Agora, quando a própria IA conclui `aguardar: true`, a regra do pedido muda o alvo das três: são a mensagem que ele vai enviar quando a espera terminar, cada uma levando adiante a pergunta/decisão que ficou EM ABERTO. Cortesia pura ("analise com calma", "fico no aguardo") fica proibida como mensagem inteira, e a retomada não repete ao cliente os argumentos contra a própria opção. Como será enviada em outro dia, a retomada abre com saudação + nome (a faixa do dia continua sendo ajustada na hora de mostrar, v1218).
- Regressão: `tests/v1387-aguardar-vira-mensagem-de-retomada.test.mjs`.

## v1386

- **Saudação só na PRIMEIRA mensagem do dia.** Pergunta do dono (24/08): *"porque uma hora dá saudação, outra hora não, não consigo entender tanta variação nas sugestões"*. Ordem dele depois da investigação: *"a primeira mensagem do dia com saudação, as demais, óbvio q não há necessidade"*.
- Causa medida no pedido enviado à IA: a única linha sobre abertura dizia "a saudação... deve seguir o Cérebro" (v1291). Cérebro sem regra escrita sobre abertura = ninguém decide, e a IA reescolhia a cada análise — ela trabalha sem temperatura fixa desde a v855, então a mesma conversa saía saudada numa vez e direta na outra. Os exemplos de "como este corretor escreve" (que mudam de conversa pra conversa, e de onde a cortesia é filtrada desde a v1308) empurravam o resultado pra um lado ou pro outro.
- Agora o código calcula um FATO de calendário — `corretorJaFalouHoje`: ele já escreveu para ESTE cliente hoje? — e o pedido leva esse fato junto com uma REGRA FIXA DE ABERTURA: primeira mensagem do dia → as três abrem com a saudação do horário + primeiro nome; já falou hoje → nenhuma das três abre com saudação. A saudação automática do WhatsApp Business e as anotações internas não contam como fala dele.
- Nenhum texto comercial é escrito ou cortado pelo código (regra da v1247 mantida): o fato e a regra entram no pedido, quem escreve continua sendo a IA. A correção da FAIXA do dia na hora de mostrar (v1218) segue valendo.
- Regressão: `tests/v1386-saudacao-so-na-primeira-do-dia.test.mjs`. Os testes v1255 e v1274 foram atualizados: a saudação saiu da frase que a delegava ao Cérebro.
- **Correção dentro do próprio pacote da v1386:** o arquivo `tests/zzz-portao-de-mentira.test.mjs` — que o teste do portão (v1338) cria de propósito para falhar, e apaga no fim — foi commitado por engano quando duas rodadas da suíte se cruzaram. Ele deixaria a suíte vermelha na `main` e o portão barraria TODA publicação (mesmo sintoma da v1325: "nao, esta na 1324 e nao atualiza"). Removido, posto no `.gitignore` e trancado por `tests/v1386-teste-de-mentira-nunca-vai-pra-main.test.mjs`.

## v1385

- **A tarja vermelha "Sugestões da análise anterior" para de ficar grudada no cliente.** Print do dono (24/08): um lead mostrando esse aviso — e mais "1 sugestão saiu com problema" — sem dizer o motivo nem qual sugestão, texto de antes da v1308/v1309.
- Causa: esses avisos valem para UMA análise, mas ficavam salvos no cadastro do cliente. Toda vez que uma análise nova era salva por cima (reimportação), ela não trazia esses campos — e o aviso velho passava por baixo e sobrevivia, mesmo em cima de sugestões recém-escritas pela IA. Só o botão "Reanalisar" limpava, porque esse caminho monta o registro a partir da análise nova.
- Correção nos três lugares que salvam análise por cima do cadastro (`_mesclarAnaliseV681`, `api/lead-update.js` e a segunda tentativa do `api/reanalisar-lead.js`): saiu análise nova de verdade → some o aviso de reaproveitamento, o de sugestão com problema, o de modelo indisponível e o de falha da IA. Quando a análise anterior é MESMO reaproveitada (IA fora do ar, teto do dia), o aviso continua aparecendo, com motivo.
- Regressão: `tests/v1385-tarja-analise-anterior-nao-fica-grudada.test.mjs`.

## v1384

- **Teste de modelo, pedido pelo dono.** A análise passou a rodar no `gpt-5.6-terra`, com o **mesmo prompt enxuto da v1292** que a v1382 restaurou.
- Motivo: a v1382 devolveu o `gpt-4.1` junto com o prompt antigo, e ele reclamou na hora — *"está demorando demais mesmo com 3 ou 4 mensagens"*. O `gpt-4.1` é de geração anterior e responde mais devagar. Medido: o código leva **71 milésimos** para montar o pedido; toda a espera é a IA respondendo.
- O teste separa as duas coisas que estavam juntas: o `gpt-5.6-terra` ficou ruim **por ser o modelo**, ou pelas camadas empilhadas de 18/08 a 20/08 que já saíram na v1382? Agora só o modelo mudou.
- Ele compara com a análise que acabou de rodar no `gpt-4.1` e decide. Voltar é uma linha, ou `DIRECIONA_MAIN_MODEL=gpt-4.1` na hospedagem.
- **E a tela parou de largar no meio.** "Travou em 46%" e "travando em 98%": nessas etapas o servidor faz preparação e análise numa chamada só, sem mandar sinal nenhum. O vigia da tela desistia em **2 minutos** e o app abortava em **240s** — mas o orçamento da análise no servidor já é 240s, e a preparação acontece antes dela. Resultado: o app largava um trabalho quase pronto **e já pago**, e o corretor via "travou". Agora o vigia espera 4min30 e o app 290s (a rota tem 300s). Nada fica preso pra sempre — só parou de desistir cedo demais.
- `CLAUDE.md` ganhou a **REGRA ZERO-B**: não pedir ao dono o que a própria sessão pode fazer. Nasceu de eu ter empurrado pra ele criar variável na Vercel e clicar em Redeploy — trabalho que era meu.

## v1383

- **A importação voltou a caber no relógio.** Logo depois da v1382 o dono importou uma conversa pequena, sem áudio nenhum, e recebeu *"a gravação não terminou a tempo"*.
- Causa: a v1292 dava **52 segundos** de orçamento para a análise, com janela de 34s. As versões seguintes subiram para **240 segundos** justamente porque a análise não cabia nesse teto (v1321/v1331), e isso voltou junto na restauração da v1382 sem ser percebido.
- A rota tem 300 segundos disponíveis. O orçamento voltou para 240s.
- **Isso não muda nada do que a IA recebe nem do que ela devolve** — muda só quanto tempo ela tem para responder. A análise continua sendo a da v1292, no `gpt-4.1`, numa chamada só.
- O comentário antigo que ainda falava em "orçamento de ~52s, folga sob o maxDuration:60" foi corrigido: descrevia um desenho que não existe mais e induziria ao mesmo erro de novo.

## v1382

**A análise voltou a ser a de 17/08/2026 (v1292), por ordem direta do dono — inteira, prompt e modelo.**

- **Modelo de volta ao `gpt-4.1`.** A troca para `gpt-5.6-terra` entrou na v1308 dentro de uma auditoria, sem ele pedir, e não voltou quando ele mandou desfazer a análise em 19/08 ("volte essa análise a 48h antes... de lá pra cá ficou uma merda"). Foi por isso que aquele "voltar" nunca resolveu.
- **Uma análise = uma chamada de IA.** Saíram: a segunda etapa (entender/escrever), o reparo automático das mensagens, e os blocos de fundamento/fichário/jogadas empilhados de 18/08 em diante. Medido sem gastar nada: o pedido enviado à IA ficou idêntico ao da v1292, **28.161 caracteres** contra 52.829 da v1380 — 47% menos.
- **Seis coisas de depois da v1292 ficaram, e nenhuma é camada de qualidade** (todas conferidas item por item com o dono):
  1. dado de um cliente não entra na conversa de outro — o filtro do aprendizado (v1326);
  2. e os dois blocos que levavam casos e fatos de OUTROS clientes para o pedido saíram de vez (v1301). **NÃO RELIGUE**;
  3. nunca cair para o modelo barato em silêncio (ordem dele na v1308);
  4. tempo esgotado não vira segunda cobrança pela mesma conversa;
  5. aviso de erro em português na tela, em vez do texto técnico do provedor;
  6. a linha que mostra quanto de aprendizado entrou — é o que torna a proteção 1 conferível.
- **O fuso horário configurável (v1337) foi RETIRADO**, por ordem dele: *"nunca pedi fuso horário"*. Volta Brasília cravado, como na v1292.
- **40 arquivos de conferência foram removidos** — guardavam exatamente as camadas que saíram (fichário, três jogadas, análise de fundamento, reparo, conferência das mensagens, catálogo, fuso). Teste que cobra código apagado não guarda nada; o histórico do Git preserva todos. A suíte fechou **verde com 479 testes**.
- Junto com a v1381 (bateria fora do caminho pago), o gasto por análise cai de ~R$ 0,16 para ~R$ 0,12, e some o gasto de 64 chamadas por clique na medição.

## v1381

- **A medição de qualidade saiu do painel administrativo.** O cartão "Qualidade da análise" e os botões "Medir agora" / "Medir o modo novo" foram removidos.
- Motivo: cada clique rodava 32 conversas de teste na IA de verdade (análise + um segundo modelo conferindo, cerca de **64 chamadas pagas por rodada**) e cada uma era gravada **como se fosse análise de cliente**. Foi isso que fez o painel mostrar 98 "análises" na quinta 20/08/2026 e tornou o gasto impossível de explicar quando o crédito da OpenAI zerou em 24/08.
- As 32 conversas continuam existindo e continuam sendo conferidas **de graça** na conferência automática (`npm test`) — o que saiu foi só o caminho que gastava dinheiro.
- A versão por linha de comando continua disponível, mas agora **para de propósito** e exige o pedido explícito `--gasta-dinheiro`, com o aviso do custo antes de qualquer chamada.
- Regra do projeto a partir daqui: **nenhum teste, conferência ou rotina automática chama IA paga a partir do app.** IA paga só em ação de verdade pedida pelo corretor.
- Regressões: `tests/v1381-bateria-nunca-gasta-pelo-app.test.mjs` (varre todas as rotas, o painel e a linha de comando) e a seção 4 de `tests/v1330-bateria-no-painel.test.mjs`.

## v1380

- A tela **Mais → Testar a IA agora** passou a dizer **de qual organização da OpenAI é a chave que o app usa**, junto com o começo e o fim da chave.
- Quando o motivo da falha é falta de saldo, a tela avisa para conferir se o crédito foi colocado **nessa mesma organização** — crédito na OpenAI pertence à organização, então dinheiro depositado numa organização não serve para a chave de outra.
- O nome da organização vem da própria resposta da OpenAI (cabeçalho `openai-organization`), lido na chamada gratuita que funciona mesmo com o saldo zerado — antes esse campo dependia de variável de ambiente que quase nunca é configurada e aparecia vazio.
- Continua sendo informação exclusiva do administrador da plataforma.
- Regressão: `tests/v1380-de-qual-conta-openai-e-a-chave.test.mjs`.

## v1379

- Painel administrativo ganhou **Gasto dia a dia (últimos 30 dias)**: cada dia vira uma linha, com o custo do dia, quantas chamadas foram feitas e a separação entre **análise** (pedida de propósito), **aprendizado automático** (roda sozinho depois da análise), **transcrição de áudio** e **outros**.
- Motivo: o painel só respondia "hoje" e "últimos 30 dias", e a pergunta do dono em 24/08/2026 era sobre três dias específicos já passados ("não pode ter gasto 10 dólares num fim de semana que eu quase não usei o app"). O dado já estava gravado — uma linha por chamada, com data —, só não era somado por dia.
- O corte do dia é o de calendário de Brasília, o mesmo já usado no "hoje" (lição da v1226).
- Data mostrada em português ("sáb, 22/08"), não no formato do banco.
- Regressão: `tests/v1379-gasto-dia-a-dia-no-painel.test.mjs`.

## v1378

- A tela **Mais → Testar a IA agora** passou a mostrar primeiro, em português, o que houve e o que fazer; o erro em inglês virou uma linha pequena de "detalhe técnico" para o suporte.
- Quando o motivo é falta de saldo, o título já diz isso ("a conta da OpenAI está sem saldo").
- A explicação de falta de saldo agora separa duas coisas que o painel da OpenAI mistura: o **Credit balance** (o dinheiro que libera as análises) e a barra **August spend US$ X / US$ 100** (que é só o teto de gasto do mês). A barra pode mostrar bastante espaço sobrando com o saldo zerado — foi exatamente essa confusão que travou o diagnóstico em 24/08/2026.
- Mesma correção no aviso que aparece dentro do atendimento quando a análise não sai.
- Regressão: `tests/v1378-saldo-nao-e-limite-de-gasto.test.mjs`.

## v1377

- O corte entre episódios comerciais passou a separar **pendências atuais** de **memória factual do cliente**.
- Um hiato longo não apaga finalidade, dormitórios, faixa de valor ou outros fatos explicitamente informados anteriormente.
- O caso Augusta continua como regressão principal da análise de fundamento.

## v1376

- Consolidação da análise de fundamento introduzida na v1374.
- Atualização de testes presos a formas antigas do código, sem retirar as proteções funcionais.
- O porteiro do prompt passou a avisar quando o miolo comercial muda sem fingir que uma medição real de IA foi executada no build limpo.

## v1375

- Correção de teste legado que ainda exigia a forma textual antiga de `proximoPasso`, embora o fallback protegido continuasse presente.
- Nenhuma regra comercial da v1374 foi alterada.

## v1374

- Introduzida a **análise de fundamento antes das sugestões**.
- A conversa completa continua sendo lida, mas contexto antigo e episódio comercial atual são separados quando existe hiato forte.
- O fundamento consolida fatos definidos, respostas já dadas, informações entregues, materiais/links/vídeos enviados e pendências factuais reais.
- Corrigida a leitura de localização já respondida.
- “Quero saber mais sobre o apartamento de R$ 430 mil” deixou de ser interpretado como orçamento declarado do cliente.
- Criado teste de regressão com o histórico real da Augusta.

## v1373

- Importação de áudio ficou resiliente a falha pontual de um arquivo.
- Ajustes de processamento de `.opus` e de continuidade da importação.
- Regressões comerciais e de Storage cobertas por teste.

## Histórico anterior

O detalhamento anterior à v1373 continua preservado no histórico do repositório e nas proteções existentes em `tests/`, `ESTADO-ATUAL.md` e `CLAUDE.md`.
