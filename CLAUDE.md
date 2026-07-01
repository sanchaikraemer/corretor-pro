# Corretor Pro

## Como falar com o dono (obrigatório)

O dono é corretor de imóveis, não é técnico. Em toda resposta:

- Seja sucinto e direto.
- NÃO use linguagem técnica (nada de "branch", "PR", "commit", "try/catch" etc.).
- Faça o que precisa ser feito para a mudança ficar **funcionando no site e no app**
  para ele conferir — não pare no meio do caminho.
- No fim, diga sempre **qual o número da versão** que ele deve conferir no topo do app
  (ex.: "confere a versão 661").

## Regra obrigatória de versão

**SEMPRE incremente a versão ao subir uma atualização ou corrigir qualquer coisa
que afete o app publicado.**

A versão canônica é o maior `## Ponto #NNN` do `RESTORE_POINTS.md` — é dele que o
`build.js` tira o valor que substitui o placeholder `__VERSION__` em todos os
arquivos publicados (`index.html`, `app.js`, `service-worker.js`, `styles.css`,
`manifest.json`, `share.html`). Ou seja, na maioria dos arquivos você NÃO escreve
o número: deixa `__VERSION__` e o build resolve.

Ao subir de vNNN para v(NNN+1), altere manualmente só estes três pontos:

- `RESTORE_POINTS.md` → adicione um bloco novo `## Ponto #NNN — descrição` (é a
  fonte da verdade lida pelo `build.js`).
- `service-worker.js` → o nome do cache `const STATIC_CACHE = 'corretor-pro-static-vNNN-'`
  (esse é o único lugar com o número escrito à mão, e é o que força o PWA a atualizar).
- `package.json` → `"version": "NNN.0.0"`.

Opcional, seguindo o padrão do repo: crie um `ALTERACOES_VNNN.md` descrevendo a mudança.

Trocar o número do cache no `service-worker.js` é o que força o navegador a instalar
o novo Service Worker e limpar o cache antigo do PWA. Se esse número não mudar, o
usuário continua vendo a versão antiga em cache.

Mudanças que NÃO tocam o app publicado (só testes, `CLAUDE.md`, docs) não precisam
de bump — o `build.js` nem copia esses arquivos para `public/`.

## Antes de subir

- Rode `npm test` — precisa passar. O script faz `node --check` em `app.js`,
  `build.js`, `service-worker.js` e nos `api/*.js`, depois roda `teste-ui.mjs`,
  `teste-restauracao-leads.mjs` e os testes de performance.
  - `teste-ui.mjs` é **independente de versão**: ele descobre a versão pelo
    `RESTORE_POINTS.md` e verifica que `service-worker.js` e `package.json` estão
    batendo. Se você esquecer de bumpar um dos dois, o teste quebra na hora.
- Faça commit com `user.email = noreply@anthropic.com` (senão o GitHub marca como Unverified).
- Push para `main` e para a branch de trabalho.
