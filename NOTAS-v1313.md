# v1313 — a análise que pergunta em vez de entregar

Print do dono, 19/08/2026 às 17h22, conversa da Noemi, **Cérebro em 100%**: as TRÊS sugestões eram a
mesma pergunta — *"é para morar ou investir?"*. E logo depois ele colou o que um ChatGPT comum
respondeu para a mesma conversa: entregou o que ela pediu, ligou com o que ela procurava em janeiro
e propôs a visita. *"Veja como é infinitamente melhor."*

Ele está certo. Três defeitos, todos aqui.

## 1. A pergunta que ele já tinha feito voltou — por causa de um teto de 6

A regra "não repita pergunta já respondida" já existia no pedido. O que faltou foi o **fato**: a lista
das perguntas que o corretor já fez guardava só as **6 mais recentes**. Nessa conversa de sete meses
ele fez umas dez — e "está procurando algo para morar ou para investir?", que era a **primeira
mensagem dele**, caiu da lista.

Ou seja: a IA nunca soube que aquilo já tinha sido perguntado. Agora cabem 14, e as perguntas de
**abertura nunca caem** — numa conversa longa são justamente as que a IA mais tende a refazer, porque
estão longe do trecho final que ela está lendo.

## 2. Travava a entrega esperando "confirmar os dados"

A análise dizia: *"como não há detalhes confirmados do apartamento anunciado, o melhor passo é
descobrir se a compra é para morar ou investir"*. Só que o anúncio que abriu a conversa **já disse**:
2 dormitórios, box de garagem, R$ 430 mil. Isso a cliente já leu.

Regra nova, no pedido: **o que já está escrito na conversa é fato — entregue.** Confirmar antes de
afirmar continua valendo para o que **não** está na conversa. E a proteção que o dono mandou apertar
nas v1301/v1305 continua inteira: *cada fato vale só para o imóvel em que foi dito* — característica
de um empreendimento não se empresta a outro.

## 3. Tratava um retorno espontâneo como primeiro contato

A Noemi voltou **três vezes** (janeiro, junho e hoje), agora por um apartamento que bate com o que ela
procurava desde o começo (2 dormitórios, região central). Recomeçar pela pergunta de abertura joga
esse retorno fora.

Regra nova: **cliente que volta não se qualifica de novo do zero.** Quem reaparece pedindo informação
de um imóvel específico já se qualificou pelo comportamento; o próximo passo é entregar o que ele
pediu, ligar com o que ele já dizia procurar e propor a ação concreta. E, nesse caso, **propor
conhecer o imóvel deixa de contar como "forçar visita antes da maturidade"**.

## Uma observação honesta sobre a mensagem do ChatGPT

Ela ficou ótima na condução — e é isso que esta versão persegue. Mas ela também citou piscina,
academia e três salões de festas, que na conversa aparecem ligados a **outro** empreendimento, e
móveis planejados, que foram ditos sobre o apartamento de 3 suítes. O Corretor Pro continua proibido
de fazer isso, por ordem do próprio dono depois do print do endereço inventado (v1301/v1305). O que
ele **passa** a fazer é entregar, sem pedir licença, tudo que está escrito sobre o imóvel de que se
está falando.

## Arquivos

- `api/_pipeline.js` — teto de perguntas já feitas (6 → 14, abertura preservada); as duas regras
  novas no pedido; e o trio não pode mais ser a mesma pergunta em três roupas.
- Teste: `v1313-pergunta-antiga-nao-volta` (executa a conversa real da Noemi e confere que a
  pergunta de abertura chega à IA marcada como já feita).
