# v977 — gradiente da barra vira branco → coral

## O pedido do dono

Depois da v976 (barra mais comprida), o dono pediu pra comparar cores de gradiente: "quero
gradiente azul claro ate o coral, e branco e coral tb, quero ver qual harmoniza melhor". Foi
enviada uma imagem (screenshot renderizado, não um link) com 3 opções lado a lado: a coral→coral-
claro que já estava no ar (v973), azul-claro (`#56C7F2`, o cyan que o app já usa em outros
lugares) → coral, e branco (`#F7FAFB`, o mesmo tom do texto do app) → coral. O dono escolheu
branco → coral.

## O que mudou

`cpBarraMensagensMini`: o início do gradiente deixa de ser `corClara` (um tom mais claro do MESMO
nível — v973) e vira um branco FIXO (`#F7FAFB`), igual pros 3 níveis. O fim do gradiente continua
sendo `cor` (a cor do nível, sem mudança). `corClara` foi removida do código (não é mais usada em
lugar nenhum).

| nível | início (fixo) | fim (cor do nível, sem mudança) |
|---|---|---|
| alto (≥15 msgs) | `#F7FAFB` | `#ff6258` |
| médio (5-14 msgs) | `#F7FAFB` | `#ff8f88` |
| baixo (<5 msgs) | `#F7FAFB` | `#8a99a0` |

Os limiares que definem qual `cor` cada lead usa (`n>=15`/`n>=5`/senão) **não mudaram** — seguem
travados pelos testes v942/v943.

## Testes atualizados

- `tests/v973-barra-gradiente.test.mjs`: os itens que checavam a fórmula antiga do gradiente
  (`cor 40%, corClara`, valores por nível) foram atualizados/simplificados — a fórmula em si
  agora é coberta pelo teste novo; ficou só a checagem de que a barra usa gradiente (genérico) e
  a proporção/largura (que não mudou).
- `tests/v977-gradiente-branco-coral.test.mjs` (novo): confirma que `corClara` foi removida,
  que o branco é fixo (`#F7FAFB`) e igual nos 3 níveis, e testa os 3 gradientes reais gerados.

## Verificação

- Suíte inteira verde (`npm test`).

## Arquivos

- `app.js` (`cpBarraMensagensMini` — `BRANCO_GRADIENTE` fixo no lugar de `corClara`),
  `tests/v973-barra-gradiente.test.mjs` (atualizado), `tests/v977-gradiente-branco-coral.test.mjs`
  (novo), `package.json`/`package-lock.json`, `NOTAS-v977.md`, versão **976 → 977**.
