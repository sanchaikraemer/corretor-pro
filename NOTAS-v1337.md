# v1337 — o app deixa de achar que todo corretor está no horário de Brasília

## De onde veio

Item da auditoria de arquitetura: o fuso horário estava escrito na unha dentro do código — 35 vezes
só no arquivo principal do app, mais 16 nas rotas do servidor. Sempre "Brasília".

Funciona pra quem atende no horário de Brasília (Sul, Sudeste, Nordeste) e **mente pra todo o resto
do país**: em Manaus e Cuiabá o app mostrava uma hora a mais; em Rio Branco, duas.

E isso não é detalhe de tela. Hora errada é:

- **saudação errada dentro da mensagem sugerida** — a IA recebia "são 19h" e escrevia "Boa noite"
  pra um cliente que, no Acre, ainda estava às 17h da tarde;
- **"hoje" errado na virada do dia** — o que muda a fila do "Fazer agora", o "atendido há X dias" e
  os compromissos do dia.

## O que mudou na tela

No **Cérebro** apareceu **"Seu fuso horário"**, com quatro opções:

- Brasília / Sul / Nordeste (−3h) — **é o padrão, quem não mexer continua exatamente como estava**
- Manaus / Cuiabá / Boa Vista (−4h)
- Rio Branco / Acre (−5h)
- Fernando de Noronha (−2h)

Embaixo, o app mostra o que o seu aparelho está dizendo ("Detectado pelo seu aparelho: ..."), só
como conferência.

## O que NÃO mudou — de propósito

**O relógio do celular não decide nada.** Isso já deu problema aqui antes: celular Android
reinstalado volta marcando o fuso de Londres, e corretor viajando levava o "hoje" junto. Por isso o
aparelho é só uma sugestão na tela; quem manda é o que está salvo no Cérebro, e o padrão continua
Brasília.

## Por baixo

- o fuso salvo vale nos dois lados: nas telas do app e na análise feita no servidor (é ele que
  define a hora atual e a saudação certa que a IA recebe);
- a conta da meia-noite era cravada ("meia-noite em Brasília = 03:00 em Londres") em três lugares.
  Agora ela é calculada de verdade a partir do fuso escolhido, e funciona até no dia em que um país
  adianta o relógio;
- fuso que o navegador não reconhece volta pro padrão em vez de quebrar toda a formatação de data.

## Conferido na tela

Aberto no Chromium, em celular (390px) e computador (1280px): o seletor aparece com a mesma cara
dos outros campos do Cérebro, com o texto da opção cabendo inteiro na largura do celular.
