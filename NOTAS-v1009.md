# v1009 — "Sair da conta" também na tela Menu ("Mais")

## Contexto

O dono perguntou como fazer logoff e mandou o print da tela Menu (aba "Mais") — o lugar
natural de procurar. O botão "Sair da conta" (v1007) só existia no menu lateral (☰), e essa
tela Menu não tinha nada de conta.

## O que mudou

- `index.html`: a tela Menu ganhou um cartão **"Conta"** (acima da Zona perigosa) mostrando
  "Você está logado como [nome]" e o botão **Sair da conta** — mesmo comportamento do botão da
  lateral (encerra a sessão e volta pra tela de entrar). O cartão começa escondido e só aparece
  quando existe sessão de login; nos aparelhos que entram pela chave compartilhada (o app de
  hoje do dono), a tela Menu continua exatamente igual.
- `app.js`: ao detectar sessão, revela o cartão e preenche o nome logado nele.

## Testes

Novo `tests/v1009-sair-da-conta-na-tela-menu.test.mjs` (cartão escondido por padrão, nome
preenchido, mesmo cpSairDaConta, revelação só com sessão).

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`index.html`, `app.js`, `tests/v1009-sair-da-conta-na-tela-menu.test.mjs` (novo),
`package.json`/`package-lock.json`, `NOTAS-v1009.md`, versão **1008 → 1009**.
