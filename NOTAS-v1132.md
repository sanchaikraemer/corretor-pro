# v1132 — o corretor entra, exporta uma conversa e JÁ VÊ o sistema funcionando

## O que o dono disse (e ele está certo)

> *"Como é que a pessoa vai entrar no app e vai configurar cérebro se ela nem sabe pra que serve e
> como funciona? Você tem que pensar em vender isso. Se é pra nós vender esse sistema, o corretor
> tem que entrar, exportar uma conversa dele no WhatsApp e já ter uma prévia do que está
> acontecendo. Não tem que estar fazendo mil e uma configuração."*

## O que estava acontecendo

Conta nova, sem Cérebro configurado → a análise era **recusada**. O sistema respondia, em essência:
*"configure o Cérebro Comercial primeiro"*.

A intenção original (v851/v852) era boa: não deixar a IA cuspir sugestão genérica inventada. Mas o
efeito no produto era fatal:

- Quem acabou de se cadastrar **não sabe o que é o Cérebro nem pra que serve**.
- Era obrigado a preencher configuração **antes** de ver o sistema funcionar uma única vez.
- Ninguém preenche formulário para um produto que ainda não provou nada.

Ou seja: o primeiro passo de todo cliente novo — o passo que decide se ele compra — terminava num
beco. Um produto assim não se vende.

**A v1131 tentou consertar isso explicando melhor o erro.** Estava errado: explicar melhor um beco
continua sendo um beco. A correção de verdade é não ter beco.

## Como ficou: MODO PRÉVIA

Sem Cérebro configurado, a análise **acontece normalmente**, apoiada na conversa que o corretor
acabou de exportar. Ele importa e vê, de primeira: o resumo da conversa, o perfil do cliente, as
objeções, o melhor horário, a próxima ação e **as três mensagens sugeridas** — reais, utilizáveis,
construídas a partir da conversa dele.

Depois da análise, um convite (não um erro, não um bloqueio):

> **Esta análise saiu só da conversa que você enviou.**
> A IA ainda não conhece o seu jeito de falar, os seus empreendimentos nem as suas condições — por
> isso ela evita afirmar preço, prazo ou localização e prefere oferecer confirmar.
> Ensine isso uma vez e as próximas mensagens saem no seu tom, com as suas condições e as suas
> respostas de objeção.
>
> **[ Ensinar a IA a falar como eu ]**

Esse é o momento certo de pedir a configuração: **depois** de ele ver o próprio atendimento
analisado, quando o valor já ficou claro e o Cérebro deixa de ser burocracia e vira melhoria.

## Por que isso é seguro (a regra do projeto continua intacta)

A regra registrada em `CLAUDE.md` diz: nenhuma informação comercial pode ser cravada no código;
tudo vem do Cérebro **ou da própria conversa analisada**; na ausência, "Não identificado" — nunca
inventar. A prévia respeita isso à risca:

- O **piso comercial** (`INTELIGENCIA_CARTEIRA`), que já entrava no prompt em toda análise, **já
  proíbe** afirmar condição, valor, empreendimento ou localização que não esteja escrita na
  conversa — nesses casos manda a IA perguntar ou oferecer confirmar. Ele não some na prévia.
- Em cima disso, a prévia manda instruções explícitas: nunca afirmar preço, condição de pagamento,
  desconto, prazo, nome de empreendimento, endereço, cidade, bairro ou metragem que não esteja na
  conversa; oferecer confirmar quando o cliente perguntar algo que não está lá; campo sem base fica
  em "Não identificado".

O que a prévia **não** tem é o jeito de falar dele, as condições da construtora dele e as respostas
de objeção que ele ensina — que é exatamente o que o Cérebro acrescenta, e exatamente o que o
convite promete.

## Testes que mudaram (leia antes de "restaurar" algo)

Três testes antigos travavam a recusa como se fosse a proteção. Eles foram reescritos **de
propósito**, mantendo o que realmente protege:

- `v852-cerebro-integridade` — antes exigia "nenhuma chamada à IA sem Cérebro". Agora exige o
  contrário (a prévia precisa acontecer) **e** verifica que ela vai amarrada: o prompt precisa
  conter as proibições de afirmar dado comercial. As checagens contra texto comercial cravado no
  código continuam todas lá.
- `v855-cerebro-prioridade-sem-temperatura`, `v859-cerebro-blocos-chegam-ia`,
  `v945-playbook-vivo-e-cerebro-protegido` — o bloco do Cérebro virou condicional no prompt; os três
  passaram a aceitar isso, continuando a exigir que, **quando o Cérebro existe**, o conteúdo dele
  chegue integral e com prioridade máxima.

E entrou `v1132-conta-nova-ve-o-produto-funcionando`, que trava a decisão inteira: conta sem Cérebro
recebe análise de verdade, com as três mensagens, marcada como prévia, com as proibições no prompt —
e o convite na tela não pode virar mensagem de erro. O modo de recusa (`cerebro_ausente`) não pode
voltar a existir.

## Arquivos

- Alterados: `api/_pipeline.js` (modo prévia no lugar da recusa), `app.js` (o convite),
  `tests/v852`, `tests/v855`, `tests/v859`, `tests/v945`.
- Novo: `tests/v1132-conta-nova-ve-o-produto-funcionando.test.mjs`.

## Conferido

- Suíte completa: **305 testes verdes**.
- Análise sem Cérebro executada de ponta a ponta com IA simulada: volta em modo prévia, com as três
  mensagens preenchidas, e o prompt carrega todas as proibições.
- Convite renderizado no Chromium, celular e computador: sem scroll lateral, botão funcionando.
