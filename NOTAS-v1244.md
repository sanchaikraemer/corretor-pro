# NOTAS v1244 — o prazo que o próprio cliente marcou

Data: 13/08/2026. Mesma conversa da v1243 (o contato parceiro de leilão), mesmo print, e um erro que
eu tinha deixado passar duas versões seguidas — inclusive escrevendo, com todas as letras, na tabela
das NOTAS da v1243, que *"a semana passou"*. **Não tinha passado.**

O dono trouxe a análise de outra IA, e ela achou o ponto:

> "em 03/08, o Thume disse que já tinha olhado o material e em seguida falou 'vamos falar sobre o
> assunto na semana que vem'. A 'semana que vem' mencionada em 03/08 corresponde a 10/08 a 16/08.
> Ou seja: no dia 13 vocês estavam **dentro** do período combinado, e não com o 'prazo já vencido'."

Conferi no calendário: 03/08/2026 caiu numa **segunda-feira**. "Semana que vem" dita numa segunda é
**10/08 a 16/08**. A análise rodou em **13/08**. Estava em dia.

## O que o app estava fazendo

Cobrando atraso de quem estava em dia:

- a tela dizia que o prazo padrão de retomada tinha sido ultrapassado;
- as três sugestões saíam com cara de cobrança — *"Passou a semana que tínhamos comentado..."*;
- e ainda reofereciam planta e simulação de um material que o cliente **já tinha dito que olhou**.

Para o cliente do outro lado, isso é a mensagem de alguém que não leu o que ele escreveu.

## A causa

O Cérebro tem um número genérico de "dias sem interação" para reconhecer intervalo e retomada. Esse
número é útil **quando ninguém combinou nada**. O que estava acontecendo é que ele atropelava o
prazo que os dois combinaram entre si. Um é chute de régua; o outro é combinado explícito.

## O que mudou

A conta do calendário passou a ser feita **no código**, não pela IA — calendário é exatamente onde
ela erra —, e entra no pedido como **fato pronto**: *"o cliente disse X em tal dia, isso corresponde
ao período de 10/08 a 16/08, hoje está DENTRO desse período, não existe atraso"*.

Entendem-se hoje: "semana que vem" / "próxima semana" / "semana seguinte", "mês que vem",
"amanhã", "depois de amanhã", "daqui a N dias", "daqui a N semanas". Expressão vaga
("mais pra frente", "qualquer hora dessas") **não** vira prazo — não dá pra fingir precisão que não
existe.

Três cuidados que impedem o remédio de virar doença nova:

1. **Só vale o que o CLIENTE marcou.** O corretor dizer "te chamo semana que vem" é promessa dele,
   não combinado do cliente — senão o sistema passa a obedecer a si mesmo.
2. **O combinado morre quando a conversa anda.** Depois do marco, só confirmação curta
   ("Combinado", "blz", "ok") mantém ele de pé. Se o cliente voltou com assunto novo, aquele
   "semana que vem" não manda mais — do contrário um combinado de meses atrás governaria a
   negociação para sempre.
3. **Marco de mais de seis meses não governa negociação de hoje.**

Com o prazo calculado, quatro lugares passaram a respeitá-lo:

- **As três sugestões.** Mensagem que diz que o prazo venceu enquanto ele está aberto agora entra na
  **releitura obrigatória** — mesmo sem nenhuma frase da lista de clichês proibidos. Antes ela
  passava limpa, porque erro de calendário não é clichê. E na hora de escolher entre a versão
  original e a reescrita, erro de tempo pesa igual a frase proibida: é **fato errado**, não estilo.
- **O painel "Como conduzir este atendimento".** Não adianta a sugestão estar certa embaixo de um
  diagnóstico que diz que o prazo venceu — a tela ficava se contradizendo.
- **O campo "condição do cliente".** Combinar **quando falar** não é condição pra **comprar**.
  "Falamos semana que vem" era mostrado no mesmo campo onde deveria estar algo como "só depois que
  eu vender a colheita".
- **O cartão "Fazer agora".** Dentro da janela combinada é justamente o dia de falar — o lead não
  pode sumir da fila. Antes dela, o certo é aguardar, e o cartão agora diz a partir de quando.

## Duas correções que vieram junto

**Material que ele já disse que olhou não se reoferece.** Quando o cliente escreve "dei uma olhada",
"recebi", "vi sim", a condução certa é **perguntar o que ele achou** — e decidir o passo a partir da
resposta dele. Mandar de novo a mesma planta/tabela/simulação como novidade é o erro mais caro que
existe nessa hora.

**A voz dos dois chega mesmo com nome diferente no Cérebro.** O lado do corretor só era reconhecido
quando o nome guardado no Cérebro batia com o rótulo do WhatsApp. Se o dono salvou o nome comercial
e a exportação traz o apelido (ou o contrário), os exemplos da voz dele saíam **vazios** — e a IA
escrevia no tom de vendedor genérico, que é a reclamação de origem. Numa conversa de dois, quem não
é o contato é o corretor. Junto disso, sugestão copiada pelo próprio app deixou de entrar como "voz
real": IA aprendendo com IA vai deixando tudo mais artificial a cada rodada.

## O que NÃO mudou

O sistema continua lendo **todo o histórico do cliente**, de qualquer ano — a ordem do dono de
13/08/2026: *"o sistema deve ler sempre todo historico do cliente"*. Há teste travando isso.

## Testes

`tests/v1244-prazo-que-o-cliente-marcou.test.mjs` cobre: a conta do calendário nos três estados
(antes, dentro, depois), o marco dito pelo corretor não valendo, o marco morrendo quando a conversa
anda, o marco velho não ressuscitando, o fato chegando no pedido, a cobrança de atraso virando
releitura, o painel e o cartão "Fazer agora" respeitando a janela, a voz dos dois lados com nome
diferente no Cérebro, e o histórico continuando inteiro.

Suíte: **410 testes, todos verdes.**

## Crédito

O ponto foi achado por outra IA, numa análise que o dono trouxe. Ela estava certa e eu estava
errado — e errado por escrito, nas notas da versão anterior. A implementação aqui incorpora as três
salvaguardas que a análise dela tinha e a minha primeira tentativa não tinha (só o cliente marca,
o combinado morre quando a conversa anda, e a releitura obrigatória por erro de tempo).
