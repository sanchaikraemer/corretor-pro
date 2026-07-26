# v991 — corrige texto minúsculo no celular (cadastro/login/painel)

## Contexto

O dono testou as páginas novas da v990 direto no celular e reportou que ficou tudo muito
pequeno — texto, campos e botão minúsculos, com bastante espaço vazio ao redor.

## Causa

As três páginas (`cadastro.html`, `entrar.html`, `admin-plataforma.html`) foram publicadas
sem a meta tag de viewport. Sem ela, o navegador do celular trata a página como se fosse de
computador (largura de referência ~980px) e depois espreme a imagem inteira pra caber na
tela — dá exatamente esse efeito de "tudo pequeno e centralizado", confirmado no print
enviado pelo dono.

## O que mudou

Adicionada `<meta name="viewport" content="width=device-width, initial-scale=1">` nas três
páginas — mesma configuração que o `index.html` do app principal já usa.

## Testes

Novo `tests/v991-viewport-mobile-contas.test.mjs`: confirma que as três páginas têm a meta
tag. Também conferido visualmente com captura de tela simulando um celular real (viewport
mobile) antes e depois da correção — a diferença é grande, texto e campos em tamanho normal
depois do fix.

`npm test`: suíte inteira verde. `node build.js`: build limpo, 22 arquivos publicados.

## Arquivos

`cadastro.html`, `entrar.html`, `admin-plataforma.html` (adiciona meta viewport),
`tests/v991-viewport-mobile-contas.test.mjs` (novo), `package.json`/`package-lock.json`,
`NOTAS-v991.md`, versão **990 → 991**.
