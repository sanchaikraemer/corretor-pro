# v988 — lembrete só nasce de clique em "Agendar", nunca de texto

## Contexto

Depois do fix da v987 (mais uma variação de "lembrete fantasma" corrigida), o dono foi direto ao
ponto: já eram 3 correções seguidas (v930, v969, v987) pra régua de detectar lembrete por texto,
cada uma cobrindo uma frase nova que ela interpretava errado. Ele decidiu que não vale mais a pena
tentar acertar por heurística: **"nunca marque lembrete pelo que é dito, no histórico ou nas
conversas ou observações. A agenda só pode ser anotada se clicar em agendamento."**

## O que mudou

Removida INTEIRA a extração automática de lembrete por palavra-chave em `api/reanalisar-lead.js`:
- `lembreteDoTexto` (lia texto atrás de "agende/marque/lembre + data").
- `lembreteDaTimeline` (varria o histórico salvo procurando esse mesmo padrão).
- `fazerLembrete` (montava a data final a partir do que essas duas achavam).
- `diasAteDiaSemana`/`diaSemanaBRDe` (cálculo de "quantos dias até sábado", usado só por essa
  extração).

`aplicarLembrete` — chamada ao salvar observação/atendimento e ao reanalisar — agora só faz duas
coisas: preserva um lembrete que já existia (desde que não seja um "auto:true" legado, inventado
pela régua antiga — esses são descartados na primeira reanálise seguinte, limpando sozinho
lembretes fantasma antigos como o do Valdir) ou zera se o corretor clicou em "Excluir". Nunca mais
cria ou modifica um lembrete a partir do que está escrito em qualquer lugar.

**O que continua igual:** os botões "Agendar" (Hoje/Amanhã/+3/+7 dias ou data escolhida) e
"Excluir" na Agenda — essas ações explícitas não passam por `aplicarLembrete`, têm sua própria
rota (`reagendar-lembrete`/`remover-lembrete`) e não foram tocadas.

## Testes

Os 4 testes que cobriam a régua removida (`v930-lembrete-ignora-audio`,
`v957-dia-semana-baseDate-fuso-br`, `v969-lembrete-fantasma-radical-lembr`,
`v987-lembrete-fantasma-lembrei-lembrou`) foram apagados — testavam um recurso que não existe
mais. Novo teste `tests/v988-lembrete-so-por-acao-explicita.test.mjs`: confirma que as funções
antigas sumiram do arquivo, que `aplicarLembrete` não lê mais `novoAtendimento`/timeline, que
preserva lembrete manual, descarta legado `auto:true`, respeita `lembreteRemovido`, e que as
ações explícitas de agendar/remover continuam existindo intactas.

## Verificação

- `npm test`: suíte inteira verde.
- `node --check api/reanalisar-lead.js` OK.

## Arquivos

`api/reanalisar-lead.js` (remove toda a heurística de lembrete por texto), testes obsoletos
apagados (`v930`, `v957`, `v969`, `v987` — os que testavam essa heurística),
`tests/v988-lembrete-so-por-acao-explicita.test.mjs` (novo), `package.json`/`package-lock.json`,
`NOTAS-v988.md`, versão **987 → 988**.
