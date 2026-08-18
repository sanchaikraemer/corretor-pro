# v1302 — a sugestão parou de descrever o prédio sozinha e de prometer mandar sem mandar

Print do dono de 18/08/2026 às 20h14. A conversa inteira tinha **duas linhas**:

- a saudação automática do anúncio do Instagram: *"temos o [empreendimento] com 3 suítes e box
  duplo. Quer saber mais sobre as unidades disponíveis?"*
- o cliente, às 20h12: *"Olá! Posso ter mais informações sobre isso?"*

E as três sugestões voltaram assim:

1. *"O [empreendimento] **conta com apartamentos de 3 suítes**, box duplo de garagem e **estrutura
   moderna**. **Vou te enviar** as principais informações e diferenciais do empreendimento."*
2. *"...tem um **perfil bem procurado**... Te passo um resumo das opções disponíveis..., **pode
   ser?**"*
3. *"Já te mando as informações completas... Se tiver alguma preferência, **só me falar** que já
   separo as melhores opções."*

As duas reclamações do dono, nas palavras dele: **"quem disse que tem só 3 suítes??? ninguém!!!"**
(o prédio tem unidade de 2 suítes também) e **"não está nem respondendo o que o cara perguntou"**.

## Duas das três já eram proibidas — e escaparam por buraco de vocabulário

A rede que devolve a mensagem pra IA reescrever existe desde a v1295/v1299. Ela conhecia *"só me
avisar"* e não conhecia *"só me falar"*. Conhecia *"se quiser posso te mandar"* e não conhecia *"pode
ser?"*. Mesma sala de espera, mesmo pedido de licença, escritos com outra palavra — e passavam
direto.

**O que muda:** a lista de verbos que devolvem a bola passou a incluir falar, dizer, sinalizar e
passar (*"só me falar"*, *"é só me dizer"*, *"qualquer coisa me sinaliza"*), e o *"pode ser?"* /
*"posso?"* no fim da mensagem entrou como pedido de licença. O *"tudo bem?"* ficou **de fora de
propósito**: no WhatsApp isso é saudação, não licença.

## A terceira falha era nova: o aplicativo descrevendo o prédio

O anúncio ofereceu **uma unidade** com 3 suítes. A mensagem transformou isso no catálogo do prédio
("conta com apartamentos de 3 suítes") — e ainda acrescentou "estrutura moderna", que ninguém
escreveu em lugar nenhum. Dito assim, ao cliente, isso **fecha a porta** das outras unidades que o
corretor tem.

**O que muda:** a mensagem não pode mais afirmar por conta própria o que o prédio tem ("conta com
apartamentos de X", "possui unidades de Y") nem elogiar o que ninguém disse ("estrutura moderna",
"perfil bem procurado", "alto padrão", "ótima localização"). Duas fontes valem, e só elas:

- **a conversa** (e as observações que você registrou naquele cliente) — é ela que diz **qual** é o
  imóvel, o endereço, a referência;
- **o seu Cérebro** — é ele que descreve **como** o produto é, porque o texto é seu. Se o seu
  Cérebro disser "tem apartamentos de 2 e 3 suítes", a mensagem pode dizer isso.

## E o principal: prometer mandar não é responder

*"Vou te enviar as principais informações"* não entrega nada e não pergunta nada. O cliente fica sem
ter o que responder, e você continua sem saber o que ele precisa.

**O que muda:** quando o cliente pede informação e a conversa não tem o dado, a mensagem faz **uma
pergunta concreta que te deixa selecionar** — quantos dormitórios, até quanto pretende investir, se
é pra morar ou investir. É o que um corretor faz nessa altura, e é o que a sua própria análise do
GPT tinha apontado no caso do outro cliente: transformar o pedido vago em critério objetivo.

Para o print deste caso, a mensagem certa é do tipo:

> "Boa noite, Leonardo! Pra eu separar as unidades certas: você precisa de quantos dormitórios e até
> que valor pretende investir?"

## Como isso é conferido

Como nas v1295/v1299, o código **percebe e devolve pra IA reescrever a mensagem inteira**. Nada é
cortado, emendado ou substituído por frase pronta (proibição do dono, v1247), e nada é descartado: se
a reescrita falhar ou voltar pior, fica valendo o texto original.

Guarda: `tests/v1302-sugestao-que-nao-responde-e-inventa.test.mjs` — as três sugestões do print caem
na rede, e seis mensagens boas (inclusive "tudo bem?" e "tem interesse nas unidades", que derrubaram
mensagem certa enquanto a rede estava sendo escrita) continuam passando.
