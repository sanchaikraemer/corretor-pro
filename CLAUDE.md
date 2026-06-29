# Corretor Pro

## Regra obrigatória de versão

**SEMPRE incremente a versão ao subir uma atualização ou corrigir qualquer coisa.**

A versão fica em arquivos espelhados — ao mudar, atualize TODOS de uma vez:

- `version.js` → `app: "vNNN"` e `package: "0.NN.0"` (fonte única de verdade)
- `package.json` → `"version": "0.NN.0"`
- `index.html` → versão no `<span id="header-version">` e todas as query strings `?v=NNN` (styles.css, version.js, zip.min.js, app.js)
- `app.js` → imports internos `./db.js?v=NNN` e `./whatsapp.js?v=NNN`, e o fallback `VERSION_INFO`
- `service-worker.js` → `importScripts("/version.js?v=NNN")`, fallback `VERSION_INFO`, e todas as query strings em `CORE_ASSETS`
- `server.js` → fallback `VERSION_INFO`
- `test-updates.mjs` → atualizar os testes que verificam a versão (`app: "vNNN"`, `header-version`, query strings, `pkg.version`)

Trocar a versão do `service-worker.js` é o que força o navegador a instalar o novo
Service Worker e limpar o cache antigo do PWA. Se a versão não mudar nesse arquivo,
o usuário continua vendo a versão antiga em cache.

## Antes de subir

- Rode `node --test test-*.mjs` — todos os 53 testes devem passar.
- Faça commit com `user.email = noreply@anthropic.com` (senão o GitHub marca como Unverified).
- Push para `main` e para a branch de trabalho.
