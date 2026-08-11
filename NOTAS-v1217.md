# v1217 — a conexão cai no meio do envio: o app tenta de novo sozinho

Print do dono, 11/08/2026: ZIP de **54 MB** (conversa cheia de áudio), celular no **4G**, barra em
100% e a tela vermelha: *"Falha de conexão durante o envio. Verifique a internet e tente
novamente."* Ele reimportou na mão e **na segunda vez passou** — que é a assinatura clássica de
queda de rede, não de defeito do arquivo nem do servidor.

Nada disso tem a ver com a v1216 (que mexeu só em cor).

## O problema

O envio do ZIP é um único bloco de dezenas de MB indo do celular pro armazenamento. Numa rede
móvel isso cai com frequência — e o app **desistia na primeira queda**. Pior ainda em dois pontos:

- o botão "Tentar novamente" recomeçava **tudo**, inclusive o preparo do ZIP no aparelho (o passo
  que separa texto e áudio), que numa conversa grande demora sozinho;
- quando o celular perde o sinal no meio do envio, o navegador às vezes **não dispara erro
  nenhum**: a barra ficava parada no mesmo número de MB indefinidamente, sem nada acontecer.

## O que mudou

- **O app refaz o envio sozinho, até 3 vezes.** A tela avisa: *"a conexão caiu com 31,2 de 54,0 MB
  enviados — recomeçando o envio em instantes (2 de 3)"*. O ZIP já preparado é reaproveitado: o que
  se repete é só o envio.
- **Envio parado é cortado.** Passados 90 segundos sem **um** byte novo, a tentativa é encerrada e
  recomeçada — em vez de ficar presa pra sempre. Lento mas andando não é cortado.
- **Cada tentativa pede um endereço de envio novo**, porque o anterior pode ter vencido enquanto o
  envio se arrastava.
- **Arquivo recusado não fica repetindo à toa.** Queda de conexão, envio parado e erro temporário
  do armazenamento (5xx) são repetidos; recusa do arquivo (4xx) chega direto pro dono, porque
  repetir daria o mesmo resultado.
- **A mensagem final ficou útil.** Se as 3 tentativas falharem: *"A conexão caiu no meio do envio
  (20,0 de 54,0 MB) e não deu certo em 3 tentativas. Se estiver usando dados do celular, tente no
  Wi-Fi: conversa com muito áudio é pesada."* — em vez do genérico "verifique a internet". O texto
  é curto de propósito: mensagem longa demais é substituída por um texto genérico na tela e a dica
  se perderia.

## Como foi feito

A regra de repetição saiu pra um arquivo próprio, `js/envio-retentativa.js`, **sem tela e sem
rede**. É isso que permite o teste **executar a regra de verdade** — cai na 1ª e na 2ª tentativa e
passa na 3ª; conta quantos endereços novos foram pedidos; confere que a espera aumenta a cada
queda; confere que 4xx não repete — em vez de conferir o código por leitura, que é o que a maioria
das guardas antigas faz.

## Arquivos alterados

- `js/envio-retentativa.js` (novo) — a regra: quantas tentativas, quanto esperar, o que repetir e
  o que dizer.
- `js/importacao.js` — o envio do ZIP passa pela regra; o vigia de lentidão agora **corta** o envio
  parado em vez de só avisar.
- `build.js` — publica o arquivo novo.
- `tests/v1217-envio-zip-tenta-de-novo.test.mjs` — guarda que executa a regra.
- `tests/v1199-envio-mostra-mb-e-avisa-lentidao.test.mjs` — o "X de Y MB" que ela protege continua
  valendo; o texto ganhou o número da tentativa e o vigia passou a ser encerrado num lugar só.
- `ESTADO-ATUAL.md` — registra o arquivo novo.
- `package.json` / `package-lock.json` — versão 1217.

Conferido no navegador (Chromium headless sobre `public/`): o pedaço da importação continua
carregando sob demanda e a regra de repetição funciona lá dentro (cai na 1ª, passa na 2ª).

## O que continua igual

O limite de tamanho, o preparo do ZIP no aparelho, a análise e o salvamento: nada mudou. Esta
versão mexe só no trecho entre "preparei o ZIP" e "o armazenamento recebeu".
