# v1342 — trava para o caso do Jamil: atendido hoje não volta pra fila de hoje

## Nada muda na sua tela

Esta é uma versão de **proteção**. Não tem botão novo nem texto novo — ela existe pra garantir que
um problema que você apontou não volte.

## O que foi checado

Você mandou dois prints do mesmo cliente: um mostrando que ele tinha sido atendido **naquele
momento**, e o outro mostrando ele **na fila de prioridades**. Duas coisas se somaram ali:

1. **O número da linha estava mentindo** — isso foi corrigido na 1332: hoje a linha diz "atendido
   hoje" ou "falou há Xd", com a palavra na frente, sem número velho ao lado de cliente novo.
2. **A fila.** Fui atrás da regra que tira o cliente da fila depois de atendido (o "descanso" que
   você configura no Cérebro) e testei, uma por uma, todas as formas de registrar um atendimento:
   o botão "Marcar atendimento", copiar a sugestão, a observação escrita na conversa e o registro
   do servidor. Testei também as formas que já causaram problema antes: lembrete marcado pro mesmo
   dia, compromisso escrito como "hoje" numa análise antiga, lembrete velho pendurado.

**Resultado: a regra da fila está certa em todas elas.** O cliente atendido hoje fica fora da fila
de hoje em todos os casos. O que você viu era o número mentindo, e isso já estava corrigido.

## Por que isso vira uma versão

Porque "está certo hoje" não vale nada sem trava. Essa regra já foi remendada quatro vezes ao longo
do projeto (1018, 1052, 1213, 1264) e nunca teve teste com o formato exato do seu caso. Agora tem —
com os dois lados protegidos:

- o cliente atendido hoje **fica fora** da fila (as quatro formas de registrar);
- e o descanso **não vira prisão**: passado o prazo o cliente volta, cliente nunca atendido entra
  na hora, e lembrete de um dia depois do atendimento continua chamando o cliente de volta.

Se alguém mexer nessa regra e quebrar qualquer um desses lados, a publicação para antes de chegar
no seu celular — que é a trava da 1338.
