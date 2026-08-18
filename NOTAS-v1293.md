# v1293 — faxina de código morto, aviso de serviço fora do ar e o furo da rede de proteção

Continuação direta da revisão do dia (ver `AUDITORIA-v1292.md`, que levantou os achados sem mexer
em nada). Aqui são as decisões do dono, executadas.

## O que o dono mandou, com as palavras dele

| Item da revisão | Resposta | O que foi feito |
|---|---|---|
| 2 — o aviso de serviço fora do ar nunca aparecia | *"se nao transcreve tenque avisar"* | o aviso voltou pra tela |
| 4 — a pergunta "o cliente respondeu?" | *"acaba com isso… é sem sentido algum existir"* | recurso removido inteiro |
| 5 — a rede de segurança da saudação | *"foda-se saudação, se isso consome algo elimine, eu quero otimização"* | removida |
| peso morto e o comentário mentiroso | *"se isso nao é usado retire"* | removidos |
| 1 (aprendizado fala sozinho) e 3 (a rosca do Desempenho) | pendentes | **não foram tocados** — aguardam decisão |

## 1. O aviso de "fora do ar" voltou pra tela

**O que você vê:** se a transcrição de áudio ou o salvamento de conversas estiverem indisponíveis,
aparece uma faixa vermelha no alto da tela inicial dizendo exatamente o que está fora do ar. Quando
está tudo funcionando, ela não aparece e não ocupa espaço nenhum.

**Por que ela não aparecia:** a conferência existia no código desde muito tempo e fazia tudo certo —
menos achar o lugar da tela onde deveria escrever. Esse lugar tinha sido apagado em alguma faxina
antiga. Como a primeira coisa que ela fazia era procurar por ele, ela desistia ali: o pedido ao
servidor nem chegava a sair. Agora o lugar existe de novo (`#statusStamp`, no topo da tela inicial),
e a faixa some sozinha quando um cliente está aberto, como todos os outros blocos da tela inicial.

Conferido no navegador de verdade (Chromium, no app já publicado), em celular (390px) e computador
(1440px): escondida ocupa 0 de altura; forçada a aparecer, mede 40px, texto vermelho legível sobre
fundo vermelho fraco, sem estourar a largura da tela e sem nenhum erro de JavaScript.

## 2. "O cliente respondeu?" saiu inteiro

Ordem do dono: *"nunca tem como saber pq o sistema não é integrado ao whats. Sempre q o cliente
responde no whats a conversa é exportada para o corretorpro e então ele dá continuidade, então
'cliente respondeu' é sem sentido algum existir"*.

Saíram cinco funções encadeadas (os botões *sim / não / ainda aguardando*, a gravação no servidor, o
tratamento de falha de internet e a leitura do registro) e o evento `cliente_respondeu` deixa de ser
criado. O rótulo dele na linha do tempo continua no código de propósito: quem já tem esse registro
gravado de antes continua vendo a linha, em vez de um item sem nome.

Detalhe que vale registrar: **esse recurso já não aparecia na tela havia muito tempo** — nenhuma
tela desenhava aqueles botões. A revisão só descobriu isso agora.

## 3. A rede de segurança da saudação saiu

`garantirSaudacaoAbertura` (e o `primeiroNomeDoCliente`, que só existia pra ela) estava DESLIGADA
desde a v1291, quando o dono entregou a reescrita das instruções e passou a saudação pra
responsabilidade do Cérebro. Era código correto, testado, sem nenhum chamador — e viajando pro
celular a cada atualização. Saiu.

**Continua valendo:** a correção da FAIXA do dia (não escrever "boa noite" às 17h), que mora no app e
é conferida pelo teste da v1218.

## 4. A faxina — e a cadeia que ela revelou

Começou pequena e cresceu, porque **remover uma função morta revelou outras nove que só estavam
vivas por causa dela**.

O nó era o `cardTop`: o desenho do card do "top 3" da tela inicial. Sozinho, 15 linhas de sobra. Mas
ele era o único chamador de `cardLeadHTML` (o "card padrão de lead", com um comentário dizendo que
era *"usado em Hoje, Todos e Pipeline pra manter o MESMO padrão"* — não era mais), de `btnWhatsApp`,
`linkWhatsAppDireta`, `whatsappLink`, do avatar por iniciais (`avatarInicial`/`avatarLead`), das
etiquetas **⚠ REATIVAR** (`ehReaquecerUrgente`) e **sumiço pós-preço** (`ehSumicoPosPreco` +
`tagSumicoPrecoHTML`), e — por tabela — de `scorePrio` e `scoreSinais`.

Tudo isso parou de ser desenhado quando a v1076 trocou os cartões da tela inicial por linhas de
tabela, e ninguém percebeu porque cada peça parecia usada pela peça de cima.

> **Fica registrado pro dono:** as etiquetas **⚠ REATIVAR** e **sumiço depois do preço** não
> aparecem em lugar nenhum do app hoje, e não é de agora. Se ele quiser essas marcas de volta nas
> listas, é decisão dele — as regras que decidiam quem recebia cada uma estão descritas aqui e
> podem ser reescritas.

