# v1344 — a segunda revisão achou três defeitos que eu mesmo tinha criado

Você mandou revisar de novo, com mais atenção. Achei três coisas, e todas eram **erro meu**, das
versões que eu publiquei ontem. Nenhuma delas apareceria numa tela de erro — era tudo do tipo que
simplesmente deixa de funcionar em silêncio.

## 1. O lembrete diário ia parar de chegar (culpa da 1336)

Na 1336 eu fiz o aviso só sair dentro da janela de horário que você escolhe. Metade certa. O que eu
não vi:

- **quem já tinha o lembrete ligado nunca recebia o ajuste.** O pedido de "acorde o app" só era
  refeito quando você CLICAVA no botão de ativar. Como você já tinha ligado antes, o celular
  continuava acordando o app uma vez a cada 20 horas, num horário qualquer — e a janela nova, de 4
  horas, quase sempre não pegava esse horário;
- **a trava era "no máximo um aviso a cada 20 horas"** — o que fazia um aviso das 11h de segunda
  bloquear o aviso das 8h de terça.

Somando as duas: o lembrete ia sumir, sem erro nenhum, sem você entender por quê.

**Corrigido.** Agora o app refaz o pedido toda vez que abre (você não precisa clicar em nada), a
trava passou a ser **um aviso por dia**, e existe uma **repescagem**: se passarem 2 dias inteiros
sem nenhum aviso, ele sai no primeiro despertar em horário de gente (7h às 21h). Madrugada continua
proibida — era a sua reclamação original.

Simulando 30 dias com o celular acordando uma vez por dia em horário variado: **a regra de ontem
dava 8 avisos; a de hoje dá 15**, e 9 deles exatamente na janela que você escolheu.

## 2. O fuso horário só valia depois de você abrir a tela do Cérebro (culpa da 1337)

O fuso salvo só passava a valer quando a tela do Cérebro era aberta. Um corretor de Manaus que
escolhesse o fuso de lá continuaria vendo **todas** as datas do app no horário de Brasília — Home,
Agenda, Desempenho, contagem de dias — até entrar naquela tela, e só naquela sessão.

**Corrigido:** o fuso passa a valer na abertura do app, junto com o resto da configuração da conta,
e a tela é redesenhada quando ele muda.

## 3. O catálogo estava aprendendo lixo (culpa da 1335)

Esse é o mais grave dos três, e só apareceu porque eu rodei o catálogo contra material de venda de
verdade em vez de confiar no teste. De uma arte comum ele aprendia um produto chamado
**"OPORTUNIDADE ÚNICA"**. De um print de portal, **"IMÓVEL À VENDA"**. E de um PDF, um nome com
quebra de linha no meio.

Por que isso importa: é justamente esse nome que o app usa para dizer *"é produto seu"* quando uma
sugestão cita um empreendimento. Com lixo aí dentro, uma mensagem que dissesse "Oportunidade" seria
carimbada como produto real da sua carteira — **o app afirmando bobagem com cara de fato**, que é
exatamente o que você não tolera.

**Corrigido, e agora é conservador de propósito:** o nome só é aprendido quando o material diz com
todas as letras ("Empreendimento X") ou quando é a linha do logotipo — curta, sem número, sem
pontuação de frase. Não deu pra ter certeza? Fica **sem nome**. Nome errado é pior que nome nenhum.

Aproveitei e corrigi outra coisa que estava jogando fora o material mais útil: uma lista de imóveis
enviada por link era descartada inteira, porque a limpeza que tira dado pessoal já tinha trocado os
preços e o app não reconhecia mais aquilo como material de venda.

## Ainda nesta revisão

- A gravação do catálogo **engolia erro do banco**: se a gravação fosse recusada, a função dizia
  "guardei" e seguia. Agora o erro aparece no registro do servidor.
- Havia nome de empreendimento escrito dentro do código, em comentário meu. O próprio teste do
  projeto pegou — é regra antiga daqui, e eu tinha furado. Limpo.

## Conferido

Suíte completa verde hoje **e** com o relógio adiantado (31/12 às 23h50, março/2027, julho/2029).
App aberto no navegador: versão 1344, seletor de horário e de fuso funcionando, medição das
sugestões desenhando, **nenhum erro** navegando pelas telas.
