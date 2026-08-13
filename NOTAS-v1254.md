# v1254 — "170 atendidos · 1.356 mensagens" some de dentro da tela do cliente

Pedido do dono, com print e a linha circulada de vermelho:

> "isso q circulei não pode aparecer dentro dos leads, somente na tela inicial"

## O que estava acontecendo

Ao abrir um cliente, a linha

> **170 atendidos · 1.356 mensagens**
> Agosto, do dia 1 até hoje · toque pra ver tudo

ficava espremida entre o topo do app e os botões do atendimento (Voltar / Proposta / Reativar /
Mensagens), empurrando tudo pra baixo. Ela é o resumo do **seu mês** — informação da tela inicial.
Dentro do cliente não tem nada a ver com o que você está fazendo ali.

## Por que aconteceu

Essa linha foi criada na v1251 e nasceu na mesma coluna da tela inicial onde já moram os
quadradinhos, a lista de clientes do dia e o cabeçalho. **Todos os vizinhos dela já tinham a
ordem de sumir quando um cliente é aberto — só ela ficou de fora da lista.** Não era um cálculo
errado nem um bug de conta: era um bloco novo que ninguém somou à lista de "esconde quando abrir
um cliente".

## O que mudou

A linha entrou nessa lista. Agora:

| Onde | O que aparece |
|---|---|
| Tela inicial (celular) | A linha "X atendidos · Y mensagens", que abre o painel ao toque — **igual antes** |
| Tela inicial (computador) | O painel "Seu mês" aberto na coluna da direita — **igual antes** |
| Dentro de um cliente | **Nada disso.** A tela do cliente começa direto nos botões do atendimento |

## Conferência antes de publicar

Abri o app publicado num navegador de verdade, em **390×844** (celular) e **1280×900**
(computador), e conferi os dois estados:

- Celular, tela inicial: a linha aparece normalmente (53 pixels de altura).
- Celular, com cliente aberto: sumiu de vez.
- Computador: continua como já era — a linha não existe lá, e o painel da coluna da direita já
  sumia sozinho com o cliente aberto.

## Teste

`tests/v1254-numeros-do-mes-so-na-tela-inicial.test.mjs`.

Além de travar essa linha específica, ele virou uma **rede pro erro se repetir**: ele lê todos os
blocos que existem na coluna da tela inicial e cobra que **cada um** tenha a ordem de sumir com o
cliente aberto. Se alguém criar um bloco novo lá amanhã e esquecer disso — que foi exatamente o
que aconteceu na v1251 —, o teste falha na hora e diz o nome do bloco esquecido.
