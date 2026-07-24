# v969 — lembrete fantasma: radical "lembr" pegava "lembrando"/"não lembro"

## Contexto

Reportado ao vivo pelo dono com 2 prints da tela Agenda: dois leads (nenhum dos dois ele
realmente agendou) apareciam com "Lembrete de hoje" / "Lembrete venceu", cada um com o texto de
uma mensagem real da conversa — nenhuma delas era um pedido de agendamento.

## O problema

`lembreteDoTexto` (em `api/reanalisar-lead.js`) só cria lembrete quando o texto tem um COMANDO
explícito (`agend\w*|reagend\w*|marc\w*|remarc\w*|lembr\w*|relembr\w*`) + uma data. O radical
`lembr\w*` é grande demais em português: casa com "lembrar"/"lembrete" (comando de verdade), mas
TAMBÉM com "lembrando" (relato — "estava pensando em você", não um pedido) e "lembro"/"não
lembro" (o OPOSTO de um comando — a pessoa dizendo que esqueceu).

Os dois casos reais:
1. Uma **mensagem copiada** (sugestão da IA que o corretor mandou pro cliente) começava "Estava
   lembrando da nossa conversa sobre o Personalité..." — o radical "lembrando" bateu o comando, e
   a palavra "hoje" em outro ponto do texto virou a data. Mas mensagem copiada JÁ tinha uma
   proteção contra isso — só que ela cobria apenas o texto recém-submetido
   (`lembreteNovo`/`novoAtendimento`), não a varredura do histórico já salvo
   (`lembreteDaTimeline`), que reprocessa a timeline inteira em toda reanálise.
2. Uma **mensagem do cliente** falando de preços de imóveis dizia "...o teu eu não lembro o
   preço de lançamento" — "não lembro" é o cliente dizendo que ESQUECEU, o oposto de estar pedindo
   um lembrete, mas o radical "lembr" bateu do mesmo jeito.

## O que mudou

- `lembreteDoTexto`: antes de checar o comando, remove do texto (numa cópia — a extração de data
  continua usando o texto original) as formas "não/nunca/num lembr...", "lembrando" e
  "lembrança/lembranças". Comando de verdade ("lembra de mim sábado", "lembrete: ligar amanhã")
  não usa nenhuma dessas formas, então continua funcionando igual.
- `lembreteDaTimeline`: passa a pular entradas `type === "mensagem_enviada"` (mensagem copiada/
  sugestão da IA) na varredura do histórico — a MESMA proteção que já existia pro texto recém-
  submetido, só que faltando aqui.

## O que NÃO faz

Não apaga os 2 lembretes fantasma já criados nesses leads especificamente (não tenho acesso ao
banco de produção pra identificar quais registros são esses, e uma limpeza automática por
heurística arriscaria apagar lembrete legítimo que por coincidência bata o mesmo padrão). O dono
pode excluir os dois manualmente pelo botão "Excluir" que já aparece no card (visível no print).
A partir desta correção, novos lembretes fantasma desse tipo não devem mais ser criados.

## Verificação

- `npm test` verde, incluindo o teste novo.
- Novo teste `tests/v969-lembrete-fantasma-radical-lembr.test.mjs`: reproduz os 2 casos reais
  (mensagem copiada com "lembrando", mensagem de cliente com "não lembro") e confirma que nenhum
  vira lembrete; confirma que "lembrança" (substantivo) também não vira; confirma que comandos de
  verdade (lembra de mim / lembrete: / marcar) continuam funcionando; confirma que
  `lembreteDaTimeline` ignora `mensagem_enviada` mas continua lendo anotação real do corretor.
- Teste antigo `tests/v930-lembrete-ignora-audio.test.mjs` (áudio transcrito não gera lembrete)
  continua verde — extração via recorte de texto do arquivo-fonte não foi afetada pelas mudanças.
- `node --check api/reanalisar-lead.js` OK.

## Arquivos
- `api/reanalisar-lead.js` (`lembreteDoTexto`, `lembreteDaTimeline`),
  `tests/v969-lembrete-fantasma-radical-lembr.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v969.md`, versão **968 → 969**.
