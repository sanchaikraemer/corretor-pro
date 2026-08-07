# v1180 — o app parou de chutar um terceiro nome (e a conversa de parar no cadastro errado)

Resposta do dono à v1179, e ele está certo:

> "Não tem nada a ver quem responde primeiro ou não. Se o meu nome é [o que está no Cérebro], ponto
> final. O nome do cliente é [o contato exportado], ponto final. Não tem que estar inventando um
> outro nome que não é nem primeiro nem segundo nem nada."

E o estrago era maior do que a v1179 tinha enxergado: o nome chutado no topo do cartão — que não era
nem o dele nem o do cliente — **já existia como contato na carteira**. Como o app procura cadastro
existente **pelo nome**, e o nome batia exatinho, a conversa do cliente novo foi salva **dentro do
cadastro daquela outra pessoa**, sem perguntar nada (nome idêntico atualiza direto desde a v953).

## O que estava acontecendo

Três coisas se somaram:

1. **O app escolhia um nome mesmo sem ter como saber.** Ele pegava o primeiro autor da conversa que
   não fosse o corretor. Numa conversa com três pessoas (o corretor da construtora entra junto, o
   cliente responde), esse "primeiro" pode ser qualquer um.
2. **O seu nome só era reconhecido escrito exatamente igual ao Cérebro.** Quem configurou nome e
   sobrenome mas aparece no WhatsApp só com o primeiro nome não era reconhecido como corretor — e
   podia acabar sendo tratado como "o cliente".
3. **Nome chutado + nome igual na carteira = cadastro invadido.** O nome errado casou com um contato
   que já existia, e a conversa foi despejada lá dentro.

## O que a v1180 muda

**1. O nome do Cérebro identifica você, ponto final.**
Nome e sobrenome no Cérebro, só o primeiro nome no WhatsApp (ou o contrário): é você do mesmo jeito.
Você nunca vira "o cliente" da sua própria conversa. Rótulos de atendimento — construtora,
imobiliária, corretor, plantão, incorporadora — também são reconhecidos como o lado da empresa.

**2. Sem prova de quem é o cliente, o app não escolhe ninguém.**
A ordem agora é: (a) quem a análise identificou como cliente, conferido contra quem realmente fala na
conversa; (b) o contato do **nome do arquivo exportado** — o WhatsApp sempre nomeia o arquivo com o
contato do outro lado; (c) o único nome que sobra depois de tirar você. Se nada disso responder — por
exemplo numa conversa com três pessoas e arquivo renomeado — o cartão fica **"Cliente não
identificado"** e você corrige em **Editar**. É a mesma regra que já vale pro resto do app: na
dúvida, "Não identificado", nunca inventar.

**3. "Cliente não identificado" não gruda em cadastro nenhum.**
Um rótulo sem identidade (esse, "Cliente importado", "Contato", ou um nome que na verdade é um
número) deixou de servir pra reconhecer cliente já existente — dos dois lados, na tela e no servidor.
Sem isso, dois cartões sem nome seriam tratados como a mesma pessoa e virariam um só.

## O que fazer com o cartão que já ficou errado

O cadastro que recebeu a conversa da outra pessoa **continua misturado** — o app não tem como
adivinhar qual mensagem veio de qual conversa. O caminho é: **importar a conversa de novo**. Agora
ela entra num cadastro próprio, com o nome certo. Se o cadastro que foi invadido era de um cliente de
verdade, o jeito limpo é apagar ele e reimportar a conversa dele também.

## Testes

`tests/v1180-app-nunca-chuta-um-terceiro-nome.test.mjs` — o nome do Cérebro reconhecendo o corretor
escrito com mais ou menos palavras; conversa com três pessoas terminando em "Cliente não
identificado" em vez de chutar o terceiro; o nome do arquivo resolvendo essa mesma conversa; o
corretor nunca virando cliente nem quando o arquivo diz o nome dele; e os rótulos sem identidade
sendo recusados como chave de cadastro (sem derrubar nome real que começa com "Cliente").

`tests/v1179-nome-do-cartao-e-de-quem-responde.test.mjs` teve dois pontos ajustados: onde ele
cobrava o chute do primeiro autor, agora cobra "Cliente não identificado".

Suíte completa verde: 24 arquivos, 346 testes.
