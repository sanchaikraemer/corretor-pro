# v892 — "Desmarcar": link mais discreto

Ajuste fino do v891: o link "Desmarcar atendimento de hoje" não ocupa mais a linha inteira no
mobile (o dono achou destaque demais). Agora fica discreto, alinhado à esquerda, na largura do
próprio texto (`.cp704-desmarcar{justify-self:start;width:auto}`).

## Arquivos
- `app.js` — CSS mobile do `.cp704-desmarcar`.
- `tests/v891-desmarcar-layout-robusto.test.mjs` — atualizado.
- `package.json` — versão 891 → 892.
