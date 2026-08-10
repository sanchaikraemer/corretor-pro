# v1193 — atualizar a tela não abre mais a tela de importação

## O relato

Palavras do dono, depois da v1192: *"eu não to importando nada, somente atualizei passando o dedo
na tela, só isso, e muda pra essa tela de merda"*.

Ele estava certo, e o meu diagnóstico anterior estava incompleto. A v1192 consertou o caso de
**quem acabou de compartilhar** um arquivo que falhou: limpou o endereço, deu uma saída pela tela
e explicou o arquivo vazio. Mas não consertou o caso dele, que é o mais comum de todos:

**O app instalado reabre na última URL.** O `?shared=1&shareId=...` daquele compartilhamento que
falhou de manhã continuava grudado no endereço. Como é justamente esse pedaço do endereço que faz
o app entrar no modo importação, **todo puxão de tela pra atualizar reentrava lá** — e, na v1192,
ainda esperava **15 segundos** procurando um arquivo que não existia antes de dizer qualquer coisa.

Ou seja: ele não estava importando nada. O app é que insistia em achar que estava.

## O que mudou

Antes de mostrar qualquer coisa, o app agora pergunta: **esse compartilhamento é de agora?**

- Se o último compartilhamento registrado neste aparelho tem **mais de 10 minutos** e **não há
  nenhum ZIP com conteúdo esperando**, isso é marca velha. O endereço é limpo e o app abre normal —
  **na hora, sem tela de importação, sem espera de 15 segundos e sem aviso de erro nenhum.**
- Um compartilhamento **de verdade** (recém-chegado, com o arquivo gravado) segue exatamente o
  caminho de sempre. A regra só desliga quando não existe arquivo com conteúdo esperando.

Junto, uma segunda falha que a v1192 deixou passar: quando o compartilhamento falhava, o arranque
do app **parava ali** — a carteira nunca era carregada. Quem saísse do aviso encontrava uma Home
vazia (parte do "cadê meus leads?"). Agora o aviso fica na tela e **o app carrega a carteira por
trás**, pra que "Voltar ao app" encontre tudo no lugar.

## Verificação

Os três cenários reproduzidos num Chromium de verdade, sobre o app publicado, em tela de celular
(390×844):

| Cenário | Resultado |
|---|---|
| Marca velha no endereço (5 horas atrás), como no aparelho do dono | Endereço limpo, **Home aberta em 3s**, tela de importação nunca aparece, nenhum aviso de erro |
| Arquivo vazio recém-compartilhado | Aviso honesto do arquivo vazio, sem o botão inútil de recuperar, "Voltar ao app" leva pra Home |
| Endereço com compartilhamento não encontrado | Avisa, limpa o endereço e a próxima atualização abre o app normal |

Em todos: sem erro de página. Também conferido que o app **pede os leads ao servidor** por trás do
aviso (antes não pedia).

- `npm test` — **362 testes verdes**, 24 arquivos checados.
- `npm run build` — 28 arquivos publicados, versão 1193.
- `tests/v1192-share-falho-nao-prende-o-app.test.mjs` ganhou dois itens novos: o arranque não pode
  mais ser interrompido por compartilhamento falho, e a checagem de marca velha precisa vir **antes**
  de mostrar a tela e **antes** da espera de 15 segundos — que é o que faz o dono nem ver a tela.

## Para o dono

Depois que esta versão chegar no celular, **a primeira atualização de tela pode ainda mostrar
aquela tela uma última vez** (o app precisa carregar o código novo). Da segunda em diante, some de
vez — inclusive a marca velha some do endereço sozinha.
