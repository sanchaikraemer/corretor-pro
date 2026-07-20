# v890 — card "Prioridade agora" (hero da Home): texto completo + sem botões redundantes

## 1. "POR QUE ATENDER" não corta mais o texto
O resumo da IA aparecia cortado com "..." (85 caracteres) — ex.: "Wilson analisou os
materiais do Evolutti e Premium Office, mas informou que fez dois...". O dono quer ver tudo.
`motivoPrioridade` (usado só no hero) passa a empurrar o **resumo inteiro**, sem `_cortarFrase`.

## 2. Botões "Ver histórico" e "✓ Já falei" removidos do card
Pra tomar ação o corretor abre o lead de qualquer jeito — o card inteiro já é clicável e abre
o lead. Os dois botões viravam ruído. Removida a barra `.h-acts` do hero.

## Arquivos
- `app.js` — `motivoPrioridade` (resumo inteiro) e `renderHeroLead` (sem `.h-acts`).
- `tests/v890-hero-texto-completo.test.mjs` (novo); `tests/v866-hero-acoes.test.mjs` atualizado
  (os botões que antes eram exigidos agora não podem existir).
- `package.json` — versão 889 → 890.
