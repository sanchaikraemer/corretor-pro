# NOTAS v1023 — agendamento só por clique explícito, nunca por texto da conversa

## O relato

Logo depois da v1022 (que parou de considerar compromisso vencido), o dono foi mais fundo:
"mesmo que haja alguma coisa na conversa sobre vamos agendar, vamos visitar, vamos conversar de
novo, você não pode agendar... agendamento só pode ser feito se clicar em agenda, sem exceção" —
repetindo uma ordem que já tinha dado em dias anteriores.

Esse é exatamente o mesmo princípio já aplicado ao **lembrete** na v988 ("nunca marque lembrete
pelo que é dito... a agenda só pode ser anotada se clicar em agendamento") — só que nunca tinha
sido estendido pra um segundo mecanismo parecido que existia no sistema: o "compromisso
confirmado" (campo interno `confirmedAppointments`), preenchido no passado por uma leitura da IA
sobre a conversa.

## Causa

A extração que POPULAVA esse campo a partir da conversa já tinha sido desligada há tempos (a
análise principal não pede mais isso à IA — sempre devolve vazio). O problema era outro: **toda
ação de salvar um lead reescrevia de volta o que já estava gravado no banco**, incluindo um
compromisso antigo que a IA tinha inferido há muito tempo, antes dessa extração ser desligada.
Copiar uma mensagem sugerida, marcar atendimento, adicionar observação, mudar etapa, editar nome/
telefone, reanalisar — praticamente qualquer clique no lead — pegava "tudo que já existia" e
gravava de novo, perpetuando esse resíduo antigo pra sempre, mesmo sem a IA nunca mais ter
inventado nada novo.

## Correção

- Todo lugar que **lê** um lead (lista da Home/Carteira e o detalhe completo) agora ignora esse
  campo por completo — mesmo que ainda exista alguma coisa antiga gravada no banco.
- Toda ação que **grava** um lead (reanalisar, copiar mensagem, marcar atendimento, observação,
  mudar etapa, editar dados, o primeiro salvamento depois de importar, entre outras) agora zera
  esse campo antes de salvar — o resíduo antigo se limpa sozinho assim que o lead é tocado de
  novo, em vez de ser perpetuado.
- A parte do código que tentava "validar" esse tipo de compromisso lendo a conversa (mesmo com
  citação literal) foi removida — não faz mais sentido validar algo que não pode mais existir.

## Teste novo

`tests/v1023-agendamento-so-por-clique-nunca-por-texto.test.mjs` — confirma que a leitura sempre
devolve vazio (mesmo com dado antigo no banco, mesmo no detalhe completo do lead), que a extração/
validação por texto foi removida do servidor, e que cada uma das ações que gravam um lead
(reanalisar, copiar mensagem, atendimento, observação, etapa, editar dados, primeiro salvamento
etc.) zera esse campo antes de gravar.

## `npm test`

Suíte inteira verde.
