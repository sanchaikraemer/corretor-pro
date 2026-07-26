# v993 — corrige cache preso nas páginas novas + botão de login não trava mais

## Contexto

O dono publicou v991 e v992 e continuava vendo a versão antiga (texto pequeno, sem ícone de
olho), mesmo depois de esperar e recarregar. Também reportou que a tela de login ficava presa
escrito "Entrando..." depois de logar com sucesso.

## Causa 1 — cache preso

`cadastro.html`, `entrar.html` e `admin-plataforma.html` carregam `contas-estilo.css`,
`contas-config.js` e `vendor/supabase.js` **sem** `?v=__VERSION__` na URL — diferente de
`index.html`, que sempre versiona esses caminhos. O service worker do PWA (`staleWhileRevalidate`)
serve arquivos estáticos direto do cache do aparelho e só busca versão nova quando a URL muda;
sem o `?v=`, a URL nunca muda entre publicações, então o celular ficava preso pra sempre na
primeira versão desses 3 arquivos que baixou. Além disso, essas 3 páginas não tinham entrada
própria no `vercel.json`, então também podiam ficar em cache HTTP comum (só `/` e `/index.html`
tinham a regra de "nunca cachear").

## Causa 2 — botão preso em "Entrando..."

`entrar.html` desabilitava o botão e escrevia "Entrando..." antes de chamar o Supabase, mas só
reabilitava o botão nos caminhos de erro — no caminho de sucesso, como ainda não existe
redirecionamento pra tela principal (etapa seguinte, feita à parte), o botão nunca voltava,
parecendo travado mesmo com o login já confirmado (a mensagem verde aparecia embaixo, mas o
botão dava a impressão de que nada tinha acontecido).

## O que mudou

- `cadastro.html`, `entrar.html`, `admin-plataforma.html`: os 3 arquivos passam a referenciar
  `contas-estilo.css?v=__VERSION__`, `vendor/supabase.js?v=__VERSION__` e
  `contas-config.js?v=__VERSION__` — build.js já substitui `__VERSION__` pelo número real.
- `vercel.json`: adiciona `Cache-Control: no-cache, no-store, must-revalidate` pras 3 páginas,
  igual já existia pra `/` e `/index.html`.
- `entrar.html`: no caminho de sucesso, reabilita o botão e troca o texto pra
  "Login confirmado ✓", deixando claro que terminou (mesmo sem redirecionamento ainda).

## Testes

Novo `tests/v993-cache-busting-contas.test.mjs`: confirma que as 3 páginas versionam os 3
arquivos estáticos, e que o `vercel.json` tem regra de `no-store` pra cada uma.
`tests/v990-cadastro-login-admin-publicados.test.mjs` ajustado (o regex antigo não aceitava o
`?v=` novo).

`npm test`: suíte inteira verde. `node build.js`: build limpo, `__VERSION__` substituído
corretamente por `993` nos 3 arquivos (conferido no `public/` gerado).

## Confirmação em produção

O dono testou o fluxo completo até aqui: cadastro de uma empresa nova ("Senger") com e-mail
`+teste`, confirmação de e-mail desligada nas configurações do Supabase, login reconhecendo os
7 dias de teste, e o painel administrativo mostrando as duas empresas (a de teste e a "Empresa
1") com dados corretos e os botões de ação. Prova de ponta a ponta que a base toda funciona.

## Arquivos

`cadastro.html`, `entrar.html`, `admin-plataforma.html` (versiona os 3 assets; `entrar.html`
também corrige o botão preso), `vercel.json` (headers de no-cache pras 3 páginas),
`tests/v993-cache-busting-contas.test.mjs` (novo), `tests/v990-cadastro-login-admin-publicados.test.mjs`
(regex ajustado), `package.json`/`package-lock.json`, `NOTAS-v993.md`, versão **992 → 993**.
