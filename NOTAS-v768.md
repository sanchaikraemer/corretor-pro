# v768 — Período dos áudios na importação vira botão, não mais digitar

## O problema

Ao importar o ZIP de uma conversa, o app abria o `prompt()` nativo do navegador pedindo pra digitar "30", "60", "90" ou "todo" pra escolher o período dos áudios a transcrever. Ruim de usar toda vez.

## O que foi corrigido

- `escolherPeriodoAudiosImportacao()` agora abre um modal com 4 botões (30 dias / 60 dias / 90 dias / Todo o período) em vez do prompt de digitar. A última opção escolhida continua salva e vem pré-marcada da próxima vez.
- Mesmo comportamento de antes por trás: só muda a forma de escolher, o resto do fluxo de importação (mensagens escritas sempre completas, áudios limitados ao período) é o mesmo.

## Testes

- `npm test` e `npm run build` passaram.
