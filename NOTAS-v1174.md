# v1174 — o "trava em 92%" era o teto de análises do dia sendo queimado por tentativa que falhou

Prints do dono em 06/08/2026, em sequência: importação parada em **92%** ("Analisando pelo seu
Cérebro — validando as três mensagens pelo Cérebro"); logo depois, no cliente Daniel Antunes,
"Não foi possível concluir a análise" com o motivo verdadeiro num toast: **"Limite diário de 50
análises de IA foi atingido para esta conta. Tente novamente amanhã."**; e o painel da OpenAI
mostrando **114 chamadas e US$ 4,40 no mês inteiro**, com US$ 11,93 de crédito sobrando. Ou seja:
o provedor de IA estava de bem com a vida — quem barrou foi **o nosso próprio contador**. Tentar
liberar plano Pro na conta não resolveu (o painel respondeu "a conta original não usa pacotes —
ela fica fora dos planos de propósito"), porque a conta dele é a original e ela não usa plano.

Eram **três defeitos empilhados**, e os três estão corrigidos aqui.

## 1. Tentativa que falha gastava análise do mesmo jeito

O contador do dia era somado **antes** da chamada à IA — e isso está certo: é o que impede um laço
descontrolado de gastar dinheiro real na OpenAI. O que faltava era o outro lado: **nada devolvia
essa unidade quando a análise não acontecia**. Tempo esgotado, erro do provedor, resposta sem as
três mensagens — tudo consumia uma análise das 50 exatamente como uma análise entregue.

E o app repete sozinho: a etapa "analisar" tenta 2x, e a importação ainda tem a etapa anterior que
também pode analisar. Uma única importação que falhava queimava **4 a 6** das 50 sem entregar nada.
Num dia de testes, o teto evaporava sem que uma análise sequer tivesse chegado na tela.

Agora a unidade **volta** sempre que não sai análise utilizável. No banco isso é feito pela função
nova `devolver_analise_ia` (migração `0016`), com a mesma trava por empresa que a reserva usa e
sem nunca deixar a contagem negativa; enquanto a migração não for aplicada, o servidor faz a
devolução pelo caminho antigo — nada quebra.

## 2. Bater no teto era tratado como "erro passageiro" — e o app repetia

Recusa por limite voltava marcada como recuperável, igual a uma queda de rede. O app então
esperava 1,2s e mandava tudo de novo, pra receber a mesma recusa — o dobro do tempo de tela parada
pra chegar na mesma resposta. Agora essa recusa vem marcada como definitiva e o app **para na
primeira**, mostrando o motivo verdadeiro na hora (com o botão do WhatsApp comercial quando a
conta é de plano). Quando a análise já roda na etapa anterior e é recusada ali, o aviso sobe
naquele mesmo instante, sem seguir pra etapa seguinte só pra ouvir "não" de novo.

## 3. O congelamento em si: a tela cheia ficava por cima do erro

Este é o "trava" literal do print. Quando a análise falha, o app desenha na tela de baixo a
explicação e os botões ("Tentar analisar novamente", "Descartar importação") — mas esse caminho
**não passava pelo único lugar que fecha a tela cheia da importação**. Ela continuava de pé, parada
no teto do anel daquela etapa (a etapa "Analisando" vai de 86% até 92% e para ali, de propósito,
pra nunca anunciar uma etapa que não começou). Resultado: **92%, imóvel, escondendo a resposta que
já estava pronta atrás** — e só um vigia de inatividade a derrubava, **até 2 minutos depois**.

Agora a tela cheia sai de cena antes de o erro ser escrito. O que o dono via como travamento
aparece como o que sempre foi: uma explicação e dois botões.

## 4. E, mesmo quando está tudo certo, 92% parado parecia travado

Uma análise honesta de conversa grande leva dezenas de segundos. Nesse tempo a tela ficava idêntica
de um minuto pro outro: mesmo número, mesmo texto. Não dá pra distinguir "trabalhando" de
"morreu". As duas etapas que realmente demoram — **ouvir os áudios** e **analisar** — agora contam
os segundos no detalhe embaixo do título:

> validando as três mensagens pelo Cérebro **· 38s**

Só a partir de 5 segundos (numa conversa pequena a etapa passa voando e um contador piscando seria
ruído). Enquanto esse relógio corre, o vigia que fecha a tela por inatividade é rearmado — antes
ele podia derrubar tudo aos 2 minutos **com o servidor ainda trabalhando**. Passados 4 minutos o
rearme para: ninguém pode ficar preso pra sempre numa tela.

## 5. Fusível da conta original: 50 → 150 por dia

Pedido direto do dono ("empresa 1 sou eu, aumenta o limite pra 150 dia"). A conta original é a
única com esse fusível técnico (as pagas usam os planos, o teste usa 5/dia) e é também a bancada
de teste do produto — 50 estava apertado demais pra quem passa o dia importando conversa pra
conferir se o app está funcionando. Continua ajustável sem publicar nada, pela variável
`CORRETOR_PRO_LIMITE_ANALISES_DIA` na Vercel.

## 6. O painel administrativo agora mostra (e destrava) o contador

Antes, o teto era **invisível** até o momento em que estourava na cara do corretor, e não havia
como zerar sem abrir o banco na mão. Agora cada conta tem, no card, um selo **"X/Y hoje"**:
neutro no uso normal, **âmbar** a partir de 80% do teto, **vermelho** quando já travou. E as ações
da conta ganharam **"Zerar análises de hoje"** — o destravamento na hora, pra quando o contador
subiu por falha e não por uso.

## Arquivos

- `api/_pipeline.js` — `devolverReservaAnalise` (devolve a unidade), `verificarLimiteAnalises`
  agora informa se realmente reservou, `resumoLimiteAnalises` e `zerarContagemAnalises` pro painel,
  fusível da conta original em 150/dia.
- `supabase/migrations/0016_devolver_reserva_analise.sql` — a devolução atômica no banco (só o
  backend pode chamar, mesma regra de permissão da `0014`).
- `api/processar-storage.js` — recusa por teto vem como definitiva, com o motivo e o convite de
  plano, tanto na etapa "analisar" quanto na análise adiantada da etapa anterior.
- `api/reanalisar-lead.js` — mesma marca de "bateu no teto" na reanálise.
- `app.js` — para de repetir quando é teto; fecha a tela cheia antes de mostrar o erro; relógio de
  segundos nas etapas longas; mensagem de limite passa inteira pro corretor.
- `api/admin-contas.js` + `admin-plataforma.html` + `contas-estilo.css` — consumo do dia por conta
  e botão de zerar.
- `tests/v1174-tentativa-falha-nao-gasta-analise.test.mjs` — regressão dos quatro pontos;
  `v1013` e `v1110` atualizados pro fusível novo.

## Conferido

- Suíte completa verde (24 arquivos, 340 testes).
- Visual no Chromium headless (412×915, tamanho de celular), no app publicado: a etapa "Analisando
  pelo seu Cérebro" mostra `validando as três mensagens pelo Cérebro · 8s`, depois `· 14s`, com o
  anel subindo 83% → 90% → 91%; ao trocar de etapa o relógio para e o detalhe novo manda; a tela
  some quando mandam sumir. Painel administrativo abre sem erro e o selo novo aparece nos três
  estados (3/150, 130/150 em âmbar, 15/15 em vermelho).
- **O que esta sessão não consegue conferir**: os números reais do contador em produção (sem acesso
  ao Supabase). Se a conta ainda aparecer travada depois de publicar, o botão "Zerar análises de
  hoje" no painel resolve na hora.
