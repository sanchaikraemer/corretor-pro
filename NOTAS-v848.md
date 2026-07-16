# v848 — extração piloto: `js/proposta.js`

## Contexto

Segunda fatia do plano de modularização de `app.js`
(`/root/.claude/plans/cozy-forging-flame.md`), depois da infraestrutura da v847
(`js/state.js` + `js/dom.js` + conversão pra `<script type="module">`). Esta fatia extrai
uma seção de feature completa como piloto do processo, antes de repetir o padrão nas
seções maiores do roteiro.

## O que mudou

- Novo `js/proposta.js`: o bloco "Gerador de proposta" inteiro (283 linhas) movido de
  `app.js`. A fronteira real foi confirmada por leitura direta linha a linha — o banner de
  comentário seguinte ("ATUALIZAÇÃO #631") não é um limite de seção nova, é só o próximo
  bloco de código colado ali sem atualizar o comentário; a extração parou exatamente onde
  o código de proposta termina de fato.
- `app.js`: bloco removido, substituído por `import './js/proposta.js?v=__VERSION__';` no
  topo do arquivo (junto dos imports de `state`/`dom` da v847).
- `build.js`, `service-worker.js`, `package.json`: mesmo tratamento da v847 —
  `js/proposta.js` somado às listas de arquivos publicados, `CORE_ASSETS` e
  `node --check`.
- Novo teste `tests/js-proposta-module.test.mjs`: confirma que o bloco saiu de `app.js`,
  que `js/proposta.js` importa `dom.js`/`state.js` e que toda chamada pra função que
  continua em `app.js` passa pela ponte `window.X` (não por referência nua) — é
  exatamente o tipo de regressão silenciosa que a v847 encontrou com `window.show`.

## Dependências do módulo (mapeadas por leitura direta, uma por uma)

- `qs`, `qsa`, `escapeHtml`, `toast` → import de `./dom.js`.
- `state` → import de `./state.js` (nunca reatribuído, só mutado — import simples
  preserva identidade do objeto).
- `show(...)`, `abrirLead(...)`, `invalidarLeadsCache(...)` — chamadas trocadas de
  referência nua pra `window.show(...)`/`window.abrirLead(...)`/
  `window.invalidarLeadsCache(...)`. As três já tinham exportação própria em `app.js`
  (nenhuma mudança lá).
- `payloadComCerebro(...)` — mesma troca pra `window.payloadComCerebro(...)`. Esta função
  **não tinha** exportação própria (achado da v847 não pegou porque `show` e
  `refreshAllSections` eram os únicos com o padrão de decorador quebrado; este caso é mais
  simples — só não tinha export nenhum ainda). Adicionada
  `window.payloadComCerebro = payloadComCerebro;` logo após a definição da função em
  `app.js` — mesmo padrão já usado 285+ vezes no projeto, estritamente aditivo.

## Verificação

- `npm test`: suíte completa (39 conjuntos, incluindo o novo `js-proposta-module`) sem
  erro.
- `node build.js`: build limpo, 14 arquivos publicados, versão 848.
- Smoke test em Chromium real (servindo `public/` estaticamente):
  - `window.abrirPropostaComLead(...)` chamado como se viesse de fora do módulo (é assim
    que a seção "Atender em sequência" de `app.js` realmente chama) — abriu a tela de
    Propostas, preencheu nome/empreendimento.
  - Preenchimento de campo (`#pf-apto`) e clique no botão inline `onclick="propAddAporte()"`
    — refletiu corretamente no papel da proposta (`#pp-cliente`, `#pp-empreendimento`,
    linha de aporte renderizada).
  - Botão "‹ Voltar pro lead (...)" mostrou o nome certo (`atualizarVoltarProposta` lendo
    `state.propLeadNome`) e, ao clicar, disparou `window.abrirLead(...)` sem erro.
  - Zero erro de módulo, zero exceção não tratada; único item em console são os mesmos
    `/api/*` 404 esperados (sem backend neste smoke test estático).

## Roteiro (sem mudança desde a v847)

Próximas fatias documentadas em `/root/.claude/plans/cozy-forging-flame.md`:
`js/pwa-install.js` → `js/memoria-lead.js`+`js/vendas-registradas.js` →
`js/relatorio-funil.js` → `js/importar-csv.js` → `js/carteira.js` → consolidar
`js/core.js` (`show`/`abrirLead`/`invalidarLeadsCache`/`payloadComCerebro`/fetch wrapper)
→ zona de band-aids (sessão própria) → Share Target por último.

**Recomendação pra próxima sessão, baseada no que a v847 e a v848 mostraram:** antes de
mover qualquer seção nova, repetir a auditoria de "decorador encadeado" feita na v847
(`grep` por `const old[A-Za-z]* = window\.` e `try\{\s*[A-Za-z]+\s*=\s*window\.`) — é um
padrão usado o arquivo inteiro, não só em `show`/`refreshAllSections`, e só aparece como
bug real testando em navegador (nenhum dos ~40 testes textuais executa o app de verdade).
