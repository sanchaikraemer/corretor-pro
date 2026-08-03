# v1124 — card "Arquivados" na tela Hoje

## O que o dono pediu

Print da tela Hoje no celular, com os números do dia (Fazer agora, Total de leads, Agenda,
Aguardando cliente, Sem atender 30d+) e o pedido: *"coloque um card aí também na home com a
quantidade de (arquivados)"*.

No print dava pra ver inclusive o buraco: "Sem atender 30d+" ficava sozinho na última linha, com o
espaço do lado vazio.

## O que mudou

Entrou um sexto card na tela Hoje, **Arquivados**, mostrando quantos contatos estão guardados no
arquivo. Tocando nele, o app abre a tela de Arquivados — a mesma que já existia no Menu, com a
busca e o botão de reativar contato.

No celular ele ocupa exatamente aquele espaço que estava sobrando ao lado de "Sem atender 30d+";
no computador os seis números continuam numa linha só.

## Detalhe importante de como o número é contado

A tela Hoje trabalha com a **carteira ativa** — o contato arquivado é retirado antes de os números
serem calculados. Se o card contasse os arquivados dentro dessa lista, ele mostraria **zero para
sempre**, sem dar erro nenhum e sem ninguém perceber. Por isso a contagem é feita a partir da
carteira **inteira** que volta do servidor (a mesma que alimenta a busca e o sino).

Enquanto a carteira ainda não terminou de carregar, o card mostra `0` — não trava a tela.

## Conferido no navegador

Aberto o app publicado num navegador de verdade, em três tamanhos:

- **Celular (390px):** 3 linhas de 2 cards — "Sem atender 30d+" e "Arquivados" fecham a última
  linha, sem sobra.
- **Tablet (820px):** 4 na primeira linha + 2 na segunda (antes era 4 + 1), sem rolagem lateral na
  página.
- **Computador (1440px):** os 6 numa linha só, 188px cada, nenhum nome cortado.

## O que NÃO mudou

- Os cinco cards que já existiam: mesmos números, mesmos toques, mesma ordem.
- A tela de Arquivados em si (lista, busca, reativar): intacta.
- A regra de sempre: contato arquivado continua fora do "Fazer agora", da fila e do "Total de
  leads". O card novo é só um contador — não devolve ninguém pra carteira ativa.

## Testes de regressão

- `tests/v1124-card-arquivados-na-home.test.mjs` — garante que o card existe, mostra o número,
  abre a tela de Arquivados no toque, que a contagem sai da carteira inteira (nunca da lista de
  ativos, o erro que daria zero pra sempre), que sem carteira carregada o card mostra 0, e que o
  painel do computador tem espaço pras 6 colunas.
- `tests/v1077-contadores-uma-linha.test.mjs` — atualizado de 5 pra 6 cards numa linha só no
  computador (as regras de celular e tablet seguem como estavam).
