# NOTAS v1086 — URGENTE: importação levando minutos

## O que o dono relatou

> *"a análise na importação está demorando demais, não tem condições"*
> *"faz quase 5 minutos que estou aguardando uma importação"*

## A causa: uma varredura pesada rodando duas vezes por importação

Toda importação procura na carteira se aquele cliente já existe (pra atualizar o mesmo cadastro em
vez de criar duplicado). Essa busca roda **duas vezes**: uma ao preparar o arquivo e outra na hora
de salvar.

Ela só precisa de **nome e telefone** pra achar o cliente — mas estava trazendo junto a **conversa
inteira de até 5 mil clientes**. Numa carteira grande isso são dezenas ou centenas de megabytes
baixados e convertidos, **duas vezes, a cada importação**. Era isso que fazia a importação levar
minutos.

## Por que isso tinha voltado

Este defeito já tinha sido corrigido na v1082 — e eu **desfiz a correção na v1085**.

Motivo: a solução da v1082 buscava a conversa do cliente encontrado numa segunda consulta que, se
falhasse, **devolvia conversa vazia sem erro nenhum**. Conversa vazia ali significa perder a lista
de áudios já transcritos: a importação re-transcrevia tudo, estourava o tempo limite e nunca
concluía (foi o problema da v1085). Como o dono estava travado, revertê-la foi a decisão certa
naquele momento — mas trouxe a lentidão de volta.

## A correção agora tem as duas coisas

- A varredura da carteira voltou a ser **leve**: não traz mais a conversa de todo mundo.
- A conversa do cliente encontrado é buscada **numa consulta dirigida só a ele**.
- E, o ponto que faltava antes: essa segunda busca **tenta 3 vezes e, se ainda assim não
  conseguir, estoura**. Ninguém mais recebe uma conversa vazia achando que é a real — nem o cache
  de áudio, nem o salvamento (onde uma conversa vazia apagaria o histórico do cliente).

Se por algum motivo a leitura falhar durante o preparo, a importação continua, mas **o aviso vai
junto na resposta** — aparece no diagnóstico em vez de virar só "hoje demorou muito".

## Uma segunda fonte de espera, na própria análise

A biblioteca da OpenAI **repete a chamada sozinha até 3 vezes** quando o serviço responde
"ocupado" — e faz isso **por dentro** da nossa janela de 26 segundos. Em hora de fila, essas
tentativas escondidas consumiam a janela inteira antes de a nossa própria repetição começar,
dobrando o tempo de espera na tela.

Desligado. A falha volta na hora e quem controla a repetição é o mecanismo do próprio projeto, que
tem intervalo próprio e vale igual pra todas as chamadas.

## Testes

`npm test` verde. O teste da v1085 foi reescrito pra cobrir o desenho novo, incluindo a regra de
ouro: **falha ao reler a conversa tem que estourar**, nunca devolver conversa vazia. Essa
asserção é o que impede este vaivém de acontecer de novo.

## Observação honesta

Duas versões seguidas mexendo no mesmo ponto (v1082 quebrou, v1085 reverteu, v1086 acerta) é
sintoma de uma coisa: eu tratei um ganho de desempenho como mudança simples num caminho que é o
mais crítico do app. O acerto aqui não foi escolher entre "rápido" e "seguro" — foi tornar a falha
**visível**, que era o que faltava desde o começo.
