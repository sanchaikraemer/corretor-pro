# v891 — "Desmarcar atendimento": layout + robustez

## Problemas (print do dono, #889)
1. **Layout ruim**: o botão "Desmarcar" virou um 5º pill grande no grid 2x2 do cabeçalho
   (mobile), ficando torto/sobrando.
2. **Não desmarcava**: erro "signal is aborted without reason" — o `fetchComTimeout` abortava
   em 15s (provável cold start da função serverless de reanálise), sem desfazer.

## Correções
### Layout
"Desmarcar" virou um **link discreto** (`.cp704-desmarcar`, sublinhado, muted) em vez de um
botão-pill. No mobile ocupa a linha inteira (`grid-column:1/-1`) centralizada, embaixo do
grid 2x2 dos botões principais — não desalinha mais.

### Robustez do desmarcar
- **Otimista**: desmarca na tela na hora (não faz o corretor esperar a rede).
- **Timeout generoso** (30s) pra sobreviver a cold start do serverless.
- **Reverte** a tela se a API falhar, com mensagem amigável ("tente de novo").

O handler de API `desmarcar-atendido` (v888) já estava correto; o novo deploy garante que
está no ar. Se o erro persistir após atualizar (Ctrl+Shift+R), investigar o cold start/rota.

## Arquivos
- `app.js` — markup do botão + CSS `.cp704-desmarcar` (base e mobile) + `ui667DesmarcarAtendido`
  otimista/robusto.
- `tests/v891-desmarcar-layout-robusto.test.mjs` (novo); `tests/v888-desmarcar-atendimento.test.mjs`
  atualizado (nova classe do botão).
- `package.json` — versão 890 → 891.
