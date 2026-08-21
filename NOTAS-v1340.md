# v1340 — "As sugestões estão funcionando?" — o número que faltava

## O que estava errado

O Desempenho mostrava **"Mensagens copiadas"**: quantas sugestões você levou pro WhatsApp. Isso não
é resultado. Resultado é o **cliente voltar a falar** depois que você mandou.

Era um item da auditoria e era, honestamente, o buraco mais incômodo: o app pedia sua confiança nas
sugestões e nunca te mostrou se elas funcionam.

## O que mudou na tela

No **Desempenho**, abaixo de "Propostas feitas", entrou um bloco novo:

> **As sugestões estão funcionando?**
> **2 de 3** clientes voltaram a falar (67%)
> 1 ainda não respondeu depois da sua última mensagem este mês.

E funciona também no mês passado, junto com o resto da tela.

## Como a conta é feita — e o que ela não é

Para cada cliente, o app olha a **última vez que você copiou uma sugestão** pelo botão. Se depois
disso existe fala **do cliente** na conversa, aquele cliente voltou a falar.

O que **não** entra na conta, de propósito:

- fala sua depois da sugestão (mandar mais uma cobrança não é o cliente responder);
- anotação sua registrada no cliente (ligação, visita, nota) — é sua, não dele;
- resposta anterior à sugestão — é o que ele já tinha dito;
- cliente sem sugestão copiada no período: fica fora da conta inteira, pra não diluir o percentual.

E, com duas cópias no período, vale **a última**: resposta que veio antes dela não prova que a
última funcionou.

**Isso não é taxa de conversão.** É "voltou a falar". E só enxerga o que passou pelo app: a resposta
do cliente aparece aqui depois que você reimporta a conversa. Está escrito na tela, embaixo do
número — número sem essa ressalva vira mentira.

Quando não houve nenhuma sugestão copiada no período, a tela diz isso em vez de mostrar 0% e
parecer fracasso.

## Conferido na tela

Aberto no Chromium com uma carteira de teste (3 clientes, 2 respostas), em celular (390px) e
computador (1280px): o bloco aparece no lugar certo, com o número certo, sem estourar a largura.

---

## Registro: o que aconteceu com os números 1337 e 1339

Dois trabalhos correram ao mesmo tempo no mesmo dia e acabaram usando os mesmos números de versão.
Fica registrado aqui pra ninguém se perder olhando o histórico depois:

- **1337** saiu duas vezes. Uma é o **fuso horário do corretor** (o app deixou de achar que todo
  corretor está no horário de Brasília); a outra é o **estado comercial determinístico** ("fatos
  primeiro, IA depois"). As duas estão no ar e convivem: o arquivo `NOTAS-v1337.md` guarda a
  segunda, e a primeira está descrita no pedido de junção #485 e no teste
  `tests/v1337-fuso-do-corretor.test.mjs`.
- **1339** também saiu duas vezes. Uma é a **trava da publicação que falha para o lado seguro**
  (problema de máquina não pode parar o site); a outra é a **junção das duas linhas de 1337**. O
  arquivo `NOTAS-v1339.md` guarda a segunda; a primeira está no pedido de junção #487 e no teste
  `tests/v1338-portao-da-publicacao.test.mjs`.

Nada se perdeu: as quatro coisas estão no código e cobertas por teste. O que sumiu foram só dois
arquivos de notas, sobrescritos — e este parágrafo existe pra isso não virar buraco no histórico.
