# v1309 — a carteira que não abria, a sugestão que já tinha sido enviada e o arquivo que não dava pra analisar

Quatro prints do dono em 19/08/2026, entre 14h48 e 15h00, e uma frase dele no meio: *"De novo, as
sugestões estão sendo as mesmas coisas já enviadas. Você não está lendo o histórico do cliente."*
Cada print virou uma correção — e uma delas explica a frase.

---

## 1. A carteira presa em "Carregando os leads…" (o mais grave)

**O print:** a tela parada no aviso de carregamento, com a rodinha girando — **mas os números do
topo já preenchidos** (128 arquivados, 10 na agenda, 3 avisos). Ou seja: a carteira tinha chegado do
servidor. O que não acontecia era o desenho dela.

**O que estava acontecendo:** a importação termina abrindo o cliente sozinho. A partir daí, o app
fica com a marca de "tem cliente aberto" — e essa marca serve pra uma coisa certa: nunca apagar o
cliente que você está lendo pra desenhar a lista por cima. Só que a busca da carteira, quando a
memória estava vazia, escrevia **"Carregando os leads…" exatamente por cima do cliente aberto**.
Quando os dados chegavam, as duas rotinas que desenhariam a carteira desistiam por causa daquela
marca — protegendo um cliente que já não estava mais na tela. Resultado: nem carteira, nem cliente,
e nenhum aviso de erro (a busca tinha terminado bem, então o relógio de espera nem aparecia).

**Como ficou:** o aviso de carregamento nunca mais é escrito por cima de um cliente aberto; e se
ainda assim ele estiver na tela quando os dados chegarem, a carteira é desenhada por cima dele —
esperar a carteira deixou de ser confundido com "tem cliente aberto".

## 2. "O lead abriu, mas o histórico completo não carregou"

Um tropeço de rede no celular deixava o cliente aberto sem o histórico e sem a análise, e a única
saída era você perceber o aviso e tocar de novo. A carteira já tentava sozinha uma segunda vez desde
a v1140; o cliente, não. **Agora tenta** — uma vez, com um respiro de pouco mais de um segundo, e só
quando a primeira falhou rápido (falha lenta é servidor no limite: repetir só dobraria a espera).

## 3. As sugestões que você já tinha enviado

O print das 14h57 dizia, no fim da importação: *"lead atualizado · análise nova não concluída —
mantida a anterior"*. E logo abaixo, a sugestão recomendada era, praticamente palavra por palavra, a
mensagem que você já tinha mandado pra cliente às 11h04 daquele mesmo dia.

Não era a IA repetindo: **eram literalmente as mensagens da análise anterior**. Quando a análise nova
não é concluída (teto de análises do dia, Cérebro sem instruções, IA fora do ar, tempo estourado), o
app devolve a análise antiga pra você não ficar sem nada — e as três mensagens dela são justamente as
que você já copiou e enviou. Na tela, elas apareciam com a mesma cara de sugestão nova, e o motivo da
falha ficava só do lado do servidor.

**Como ficou:**

- um aviso em vermelho **colado nas três sugestões**: "Estas três mensagens são da análise ANTERIOR
  deste cliente" — com **o motivo real** de a nova não ter saído (teto do dia, Cérebro, IA fora do
  ar) e o caminho: tocar em ↻ Reanalisar;
- a linha de prova embaixo das sugestões passa a dizer "Leitura da análise anterior" em vez de
  "Análise feita", pra não parecer recém-saída.

## 4. E a IA passou a saber o que você já escreveu

Independente do item 3, faltava um fato no pedido: **o texto das mensagens que você já mandou nesta
conversa**. A lista de perguntas já feitas (v1297) não cobria o caso do print — o que se repetia era
a *informação* ("são 2 dormitórios e box de garagem, apartamento novo, pronto para morar"), não a
pergunta. Agora as suas últimas mensagens vão junto do pedido, com a regra: nenhuma das três pode
repetir o que você já disse, nem reescrito com outras palavras — informação já entregue não se
entrega de novo, oferta já mandada não volta como novidade.

Nada é cortado nem reescrito no texto que a IA devolve (isso foi desfeito na v1247 por ordem do
dono): o que mudou é a IA saber o que você já disse **antes** de escrever a próxima.

## 5. "Não foi possível analisar." — e o arquivo de 0.0 MB

O print das 14h48: *"Conversa do WhatsApp com Christian Boulevard.zip (0.0 MB)"* → **"Não foi
possível analisar."** e nada mais na tela. Três defeitos num print só:

- **"0.0 MB" não dizia nada.** Toda conversa pequena — e também um arquivo vazio, de zero byte —
  aparecia assim. Agora o tamanho sai em **KB ou em bytes** quando é pequeno.
- **O motivo existia, mas ficava embaixo.** A explicação é desenhada no quadro "Resultado", que num
  celular nasce fora da tela: você via a frase genérica e precisava rolar pra descobrir o que houve.
  Agora o motivo vira o **título**, em cima, e a tela **rola sozinha até a explicação**.
- **O aparelho já sabia, e mandava assim mesmo.** O celular abre o ZIP antes de enviar (pra deixar só
  o que a análise usa). Se o arquivo vem vazio, não abre como ZIP, está com senha, ou não tem o texto
  da conversa dentro, ele **já sabia disso** — e mandava o arquivo do mesmo jeito, esperava o envio
  inteiro e deixava o servidor recusar no fim. Agora ele **para na hora**, explica o que houve, ensina
  o caminho no WhatsApp e oferece **"Escolher outro arquivo"** (repetir o mesmo daria a mesma
  recusa).

---

## O que ficou de fora, e por quê

O motivo pelo qual a análise nova falhou nas suas importações de hoje **só o servidor de produção
sabe** — esta sessão não tem acesso aos registros da Vercel nem ao banco. O que dá pra afirmar é que
agora, quando isso acontecer de novo, **a tela vai te dizer o motivo** em vez de devolver
silenciosamente as mensagens antigas. Se acontecer, me manda o print do aviso vermelho com o motivo:
com ele em mãos dá pra atacar a causa.

## Arquivos

- `js/conferir-conversa.js` (novo) — as regras de conferência do arquivo e o título curto da falha.
- `js/importacao.js` — conferência antes do envio, tamanho legível, motivo no topo, rolagem até a
  explicação, botão "Escolher outro arquivo".
- `app.js` — carteira presa no carregamento, segunda tentativa do histórico do cliente, aviso de
  análise reaproveitada com o motivo.
- `api/_pipeline.js` — o que o corretor já enviou vai no pedido; o motivo da análise nova ter falhado
  viaja junto da análise reaproveitada.
- `build.js` — publica o arquivo novo.
- Testes: `v1309-arquivo-da-conversa-conferido-no-aparelho`,
  `v1309-carteira-nao-fica-presa-no-carregando`, `v1309-sugestao-antiga-nao-se-passa-por-nova`.
