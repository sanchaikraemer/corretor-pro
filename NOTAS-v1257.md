# v1257 — anexo e link contam como entrega: nunca mais dizer que o cliente não recebeu

Correção de um erro que **a v1253 introduziu** e que o dono flagrou com print do WhatsApp.

## O que aconteceu

Analisando a conversa da lead **Marina**, tanto eu quanto a análise concluímos que ela *"pediu 3
dormitórios três vezes e nunca recebeu uma opção"*. O dono corrigiu:

> "ela recebeu as opções sim, so q nao vai imagens e links e pdfs no histórico, mas veja anexo.
> acho q vc nao esta lendo o histórico todo como deve ser feito SEMPRE"

Ele está certo. A conversa exportada do WhatsApp **não carrega o conteúdo** de imagem, vídeo,
PDF/documento nem áudio — chega só o marcador `[Arquivo enviado nesta mensagem: ...]` (criado na
v1058). Uma tabela de valores, uma planta, um print com as opções ou um catálogo inteiro podem
estar exatamente ali dentro, invisíveis pra IA.

## Por que isso era grave

A regra da v1253 diz: *quando existe um pedido do cliente em aberto, a sugestão nº 1 precisa
ENTREGAR o que foi pedido.* Ótimo — desde que "em aberto" seja verdade.

Aplicada em cima de uma leitura errada, essa regra manda o corretor **reenviar como novidade algo
que ele já enviou**. Pro cliente, isso passa desatenção: "ele nem lembra que já me mandou". A
melhoria da v1253 podia virar um constrangimento.

## O que mudou

### 1. Anexo ou link depois do pedido = pedido atendido

Se depois do pedido do cliente existir, em mensagem do corretor, **qualquer marcador de arquivo ou
qualquer link**, o pedido passa a contar como atendido. Link também é entrega — uma URL pode abrir
a tabela, o mapa de disponibilidades ou a lista de opções.

E ficou proibido afirmar, sugerir ou escrever mensagem que dê a entender que o cliente não recebeu
algo só porque o conteúdo não aparece no texto. Está escrito com todas as letras no sistema:
**ausência no histórico não é prova de ausência no WhatsApp.**

### 2. Na dúvida, a mensagem funciona nos dois casos

Em vez de *"vou te mandar as opções"* — que soa como se nada tivesse sido enviado e constrange o
corretor se já foi —, a mensagem passa a ser escrita de um jeito que serve pros dois cenários:

> *"Das opções que te mandei, alguma chegou perto do que vocês querem?"*
> *"Quer que eu reenvie o material?"*

Funciona pra quem recebeu e pra quem não recebeu, sem ninguém passar vergonha.

### 3. Ler o histórico inteiro, do começo — sempre

Regra nova e explícita: não analisar só as últimas mensagens. O que define a negociação costuma
estar lá atrás — o que o cliente pediu na primeira mensagem, a unidade que ele apontou, a objeção
que soltou uma vez só, o valor que já foi informado, o que já foi enviado.

E o princípio geral, que vale pra tudo: **nunca tratar "não aparece aqui" como "não aconteceu"**.
Só afirmar que algo faltou quando a própria conversa disser isso — o cliente cobrando, o corretor
prometendo e o assunto morrendo sem nenhum arquivo ou link no meio.

## Ordem das regras

A trava foi escrita **logo depois** da regra da v1253, não em outro canto do prompt — ela é a
exceção daquela regra e precisa ser lida junto com ela. O teste verifica essa ordem de propósito.

## Cuidados mantidos

- Tudo no prompt de quem **TEM Cérebro**, nunca só no modo prévia (regra da v1247).
- Nenhuma informação comercial cravada no código.
- O marcador de arquivo da v1058 continua intacto — sem ele a IA nem saberia que houve um envio.

## Teste

`tests/v1257-anexo-e-link-contam-como-entrega.test.mjs`, incluindo a verificação de que a trava vem
depois da regra que ela limita.
