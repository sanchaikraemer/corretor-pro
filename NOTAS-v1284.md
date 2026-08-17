# v1284 — planos novos: mesmo preço, volume que se paga, e ninguém barrado na carga inicial

## Por que mudou

O painel da OpenAI (16 e 17/08/2026) fechou a conta que faltava: uma análise custa de **R$ 0,20 a
R$ 0,40**, e **79% de toda a conta de IA é a entrada do modelo de análise**. Com isso, os limites
antigos davam **margem negativa**:

| | Preço | Análises/mês | Custo no pior caso | Margem |
|---|---|---|---|---|
| Antes | R$ 49,90 | 150 | R$ 60 | **−20%** |
| Antes | R$ 99,90 | 300 | R$ 120 | **−20%** |
| **Agora** | R$ 49,90 | **50** | R$ 20 | **+60%** |
| **Agora** | R$ 99,90 | **120** | R$ 48 | **+52%** |

Decisão do dono: **o preço fica, o volume desce.** É o caminho que não obriga a remarcar o produto
inteiro nem a explicar aumento pra ninguém.

## O que entrou

### 1. Limites novos, e o teto diário deixou de ser regra comercial

Pedido do dono: *"50 análises totais independente de limite diário"*. Quem quer sentar num sábado e
colocar a carteira em dia não pode ser barrado.

O campo `dia` dos planos virou **fusível técnico de 40/dia**, igual nos dois planos. Ele não existe
pra limitar o corretor — existe pra um erro em laço não queimar o mês inteiro numa hora. Quem
encostar nele agora recebe um aviso de **segurança**, não uma oferta de upgrade:

> "Muitas análises em pouco tempo — por segurança, o sistema pausou por hoje. Seu pacote do mês
> continua valendo e amanhã volta ao normal. Se isso aconteceu sem você ter feito tudo isso, fale
> com a gente."

No Pro o fusível (40) fica abaixo do pacote do mês (50) de propósito: mesmo esvaziando tudo de uma
vez, sobra um resto pro dia seguinte em vez de acabar numa tarde por engano.

### 2. Bônus de carga inicial: 200 análises nos primeiros 45 dias

O furo que os limites novos abriam: a promessa do produto é *"de toda a minha carteira, quem eu
atendo agora"* — e isso exige a carteira DENTRO. Um corretor com 150 conversas gastaria **3 pacotes
mensais só na primeira importação**, e bateria no bloqueio na primeira semana, justo quando ia se
convencer.

Agora a conta nova recebe **200 análises a mais**, válidas por **45 dias a partir da criação**
(janela que cobre com folga os 7 dias de teste + as semanas até a pessoa decidir e pagar). Custa de
R$ 40 a R$ 80 uma vez por cliente novo — é custo de aquisição, e é muito mais barato que perder o
cliente antes de ele ver o produto funcionando.

**Como foi feito:** o bônus é por TEMPO, não por saldo guardado. Ele entra somado ao teto do mês
(`limiteMes = plano.mes + bonus`), então continua sendo **um número só** — a reserva atômica da
migração `0012` segue fazendo todo o trabalho sozinha e a devolução em caso de falha (v1174)
continua valendo igual. **Nenhuma tabela nova, nenhum contador próprio, nenhuma disputa de
concorrência.** Passada a janela, o bônus simplesmente deixa de ser somado.

### 3. Estourar o mês virou uma escolha, não uma parede

Bloquear no dia 20 quem está usando muito é perder justamente o melhor cliente. Agora a mensagem
traz as duas saídas:

> "Você usou as 50 análises deste mês do plano Pro. Para continuar hoje: mais 30 análises por
> R$ 39,00, ou o Pro Master (120/mês) por R$ 99,90/mês."

**O pacote extra custa R$ 1,30 por análise, acima do R$ 1,00 de dentro do plano — e isso é de
propósito.** Um Pro no limite que compra o pacote paga R$ 1,30 cada; se subir pro Pro Master, ganha
70 análises a mais por R$ 50, ou seja **R$ 0,71 cada**. O pacote resolve o aperto de hoje, o upgrade
resolve o mês inteiro e sai mais barato — a conta do cliente aponta sozinha pro lugar certo.

A primeira versão desta linha tinha R$ 29 e **o próprio teste de margem reprovou**: saía mais barato
que a assinatura.

Não há meio de pagamento automático ainda (decisão do dono), então a compra é pelo WhatsApp e o dono
libera pelo painel — a ação `zerar-limite-analises` já aceita `zerarMes`.

### 4. Na tela

A tela **Planos** parou de anunciar teto diário (ele não é mais promessa comercial) e passou a
mostrar o pacote do mês, o pacote extra e — só no plano que a conta realmente tem, e só enquanto a
janela durar — as análises de boas-vindas, com marca própria (★) por serem temporárias.

Conferido em Chromium nos dois tamanhos de tela. De quebra, um defeito antigo saiu junto: os itens
do cartão eram vários pedaços soltos dentro de um `display:flex`, então cada trecho virava uma
coluna e a frase quebrava torta. Agora cada item é um `<span>` só.

## Guardas

- `tests/v1284-planos-novos-margem-e-bonus.test.mjs` — **a trava econômica**: se alguém subir o
  volume de um plano sem subir o preço, ele falha mostrando a conta. Confere também o fusível, a
  janela do bônus (0, 30, 44, 46 e 400 dias), se bônus + pacote cobrem uma carteira de 150
  conversas, e se a análise avulsa não sai mais barata que a de dentro do plano.
- `tests/v1110`, `v1118`, `v1120` e `v1199` foram atualizados para os números novos — os antigos
  cravavam 15/150 e 30/300 e falharam de propósito, que é exatamente o que se espera deles.

**Suíte: 24 arquivos checados + 440 testes, todos verdes.**

## Ajustável sem publicar nada

`CORRETOR_PRO_LIMITE_MES_PRO`, `CORRETOR_PRO_LIMITE_MES_PROMASTER`, `CORRETOR_PRO_LIMITE_DIA_PRO`,
`CORRETOR_PRO_LIMITE_DIA_PROMASTER`, `CORRETOR_PRO_BONUS_ENTRADA`,
`CORRETOR_PRO_PACOTE_EXTRA_ANALISES`, `CORRETOR_PRO_PACOTE_EXTRA_PRECO`,
`CORRETOR_PRO_PRECO_PRO`, `CORRETOR_PRO_PRECO_PROMASTER`.

## O que continua fora daqui

Cobrança automática. A venda e a liberação seguem manuais, pelo WhatsApp e pelo painel — decisão do
dono desde a v1128. Enquanto forem poucos clientes, funciona; é o próximo degrau quando passarem de
umas dezenas.
