# v849 — terceira fatia: `js/pwa-install.js`

## Contexto

Terceira fatia do plano de modularização de `app.js`
(`/root/.claude/plans/cozy-forging-flame.md`), seguindo o roteiro documentado em
NOTAS-v848.md: depois da infraestrutura (v847) e do piloto de proposta (v848), esta fatia
extrai o bloco "Instalar app (PWA)".

## O que mudou

- Novo `js/pwa-install.js`: bloco "===== Instalar app (PWA) =====" movido de `app.js`
  (~80 linhas). **Achado igual ao da v848** (a fronteira do banner de comentário não bate
  com o conteúdo real): o mesmo bloco também continha as duas funções de onboarding
  (`fecharOnboarding`/`abrirOnboarding`), fisicamente coladas ali mesmo não sendo sobre
  instalação de PWA. Como as duas são pequenas (14 linhas) e não têm nenhuma dependência
  cruzada com o resto do bloco, foram junto pro mesmo módulo — documentado no próprio
  arquivo (comentário) e neste NOTAS, em vez de forçar uma separação que o código
  original nunca teve.
- `app.js`: bloco removido, substituído por `import './js/pwa-install.js?v=__VERSION__';`.
- `build.js`, `service-worker.js`, `package.json`: mesmo tratamento das fatias anteriores.
- Novo teste `tests/js-pwa-install-module.test.mjs`.

## Dependências do módulo

- `qs`, `toast` → import de `./dom.js`.
- `state` → import de `./state.js` (usado só em `abrirOnboarding`).
- `window.show("home")` → `abrirOnboarding` chamava `show(...)` sem prefixo; trocado pra
  `window.show(...)` (mesma correção de padrão já feita na v847/v848 — `show` continua
  definido em `app.js`, com export explícito desde a v847).
- `window.__deferredInstallPrompt` já era acessado via `window.` explicitamente no
  código original (setado por um script inline no `<head>` do `index.html`, que roda
  antes de qualquer módulo) — sem mudança necessária.
- Nenhuma das 4 funções de instalação (`mostrarOpcoesInstalar`, `esconderOpcoesInstalar`,
  `dispararInstalacao`, `fecharOnboarding`) tem chamador fora deste bloco — confirmado
  por grep no arquivo inteiro — então não precisam de `window.X`. Só `abrirOnboarding`
  mantém `window.abrirOnboarding = abrirOnboarding;`, porque é chamada por
  `onclick="abrirOnboarding()"` no menu (`index.html:626`).

## Verificação

- `npm test`: suíte completa (41 conjuntos) sem erro.
- `node build.js`: build limpo, 15 arquivos publicados, versão 849.
- Smoke test em Chromium real: abriu o Menu, clicou no botão real de onboarding
  (`onclick="abrirOnboarding()"` do próprio HTML, não uma chamada direta via console),
  confirmou `window.abrirOnboarding`/`window.show` como funções e
  `window.__deferredInstallPrompt` presente (null, como esperado sem o evento real do
  navegador). Navegação por Hoje/Condução/Atendimentos/Agenda/Inteligência Comercial sem
  erro de módulo nem exceção — só o `/api/*` 404 esperado (sem backend no smoke test).

## Próximo passo

Continuar pelo roteiro do NOTAS-v848.md: `js/memoria-lead.js` + `js/vendas-registradas.js`
(redescobrindo a fronteira real, como nas duas últimas fatias — não confiar no próximo
banner de comentário).
