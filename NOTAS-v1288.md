# v1288 — o custo de IA do painel estava inflado (e agora a tela diz quando não dá pra confiar)

Dono, 17/08/2026, 08:58, com o print do painel administrativo (aba "Uso de IA por empresa") aberto:

> *"esses valores do painel administrativo do corretorpro estao certos, coerentes? tem certeza?"*

## Resposta curta

**As contas fechavam. O preço unitário não.** O painel mostrava
**"R$ 314,32 nos últimos 30 dias"** — e esse número estava por cima do real, muito por cima. A
estimativa mais próxima da verdade, com o mesmo uso, é da ordem de **R$ 130–140**.

O que ESTAVA certo no print (conferido linha por linha):

- 1422 + 66 + 13 = **1501 chamadas** — bate exatamente com o cartão do total.
- R$ 300,46 + R$ 11,61 + R$ 2,25 = **R$ 314,32** — bate exatamente com o cartão do total.
- "Chamadas hoje 0", "R$ 0,00 hoje", os três traços de hoje na tabela e o "Sem uso hoje" no card da
  conta: todos concordam entre si (era 8h58 da manhã e ninguém tinha analisado nada ainda).
- "0/150 hoje" na conta principal: é o teto próprio dela, correto.

Ou seja: nada de soma errada, nada de coluna trocada. O problema era o **preço por chamada**.

## O que estava errado

O sistema não guarda o valor em reais de cada chamada. Ele guarda quanto foi consumido (qual modelo
de IA, quantas palavras entraram e saíram, quantos segundos de áudio) e faz a conta em reais **no
momento em que você abre o painel**, usando uma tabelinha de preços por modelo.

Nessa tabelinha, os modelos estão pelo nome curto: `gpt-4.1`, `gpt-4o-mini`. Mas a IA, quando
responde, devolve o nome **com a data da versão dela**: você pede `gpt-4o-mini` e ela assina
`gpt-4o-mini-2024-07-18`. O sistema grava o nome assinado (de propósito — a gente quer saber a
versão exata que rodou) e depois ia procurar esse nome na tabelinha… e não achava, porque o nome com
data não é igual ao nome curto.

E quando não achava, ele usava um **preço de reserva propositalmente alto** — a ideia original era
boa (na dúvida, é melhor superestimar o custo do que se enganar achando que é baratinho), só que
esse "na dúvida" passou a valer para **praticamente toda chamada**, sem nunca avisar na tela.

O tamanho do estrago depende do modelo:

| Modelo que rodou de verdade | Preço de reserva cobrava | Quanto inflava |
|---|---|---|
| `gpt-4.1` (análise de conversa) | US$ 5 / US$ 15 por milhão | ~**2,3x** o real |
| `gpt-4o-mini` (aprendizado automático, o que roda em volume) | US$ 5 / US$ 15 por milhão | até ~**30x** o real |

O aprendizado automático — aquele que lê a carteira sozinho, uma chamada por conversa — é justamente
o que faz volume. Era o mais distorcido de todos.

Isso importa porque esse painel existe pra uma decisão específica: **definir a mensalidade**. Um
custo inflado leva a cobrar mais caro do que precisa, ou a achar que uma conta não se paga quando
ela se paga.

## O que mudou

1. **Nome com data da versão passa a achar o preço certo.** `gpt-4o-mini-2024-07-18` agora é
   cobrado como `gpt-4o-mini`. O valor em reais do painel cai pro patamar real.

2. **O painel diz em que dólar a conta foi feita.** A linha embaixo do título agora termina com
   *"convertido a R$ 5,50 por dólar"*. Antes o número em reais dependia de uma cotação que não
   aparecia em lugar nenhum da tela — impossível conferir. (Essa cotação é configurável; se quiser
   trocar, é a variável `CORRETOR_PRO_COTACAO_USD_BRL`, sem precisar de atualização de código.)

3. **Se ainda sobrar algum modelo sem preço mapeado, a tela grita.** Aparece uma tarja amarela
   dizendo, com nome e contagem: *"Atenção: o custo abaixo está estimado por cima. 332 de 1501
   chamadas (22%) usaram um modelo de IA que não está na tabela de preços do sistema…"*. Nunca mais
   um total inflado se passando por estimativa real — quando a IA lançar um modelo novo e ele entrar
   no sistema, você vê na hora que a tabela precisa ser atualizada, em vez de olhar um número
   estranho e não saber se pode acreditar.

4. **Uma chamada não pode mais ser contada em dobro.** A leitura da telemetria vem em páginas de mil
   linhas e a sua conta já passou de mil (1501). Como a ordem é da mais nova pra mais velha, uma
   análise gravada **no meio** da leitura entrava no topo, empurrava tudo uma casa pra baixo, e a
   linha 1000 era lida outra vez como primeira da página 2 — uma chamada a mais no total. Agora a
   leitura congela o instante em que começou: o que chegar depois entra na próxima atualização.

## O que NÃO mudou

- Nenhum dado histórico foi alterado. O sistema nunca gravou reais no banco — só consumo. Por isso
  os últimos 30 dias inteiros já aparecem recalculados no preço certo, sem precisar refazer nada.
- A separação por categoria da v1173 (análise pedida × aprendizado automático × outros) continua
  igual — só os valores em reais que ficaram honestos.
- O preço de reserva alto **continua existindo** para modelo desconhecido. Ele estava certo em
  conceito; o que faltava era não cair nele por engano e avisar quando cai.

## Um detalhe que puxa pro outro lado (pra não dizer que o número é o "certo definitivo")

A telemetria só registra chamada que **deu certo**. Quando a análise estoura o tempo e o sistema
tenta de novo num modelo mais rápido (é o que ele faz pra você não ficar sem análise), a tentativa
que falhou já consumiu na OpenAI e **não** fica registrada. Ou seja: o novo número é bem mais
próximo do real, mas ainda é uma estimativa — por baixo nesse ponto específico. Continua valendo o
que está escrito no painel: **não é nota fiscal**. A conta oficial é a fatura da OpenAI.

## Testes

`tests/v1288-preco-do-modelo-com-data.test.mjs` — 4 blocos: nome com data acha o preço certo (e o
nome curto continua funcionando); modelo desconhecido não é "chutado" como parente de outro (chute
errado poderia SUBESTIMAR, o único erro que engana de verdade quem define preço) e aparece nomeado
no relatório; a leitura da telemetria exige piso e teto de data mais desempate por id; e a tela tem
a tarja de aviso e a cotação escrita.

Suíte completa verde: 24 arquivos + 444 testes. Conferido também no navegador (Chromium), no
desktop e no celular: a tarja amarela aparece legível nos dois, sem estourar a largura da tela.
