# NOTAS v1033 — cópia de mensagem logo após reanalisar podia não marcar atendimento

## O relato

O dono copiou a 1ª mensagem sugerida de um lead e não marcou atendimento (a tela continuou como
se ele não tivesse feito nada). Na 2ª vez que copiou, funcionou normal. Ele confirmou que era a
mesma função que já tinha sido corrigida na v1031 — mas dessa vez falhou de novo, de um jeito
diferente.

## O que estava acontecendo

O lead tinha acabado de passar por uma reanálise (a "Última análise" mostrava um horário poucos
minutos antes). Depois que a reanálise termina, o sistema busca os dados mais atualizados do
servidor em segundo plano, uns instantes depois, pra manter a tela sincronizada — e essa busca
SUBSTITUI o lead e as listas inteiras pelo que veio do servidor.

O problema: se o corretor copia a mensagem (o que marca "atendido" na hora, só na tela) bem nessa
janela de tempo — reanálise acabou de terminar, mas a busca de sincronização ainda não rodou — a
marcação de atendido é APAGADA quando essa busca substitui tudo, porque o servidor ainda não tinha
recebido a confirmação do atendimento (ela é gravada por uma chamada separada, em paralelo). Não
sobra nenhum aviso — some silenciosamente, do mesmo jeito que o problema da v1031, só que
disparado por essa outra sincronização (que a v1031 não mexeu).

Na 2ª cópia já não tinha mais risco: aquela sincronização de fundo já tinha rodado e passado, então
a marcação ficou de pé.

## O que mudou

Antes de qualquer sincronização de fundo depois de reanalisar, o sistema agora guarda o
atendimento mais recente que já conhecia. Se o que vier do servidor for mais antigo que isso (ou
nem tiver marcação nenhuma ainda), a marcação é reaplicada na hora — sem apagar nada que já tinha
sido confirmado por você.

## Testes novos

`tests/v1033-reanalise-nao-perde-atendimento-copiado-durante-refresh.test.mjs` — simula a
sincronização de fundo chegando com dados desatualizados (sem a marcação) logo depois de uma
cópia de mensagem, e confirma que a marcação sobrevive; e confirma também que uma marcação mais
nova vinda do próprio servidor (outro aparelho, por exemplo) nunca é substituída por uma mais
antiga guardada localmente.

## `npm test`

Suíte inteira verde.