Também saíram, todas sem nenhum chamador: `copiarMensagemLead` (copiar a mensagem direto do card da
Home — o botão dela sumiu na v1076), `cp704SelectMsg`, `cp704OpenWhats` (abrir o WhatsApp já com a
mensagem, de dentro do cliente), `renderCarteiraTabela`, `reagendarDias`, o `WA_SVG` (ícone do botão
que saiu), o botão de recarregar de uma tela de aprendizado que não existe, o botão e o status da
restauração antiga, o campo `state.obsCarregada` (gravado duas vezes, lido nunca) e 13 blocos de
aparência no `styles.css`.

**Total: 429 linhas a menos**, sem nenhuma mudança no que aparece na tela.

### O convite de boas-vindas antigo

O `<div id="bannerOnboarding">` do `index.html` estava **vazio**: o app calculava direitinho quando
mostrá-lo e mostrava uma caixa sem nada dentro. Do outro lado, a função que o abria pelo Menu
(`abrirOnboarding`) não era chamada por ninguém — o botão tinha sumido em alguma faxina, e o teste
da v849 continuava afirmando que ele existia. As duas pontas saíram. O tutorial que ensina a mandar
a conversa é o da v1149, esse sim ligado.

## 5. O comentário mentiroso — e a régua que ele protegia

No `app.js` estava escrito, desde a v1246: *"A régua em si (cpSemAtenderHaDias) CONTINUA, porque a
fila 'Fazer agora' usa ela."* A fila foi lida inteira: ela decide por `cpCadenciaSemResposta`,
`ultimoAtendimentoTs` e `emJanelaDeEspera`. **Nunca chamou `cpSemAtenderHaDias`.** A régua só
continuava viva porque três testes a executavam — testes que repetiam a mesma crença errada.

A régua saiu, e os três testes foram reescritos dizendo a verdade. O `tests/v1071` virou guarda de
ausência: se a conta de "sem atender há N dias" voltar, tem que voltar junto com a tela ou a fila
que a use.

## 6. Por que nada disso foi pego antes: duas redes furadas

### 6.1 O teste de código morto não enxergava metade do arquivo

`tests/v1186-nada-de-codigo-morto.test.mjs` existe desde agosto pra pegar exatamente esse tipo de
coisa, e passava verde com 20 funções mortas no arquivo. Dois furos na régua:

1. ela só olhava o **topo** do `app.js` — tudo dentro dos blocos `(function(){…})()`, que é onde mora
   boa parte do app, passava sem conferência;
2. ela não reconhecia `window.minhaFuncao = function(){…}`, que é a forma usada por metade das
   funções que as telas chamam.

Agora a régua desce em qualquer profundidade, reconhece as duas formas de declarar, conta uso por
**linha** (comentário citando o nome não conta mais como uso) e trata nomes como `$` e `$$`, que a
borda de palavra do regex não pegava. Com a régua nova, o teste apontou na hora as oito funções que
tinham escapado — e depois da faxina ele fecha limpo.

### 6.2 A importação inteira não passava por conferência de digitação

`tests/run-all.mjs` roda `node --check` (que pega erro de digitação) sobre uma **lista escrita à
mão**. Essa lista ainda citava `js/tema.js`, apagado na v1268, e **não citava `js/importacao.js`** —
as ~1.500 linhas da importação, o segundo maior arquivo do front. Os 50 testes que falam dele só
**leem o texto** do arquivo; nenhum executa.

Ou seja: um erro de digitação na importação passava pela suíte toda verde e só apareceria no celular
do dono, na hora de importar uma conversa. Mesma situação valia pra `saudacao.js`, `dados-locais.js`,
`enxugar-zip.js` e `envio-retentativa.js`.

A pasta `js/` passou a ser descoberta sozinha, como `api/` já era. A conferência subiu de **24 para
29 arquivos**, e a correção foi verificada na prática: com um erro de digitação plantado de
propósito em `js/importacao.js`, a suíte agora **falha** — antes não falhava.

## Correção da própria auditoria

O `AUDITORIA-v1292.md` listava a marca `cp-ja-entrou` (gravada no cadastro) como "nunca lida". Está
**errado**: a tela de entrar lê, sim — através de uma constante (`CP_JA_ENTROU`), que a varredura
automática não enxergou. É o que faz quem acabou de criar a conta ver o login em vez do convite pra
criar conta. Ela **não** foi removida, e o arquivo da auditoria foi corrigido.

## Suíte

`29 arquivo(s) checado(s) + 447 teste(s), todos verdes.`

Quinze arquivos de teste foram atualizados — nenhum deles perdeu cobertura: cada asserção que media
código removido virou guarda de ausência com o motivo escrito, ou foi remanejada para o caminho que
o corretor usa de verdade (por exemplo, a ordem "atendimento antes do contador" ao copiar uma
mensagem, que era medida no botão da Home e agora é medida no botão de dentro do cliente).

## Continua pendente (aguardando o dono)

1. **O andamento do aprendizado da carteira** — nove mensagens de progresso e de erro escritas num
   lugar de tela que não existe. Quer ver esse texto em algum canto, ou apago as mensagens?
2. **A rosca "Atividade do dia" do Desempenho** — atendidos hoje, sem resposta 3+ dias, lembretes e
   compromissos: calculados sobre a carteira inteira a cada desenho da tela e descartados. Devolvo
   pra tela ou apago o cálculo?
3. **`aprenderDaCarteira` e `importarTelefonesCSV`** — pendentes desde a v1268.
