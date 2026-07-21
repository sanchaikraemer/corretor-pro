# v901 — linha do tempo do histórico em ordem cronológica pela hora exibida

## Bug (print do dono)
A timeline do lead estava "misturando o horário das mensagens e não mantendo a linha de tempo
correta". Ex. Maurício Knop: "Bom dia… 11:56", depois "Você Certo amigo… 12:24", depois
"Mauricio Abrs 11:58" — a mensagem das 12:24 aparecia no meio, antes das 11:58.

## Causa
`cp704TimelineHtml` renderizava as mensagens na ordem do array `recentMessages`, que vem do
merge (`_mesclarTimelinesV681`) ordenado por `iso`. O problema: mensagens manuais/copiadas
gravam `iso` em UTC, enquanto a data/hora exibida (`date`/`time`) está no fuso BR. Misturar as
duas referências embaralha a ordem visível — a mensagem "certa" pelo `iso` UTC não bate com o
horário que o corretor lê na tela.

## Correção
- Nova função `cp704MsgTsCronologico(m)`: deriva um timestamp comparável a partir da data/hora
  EXIBIDA (`date` dd/mm/aaaa + `time` hh:mm no padrão BR). Sem date/time válidos, cai no `iso`.
- `cp704TimelineHtml` passa a ordenar o array `all` por `cp704MsgTsCronologico` (desempate por
  `order`) ANTES de fatiar/renderizar. Assim a linha do tempo segue exatamente o horário que
  aparece em cada mensagem.

## Verificação
- Teste de unidade extrai `cp704MsgTsCronologico` e confirma que 11:56 < 11:58 < 12:24 mesmo
  fora de ordem, que o fallback para `iso` funciona, e que `cp704TimelineHtml` chama o sort.
- O dono confirma no app abrindo um lead cuja timeline estava fora de ordem (ex. Maurício Knop).

## Arquivos
- `app.js` — `cp704MsgTsCronologico` (nova) + `cp704TimelineHtml` (ordena pela hora exibida).
- `tests/v901-timeline-ordem-cronologica.test.mjs` (novo).
- `package.json` — versão 900 → 901.
