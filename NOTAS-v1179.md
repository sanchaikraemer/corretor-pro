# v1179 — o cartão estava com o nome de quem abordou, não de quem respondeu

Print do dono em 07/08/2026 (versão 1178): o cartão abriu com **"Estevan Muller"** no topo, e a
análise inteira embaixo — o resumo, o "Fazer agora" e as três mensagens sugeridas — falando do
**Anderson**, que é o cliente de verdade. A conversa era uma prospecção: a Construtora Senger
abordou perguntando se o interesse era moradia ou investimento, e o Anderson respondeu pedindo
informações do empreendimento.

## O que estava acontecendo

Na hora de nomear o cartão, o app pegava **o primeiro nome que aparecia falando na conversa** e
descartava só um caso: quando esse nome era igual ao "Seu nome como aparece no WhatsApp" que você
configurou no Cérebro.

Só que numa **prospecção ativa quem fala primeiro é o lado da empresa** — a abordagem sai antes da
resposta do cliente. E basta o rótulo desse lado ser diferente do nome do Cérebro (outro corretor
da equipe, o número do plantão, um nome comercial) pra o filtro não pegar nada. Resultado: o
cadastro nascia com o nome de **quem prospectou**, e o cliente de verdade — o que respondeu, o que
tem 7 mensagens na conversa — ficava sem cartão nenhum com o nome dele.

A análise, essa, sempre soube quem era quem: ela lê a conversa inteira e por isso o resumo e as
mensagens já vinham corretos, falando com o Anderson. Quem errava era só a plaquinha do nome.

## O que a v1179 muda

**1. O nome do arquivo exportado passa a valer.**
Quando você exporta uma conversa, o WhatsApp nomeia o arquivo com o **contato do outro lado**
("Conversa do WhatsApp com Fulano") — nunca com quem exportou. Agora o app usa isso: se o contato do
nome do arquivo é uma das pessoas que falam na conversa, é ele o cliente, mesmo que o corretor tenha
falado primeiro. Arquivo com nome qualquer ("leads.txt") não diz nada e não é usado pra nada.

**2. A análise passa a apontar quem é o cliente — e o app confere.**
A cada análise, a IA agora responde também **quem é o cliente da conversa**, copiando exatamente o
nome como ele aparece nas mensagens. Esse nome só é aceito se for mesmo de alguém que **fala na
conversa** e se não for o lado da empresa: nome inventado, traduzido, abreviado ou citado só dentro
do texto de uma mensagem é descartado na hora. É esta a peça que conserta o caso do print.

**3. Cartão que já está com o nome trocado se conserta no "Reanalisar".**
Vale também pros cadastros que já existem: clicando em **Reanalisar** (ou reimportando a conversa),
se o nome que está no cartão for o de **outro participante da mesma conversa**, ele é trocado pelo
cliente certo. É exatamente o caso do print — não precisa refazer o cadastro.

**4. Nome que você digitou continua intocável.**
A troca só acontece quando o nome que está no cartão é, comprovadamente, o rótulo de outra pessoa
daquela conversa — ou seja, o palpite errado da importação. Nome que você escreveu na mão em
**Editar** ("Anderson terreno NVR", por exemplo) não bate com participante nenhum e **nunca** é
mexido por análise nenhuma, como já era antes.

## O que isso NÃO muda

Nada de informação comercial: continua tudo vindo do Cérebro e da própria conversa. E o nome
continua sendo mostrado **exatamente como está salvo no celular** — o app escolhe de quem é o nome,
nunca reescreve o nome de ninguém.

## Testes

`tests/v1179-nome-do-cartao-e-de-quem-responde.test.mjs` — trava as cinco frentes: o nome do arquivo
exportado identificando o contato (inclusive nas variações "-enxuto.zip" e em inglês); a importação
nascendo com o cliente certo mesmo com o corretor falando primeiro; o nome apontado pela análise só
valendo quando é de quem fala na conversa (e nunca quando é o corretor do Cérebro); a correção do
cartão já salvo acontecendo só quando o nome de lá é de outro participante; e o nome digitado à mão
sobrevivendo a qualquer reanálise. Cobre também o contato sem nome na agenda, que aparece só como
número — o telefone dele continua sendo aproveitado.

Suíte completa verde: 24 arquivos, 345 testes.
