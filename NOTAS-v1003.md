# v1003 — conta bloqueada ou com teste vencido trava no servidor, não só na tela de login

## Contexto

A trava de "seu teste grátis acabou / conta bloqueada" existia só em `entrar.html` — uma
checagem de cortesia na tela: qualquer chamada direta à API com um token de login válido passava
por cima dela. Pro modelo de negócio funcionar (7 dias grátis → pagamento → liberação pelo painel
administrativo), o corte precisa valer por dentro.

## O que mudou

`api/_persistence.js` (`resolveOrganizationId`): ao resolver de qual corretor é uma chamada com
login novo, o servidor agora também carrega o status da conta e recusa (403, com a mensagem de
pagamento) quando a conta está `bloqueado` ou quando está em `teste` com o prazo vencido. Contas
`ativo` (pagas) e testes dentro do prazo passam normalmente.

O caminho da chave compartilhada (o app de hoje, sem login novo) não muda — continua caindo na
conta original sem checagem de trial, que está `ativo` desde a migração 0003.

Efeito prático: quando você clicar em "Bloquear" (ou o teste de alguém vencer) no painel
administrativo, a pessoa perde acesso de verdade — todas as rotas da API passam a recusar as
chamadas dela, não só a tela de entrada.

## Testes

Novo `tests/v1003-conta-bloqueada-trava-no-servidor.test.mjs`: bloqueado → 403; teste vencido →
403 com mensagem de pagamento; teste no prazo → passa; conta ativa (paga) com data de teste
antiga → passa. `tests/v997-resolve-organizacao.test.mjs` continua verde sem mudanças.

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`api/_persistence.js`, `tests/v1003-conta-bloqueada-trava-no-servidor.test.mjs` (novo),
`package.json`/`package-lock.json`, `NOTAS-v1003.md`, versão **1002 → 1003**.
