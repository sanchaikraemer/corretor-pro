# v1215 — o número do sino passa a ser exatamente o que a Agenda mostra

Print do dono, 11/08/2026 às 13:21: o **sino do topo avisava 2** e a tela Agenda logo abaixo
listava **"LEMBRETES DE HOJE (1)"**, com um único cliente (Mateus, 14:00) e nenhuma seção de
atrasados. Pergunta dele: *"pq tem 2 notificação no sino lá em cima, se só tem 1 agendamento pra
hoje?"*

## O que estava errado

O número do sino e as listas da tela Agenda eram **duas contas parecidas, escritas em dois lugares
diferentes do app**. Enquanto ninguém mexia nelas, davam o mesmo resultado. Bastou uma ganhar uma
regra nova pra elas discordarem — e foi o que aconteceu duas vezes:

1. **Cliente já atendido hoje continuava contando no sino.** Na v1199 a Agenda aprendeu a tirar da
   lista do dia quem já foi atendido (o dono tinha reclamado que atendia e o cliente ficava lá).
   Essa regra entrou só na tela — o sino nunca soube dela e seguiu cobrando quem já saiu da lista.
   É o "2" do print: um cliente aparecendo no contador sem aparecer em lugar nenhum da tela.

2. **Marcar atendimento não mexia no sino.** Ao marcar (ou desmarcar) um atendimento, o app
   redesenhava a barra de compromissos do topo, a tela do cliente e a Home — mas o número do sino
   só se acertava no próximo carregamento da tela Hoje ou num F5. Quem marcava atendimento e ia
   direto pra Agenda via o número velho parado lá em cima.

## O que mudou

**As duas telas passam a ler do mesmo lugar.** O dia (atrasados, lembretes de hoje, compromissos de
hoje/amanhã/futuro) é montado uma vez só e serve tanto pro número do sino quanto pras listas da
Agenda. Não existe mais como uma regra nova entrar em uma e faltar na outra.

**O sino conta pessoas, não linhas.** Um cliente que tem lembrete de hoje *e* compromisso marcado
pra hoje aparece em duas seções da Agenda, mas é **um cliente só** esperando por você — o sino diz
1. Do mesmo jeito, quem já está sendo cobrado na seção "Atrasados" não é somado outra vez na conta
do dia.

**Marcar ou desmarcar atendimento acerta o sino na hora**, em qualquer tela, sem precisar atualizar
a página — e usando a carteira que já está na memória do aparelho, então o número muda no instante
do toque, sem esperar o banco responder. Isso vale pras quatro formas de registrar atendimento:
botão "Marcar atendimento", cópia de mensagem sugerida, observação escrita à mão e agendamento.

## O que continua igual

- **Compromisso atrasado segue acendendo o sino em vermelho com o número de atrasados** (regra da
  v1093) — nada mudou nesse destaque.
- A régua do que é "atrasado" continua a mesma da v1213 (compromisso cumprido na data não é
  cobrado).
- Nenhuma informação comercial foi cravada em código; nada mudou no Cérebro nem nas telas de
  análise.

## Teste de regressão

`tests/v1215-sino-conta-o-mesmo-que-a-agenda.test.mjs` cobre os quatro pontos: fonte única para as
duas telas, cliente atendido hoje saindo do dia (lembrete e compromisso, sem afetar amanhã),
contagem por pessoa (sem contar duas vezes o mesmo cliente nem o atrasado) e o recálculo do sino
junto com a barra do topo ao marcar atendimento.

O teste da v1093 foi ajustado no mesmo movimento: ele checava a régua de atraso dentro do código do
sino, e agora checa que o sino lê a fonte única e que a fonte única é quem olha o atraso — a mesma
garantia, no lugar novo.

Suíte completa verde (24 arquivos, 382 testes). Nenhuma mudança de CSS ou de layout nesta versão —
só o número que aparece no sino.
