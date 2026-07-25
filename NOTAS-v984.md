# v984 — "Mensagens copiadas" zerado + Desempenho por mês, não por semana

## Contexto

O dono mandou print da tela Desempenho dizendo "esses números estão errados". Depois de
esclarecer o que cada número significa, dois problemas reais apareceram:

1. Ele confirmou que copia "muitas, muitas" sugestões de mensagem — mas o card mostrava
   **Mensagens copiadas: 0**.
2. Ele disse que faz muito mais de 34 importações de conversa, e que revisar "por semana" não
   faz sentido pro jeito dele usar o app: quer olhar **um mês inteiro (dia 1 até hoje)**, não um
   recorte de 7 dias que muda todo santo dia.

## O que estava acontecendo

**Bug do "Mensagens copiadas" zerado:** o botão de copiar rápido do card "Prioridade agora" na
Home (`window.copiarMensagemLead`) registrava a cópia chamando `registrarAprendizado(evento,
estilo, detalhes)` — só que essa função sempre grava no lead que está **aberto na tela de
detalhe** (`state.lead?.id`), não no lead do card que foi clicado. Copiando direto da lista da
Home (sem abrir o cliente), não tem lead aberto — o evento nunca era salvo em lugar nenhum. Por
isso o contador ficava em 0 mesmo com uso real: a maioria das cópias do dono provavelmente
acontece por esse atalho rápido, não pelo botão de dentro do lead (que já funcionava certo).

**"Importações" parecendo baixo:** não era bug — era o recorte de "últimos 7 dias corridos"
sendo pequeno demais pro volume real de um mês inteiro de trabalho.

## Fix

- `app.js` — `window.copiarMensagemLead`: registra o evento `mensagem_copiada` direto via
  `fetch("./api/lead-update", ...)` usando o id do lead do card (`l.id`), sem depender do lead
  aberto.
- `app.js` — `cpDesempenhoMetricas`: nova função `cpInicioMesMs()` calcula o início do mês
  corrente no fuso de Brasília; a janela usada por mensagens trocadas, leads atendidos,
  mensagens copiadas, análises feitas e importações trocou de "últimos 7 dias corridos" pra
  "dia 1 do mês até hoje".
- `app.js` / `index.html`: textos da tela atualizados — "Sua semana no Corretor Pro" → "Seu mês
  no Corretor Pro", "Com clientes, esta semana" → "Com clientes, este mês", "Esta semana" →
  "Este mês" (Leads atendidos). "Tempo no app" não mudou (continua Hoje + média dos últimos 7
  dias — é medição de uso do aparelho, não do resultado com cliente).

## Verificação

- `npm test`: suíte inteira verde, incluindo `v929-desempenho-metricas-reais.test.mjs`
  (atualizado pra validar a janela mensal em vez de semanal) e o novo
  `v984-copiar-hero-registra-lead-certo.test.mjs` (cobre o registro do lead certo no botão de
  copiar do hero e a troca de janela).

## Arquivos

`app.js` (fix do bug de registro + janela mensal), `index.html` (título do card), `tests/
attendance-refresh.test.mjs` e `tests/v929-desempenho-metricas-reais.test.mjs` (ajustados pra
nova forma/janela), `tests/v984-copiar-hero-registra-lead-certo.test.mjs` (novo),
`package.json`/`package-lock.json`, `NOTAS-v984.md`, versão **983 → 984**.
