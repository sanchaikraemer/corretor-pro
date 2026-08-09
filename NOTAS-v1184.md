# v1184 — a inteligência de fábrica deixou de falar só como construtora

O dono trouxe o Cérebro pronto de uma **imobiliária**: carteira de imóveis de terceiros, o
proprietário decide o preço, a chave às vezes está com o inquilino, e o mesmo imóvel pode estar
anunciado por outro corretor da equipe. Lendo esse material junto com o que o app já faz por
dentro, apareceu um desencontro.

## O problema

Existe um bloco de inteligência comercial que o Corretor Pro aplica **sempre**, em toda conta,
tenha ela configurado o Cérebro ou não. É o "piso": o mínimo que a IA sabe sobre vender imóvel
antes de aprender qualquer coisa sobre o corretor.

Esse piso tinha sido escrito pensando só em **venda de lançamento**. Ele mandava, em toda análise:

- oferecer **"café na construtora"** quando a decisão é de casal;
- retomar quem **"não viu o decorado"**;
- tratar permuta como algo que **"a construtora aceita"**;
- sugerir opção **"de planta"** para quem achou caro o pronto.

Para quem vende lançamento, tudo certo. Para quem trabalha revenda, nada disso existe: não tem
decorado, não tem café na construtora, e quem aceita ou recusa a proposta é o **proprietário do
imóvel**, não uma incorporadora.

O Cérebro do corretor sempre mandou mais que esse piso, então **nada estava quebrado** — mas o
piso ficava puxando a IA para o mundo errado em toda análise, e o corretor de revenda precisava
gastar o Cérebro dele só para desmentir o que vinha de fábrica.

## O que mudou

**1. O piso ficou neutro, sem perder o lançamento.** Onde ele prescrevia estrutura de construtora,
agora ele diz "o formato que essa organização usar" e manda seguir o que o Cérebro confirmou que
existe. Decorado, estande e opção de planta **continuam lá** — só deixaram de ser o único mundo
possível: agora aparecem com a ressalva "quando a organização trabalhar com lançamento".

**2. Entrou o caso do imóvel de terceiro.** O piso passou a cobrir explicitamente a carteira
compartilhada:

- disponibilidade, valor aceito, desconto, prazo de desocupação e forma de pagamento **dependem do
  proprietário** e podem ter mudado desde a última mensagem — é coisa a confirmar, nunca fato
  garantido;
- o corretor **apresenta** a proposta; quem **aprova** é o proprietário;
- visita só está agendada depois de confirmada com **quem tem a chave**.

**3. Condomínio, IPTU e despesas entraram na lista do que não pode ser afirmado sem confirmação.**
Antes essa trava valia para endereço, cidade, metragem e prazo de entrega. Em revenda, chutar o
valor do condomínio queima o corretor do mesmo jeito que chutar a cidade.

**4. A próxima ação sugerida não pode depender de estrutura que não existe.** O piso agora proíbe
propor um passo que dependa de algo que o Cérebro não confirmou que a imobiliária tem.

**5. Quatro textos prontos da tela do lead ficaram neutros.** Os convites que o app sugere junto
com os materiais falavam de "planta do apartamento", "vídeo do empreendimento", "visita ao
decorado" e "lazer e wellness do empreendimento". Viraram "planta do imóvel", "vídeo do imóvel",
"que tal marcarmos uma visita?" e "área de lazer do condomínio" — servem para os dois mundos.

## O que NÃO mudou

Nenhuma informação comercial foi cravada no código, como sempre. O piso continua sendo só
**roteiro de para onde olhar** — nada nele autoriza afirmar preço, condição, endereço ou
disponibilidade. Tudo isso continua vindo do Cérebro do corretor ou da própria conversa.

## Teste de regressão

`tests/v1184-piso-comercial-serve-imobiliaria.test.mjs` trava as duas pontas: o piso não pode
voltar a prescrever estrutura de construtora, e precisa continuar cobrindo o imóvel de terceiro —
sem apagar o que serve a quem vende lançamento. O teste da v1115 (que garante que a IA não invente
endereço) foi ajustado para a nova redação, mantendo a mesma garantia.
