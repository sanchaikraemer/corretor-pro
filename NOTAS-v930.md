# v930 — lembrete não nasce mais de áudio transcrito

## O bug (2 prints do dono)

Dois "Lembretes" sem nexo nenhum apareceram na Agenda:
- **Adao Prates**: "Lembrete de hoje" com o texto "[Áudio transcrito] Eu acabei não explicando,
  só botei ali para tu não esquecer. Entrou no apartamento, já mete um Alexa, temos visita.
  Cara, ela liga tudo, abre" — o dono: "não lembro de ter agendado isso".
- **Rafael Branda**: "Lembrete venceu... está arquivado" com "[Áudio transcrito] Não, é bem isso
  aí cara, por isso que eu te falo, não, e eu venho visitando e atendendo com o FIB cara, acho
  que faz um ano, já rodou uns 4," — nem de longe parece um compromisso agendado.

## Causa raiz

A extração de lembrete (`lembreteDaTimeline`, em `api/reanalisar-lead.js`) já seguia uma regra
rígida desde a v826: só vira lembrete se o texto tiver uma palavra de comando
("agende/marque/lembre/remarque/reagende") **junto com** uma data/dia — nunca inventado pela IA.
Só que essa regra rodava igual em cima de **qualquer** texto da timeline, sem diferenciar
mensagem digitada de **áudio transcrito**. Áudio é um registro bem mais solto e narrado —
inclusive o corretor às vezes grava uma nota pra si mesmo ("só botei ali pra tu não esquecer") —
então uma combinação de palavra+data que aparece no meio de uma frase solta virava um "lembrete"
sem nenhum compromisso real por trás.

## O que mudou

- `lembreteDaTimeline` agora **ignora mensagens que começam com "[Áudio transcrito"`** ao procurar
  o gatilho de lembrete — só mensagem digitada (do corretor ou do cliente) conta daqui pra
  frente. Se não sobrar nenhuma mensagem digitada com comando+data, o lead simplesmente não tem
  lembrete (em vez de pegar um trecho solto de áudio).
- **Limpeza retroativa**: um lembrete já salvo cujo `motivo` começa com "[Áudio transcrito"
  (como os dois dos prints) agora é descartado na próxima reanálise — a mesma lógica que já
  descartava lembretes legados `auto:true` passa a descartar também os "de áudio". Ou seja, os
  dois casos relatados se corrigem sozinhos assim que o lead reanalisar de novo (não precisa
  clicar em "Excluir" manualmente, embora isso continue funcionando se quiser adiantar).

## Verificação

- `tests/v930-lembrete-ignora-audio.test.mjs` (novo): confirma que um áudio com comando+data
  (o mesmo padrão que geraria lembrete em texto) é ignorado; que, com um áudio recente E um texto
  digitado mais antigo válido, o lembrete vem do texto (prova que a função não parou de
  funcionar, só ignora áudio especificamente); e que `aplicarLembrete` descarta a preservação de
  um lembrete legado cujo motivo veio de áudio.
- Suíte inteira verde (`npm test`); `node --check` em todos os arquivos de API e `node build.js`
  OK.

## Arquivos
- `api/reanalisar-lead.js` (`lembreteDaTimeline` ignora áudio; `aplicarLembrete` descarta
  lembrete legado de áudio na preservação), `tests/v930-lembrete-ignora-audio.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v930.md`, versão **929 → 930**.
