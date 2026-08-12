# v1225 — retomada de verdade, sem desculpa pronta, e o corretor para de adivinhar

Dono, 11/08/2026, 21h31, sobre as três sugestões de um lead parado havia dias: *"Olha que ridículas
sugestões de retomada. Não está fazendo a retomada após vários dias sem conversa. Falou não sei o
que está na cabeça, o que é isso? [...] Olha uma das respostas: 'sei que a vida corre'. Cara, que
imbecilidade é essa? [...] Só pode que não está olhando, só pode que o sistema não está analisando
o do cérebro."*

Ele está certo nas três críticas — e uma delas tem culpa minha, de uma versão de duas horas antes.

## O que estava errado nas mensagens

As três eram **a mesma oferta em três tons** ("quer que eu te mande as plantas e valores?"),
nenhuma reconhecia que a conversa estava parada, uma dava a desculpa pronta pro cliente e outra
dizia o que ele tinha "na cabeça".

### Regras novas (no pedido que vai pra IA)

**Retomada depois de dias sem conversa virou regra dura:**
- **reconhecer o tempo** com naturalidade ("faz um tempo que a gente não se falava"). Escrever como
  se a conversa tivesse parado ontem faz o corretor parecer desatento — o cliente sabe quantos dias
  passaram;
- **trazer um motivo real** pra estar voltando, tirado do que ficou pendente **na conversa**. Sem
  motivo, a retomada vira "oi, sumiu?";
- **proibido dar a desculpa pronta**: "sei que a vida corre", "imagino que esteja corrido", "sei
  que a correria é grande", "se ainda tiver interesse", "desculpa incomodar", "sei que você deve
  estar ocupado" — entregam de bandeja o motivo pra ele adiar de novo;
- **proibido adivinhar o que o cliente pensa** ("vi que você está com o X na cabeça"): a IA sabe o
  que ele **escreveu**, não o que ele pensa.

**As três não podem ser três pedidos de licença.** Se o cliente já demonstrou querer, perguntar de
novo devolve o trabalho pra ele. A "direta ao ponto" passa a ter que **avançar sozinha**: anuncia o
que o corretor vai fazer agora e põe **uma escolha concreta** na mesa (dois horários, dois
caminhos, uma data). Está escrito lá que *"me avisa e eu mando" não é direta — é pedir licença com
outro nome*.

## A parte que foi culpa minha: economia demais

A v1222 (duas horas antes) passou a mandar pra IA um **resumo** do que já tinha sido analisado, em
vez da conversa. Os limites que escolhi eram agressivos demais: com 6.000 caracteres de corte e
3.000 de "cauda", quase toda conversa virava *resumo + pedacinho do fim* — pouco material real, e
o resultado é exatamente o que ele viu: mensagem genérica, que não parece ter lido nada.

Os limites subiram: **conversa média volta a ir inteira** (corte em 15.000) e, quando a conversa é
longa de verdade, vai **três vezes mais conversa real** junto do resumo (cauda de 9.000). A economia
continua onde ela é grande; a leitura volta a ter substância.

## E ele para de adivinhar se o Cérebro entrou

Enquanto isso for suposição, toda sugestão ruim vira dúvida sobre o sistema inteiro. Agora, embaixo
das sugestões, o cliente mostra uma linha discreta com a verdade da análise:

- *Análise feita **com o seu Cérebro** · leu a conversa inteira (47 mensagens)*
- *Análise feita **com o seu Cérebro** · leu 38 mensagens + resumo de 212 antigas*
- *Análise feita **sem o seu Cérebro** · leu a conversa inteira (12 mensagens)* — em vermelho
- análise antiga (de antes deste registro): **nada** aparece, em vez de inventar informação

## Arquivos alterados

- `api/_pipeline.js` — regras da retomada e do trio; limites da leitura incremental (15.000/9.000);
  a análise passa a registrar `cerebroAplicado` e `conversaLidaPelaIA`.
- `app.js` — a linha "de onde veio esta análise", embaixo das sugestões, no cliente.
- `tests/v1225-retomada-de-verdade.test.mjs` — guarda das frases proibidas (com as palavras exatas
  do relato), da regra do trio, dos limites novos e do que a linha mostra em cada caso.
- `tests/v1222-...` — atualizado para os limites novos (a conversa do teste cresceu pra continuar
  exercitando o caminho do resumo).
- `package.json` / `package-lock.json` — versão 1225.

Verificação em tela (Chromium, 412px, temas claro e escuro): os quatro casos da linha nova,
conferidos com a função de verdade extraída do app publicado.

## O que isto NÃO resolve

Regra é instrução, não garantia: o modelo pode escorregar de novo. O que dá pra afirmar é que as
frases que ele apontou estão proibidas com todas as letras, que a retomada agora tem obrigação
explícita, e que a IA voltou a receber conversa de verdade pra trabalhar. Se aparecer sugestão ruim
outra vez, a linha nova já diz de cara se foi falta de Cérebro, falta de conversa lida, ou se é o
modelo desobedecendo — e aí a correção vai pro alvo certo.
