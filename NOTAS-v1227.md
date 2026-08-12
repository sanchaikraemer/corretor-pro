# v1227 — revisão completa do sistema: três erros encontrados e corrigidos

Pedido do dono, 12/08/2026, logo depois da v1226: *"revise o sistema inteiro em busca de outros
erros que possam existir."* A revisão passou por quatro frentes: fuso/virada de dia (a família do
erro da v1226), texto sem proteção nas telas, as rotas do servidor (acesso, falhas, concorrência)
e a lógica de prioridade/agenda/contadores do app. Três erros reais apareceram e foram corrigidos;
o resto do que foi conferido está listado no fim.

## 1. Nome de cliente com apóstrofo quebrava um botão — e abria porta pra conteúdo malicioso

No aviso de cadência ("Cliente sem nenhuma resposta desde o primeiro contato"), o botão
**"Arquivar este lead"** montava o nome do cliente sem a proteção certa. Um cliente chamado
"D'Angelo" (ou qualquer nome com apóstrofo, vindo direto do contato do WhatsApp) estourava o
botão no meio: ele parava de funcionar e o resto do nome virava pedaços soltos de página — na
prática, texto vindo de fora (o nome de um contato do WhatsApp) conseguia alterar a estrutura da
tela. O resto do app já usava a proteção certa (`safeJson`) nesse tipo de lugar; este ponto (e
dois parecidos na barra de compromissos, hoje inativos) tinham ficado com a antiga.

## 2. O número na aba do navegador discordava do sino

A aba do navegador mostra "(N) Corretor Pro" pra quem deixa o app aberto em segundo plano. Esse N
era calculado por conta própria: contava lembrete de hoje **sem descontar quem já foi atendido
hoje**. Resultado: o corretor atendia o único cliente do dia, o sino zerava — e a aba continuava
mostrando "(1)". É a mesma doença de "dois relógios pro mesmo número" da v1215 (sino × Agenda),
que tinha sobrado neste canto. Agora o número da aba sai exatamente da mesma conta do sino e se
atualiza junto com ele (inclusive ao excluir/reagendar um lembrete de qualquer tela).

## 3. A repetição do envio do ZIP (v1217) morria se a internet ainda estivesse fora

A v1217 fez o envio da conversa tentar de novo sozinho quando a conexão cai. Mas tinha um buraco:
depois da queda, o app espera 3 segundos e **pede uma nova autorização de envio ao servidor** — e
se a internet ainda não tiver voltado nesse momento (o caso mais comum), esse pedido falhava com
um erro cru que passava por cima das 3 tentativas prometidas. O dono via 1 tentativa e uma
mensagem de erro técnica. Agora essa queda é tratada como o que é — mais uma queda de conexão —
e gasta uma tentativa como qualquer outra, com a mesma espera e o mesmo aviso na tela.

## O que foi conferido e estava certo

- **Fuso/virada de dia** (a família da v1226): as datas do servidor usam Brasília onde importa
  (contador de análises, custo, saudação, data da análise); no aparelho, o dia é o do celular do
  corretor, que é a régua certa pra agenda dele. Nenhum outro par de números divergindo.
- **Rotas do servidor**: chave do Atalho do iPhone (assinada e revogável), trava de cadastro em
  massa (atômica no banco), reserva/devolução do contador de análises, escolha de plano e painel
  administrativo — sem furos novos.
- **Telas**: todos os outros pontos que mostram nome/mensagem/texto de conversa já passam pela
  proteção de texto (`escapeHtml`/`safeJson`).
- **Limpeza ao sair da conta / trocar de dono do aparelho** (v1165/v1185): correta.

## Proteção pra não voltar

`tests/v1227-revisao-apostrofo-titulo-reenvio.test.mjs` executa a regra de repetição do envio de
verdade (queda ao pedir a URL nova gasta tentativa; recusa definitiva não gasta; a desistência sai
com a mensagem que orienta o Wi-Fi) e prende no código as outras duas correções (safeJson nos
pontos com texto livre em botão; título da aba com fonte única do sino).
