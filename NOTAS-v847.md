# v847 — primeira fatia da modularização de `app.js`: infraestrutura (`js/state.js` + `js/dom.js`)

## Contexto

Início do trabalho pra resolver a dívida técnica "`app.js` monolítico com sinais claros
de acúmulo" (13.498 linhas, dezenas de `DOMContentLoaded` competindo no boot). Decisão
tomada com o usuário: quebrar em módulos ES reais, em fatias pequenas e testáveis, nunca
numa reescrita de uma vez. Este é o plano completo, com o roteiro das próximas fatias:
`/root/.claude/plans/cozy-forging-flame.md`.

## O que mudou

- `index.html`: `<script src="/app.js?v=__VERSION__">` agora é
  `<script type="module" src="/app.js?v=__VERSION__">`.
- Novo `js/state.js`: `export const state = {...}` — movido literalmente de `app.js` (era
  uma constante de topo, nunca reatribuída, só mutada).
- Novo `js/dom.js`: `export function qs/qsa/isDesktop/escapeHtml/safeJson/toast` — bloco
  contíguo de helpers de DOM movido literalmente de `app.js`.
- `app.js` importa os dois módulos no topo do arquivo.
- `build.js`: os dois arquivos novos entram na lista `files`/`textFiles`; o loop de cópia
  agora cria o diretório de destino antes de escrever (`fs.mkdirSync(..., {recursive:true})`),
  necessário porque `js/` é o primeiro subdiretório publicado além de `vendor/`.
- `service-worker.js`: os dois arquivos novos entram em `CORE_ASSETS`, porque `app.js`
  depende deles incondicionalmente no boot — sem isso, um corretor abrindo o PWA instalado
  totalmente offline (sem nenhuma visita online anterior) teria o boot quebrado por falta
  de um chunk.
- `package.json`: `node --check js/state.js` e `node --check js/dom.js` somados à cadeia
  do script `test`.

## Achado importante: duas funções dependiam de comportamento implícito de script clássico

Ao converter `app.js` pra módulo, funções `function nome(){}` de topo **deixam de virar
automaticamente `window.nome`** (era assim que funcionava até aqui, por acidente da spec
de script clássico — nunca foi um `window.X = X` explícito). Isso não afeta a maioria do
código porque **285 pontos do arquivo já faziam essa exportação manualmente** (padrão
usado o arquivo inteiro para tornar funções acessíveis a atributos `onclick` inline e a
código fora de blocos IIFE). Mas duas funções passavam batido — sempre foram implicitamente
globais e nunca tiveram o `window.X = X` próprio:

- `show` (o roteador de telas) — usado direto em ~15 atributos `onclick="show(...)"` no
  `index.html` e em templates de `app.js`.
- `refreshAllSections`.

O sintoma real, descoberto só com teste em navegador de verdade (não pelos ~40 testes
textuais, que não executam o app): várias seções do fim do arquivo (`cp687`, `cp694`,
`cp697`, "Atualização #709"...) fazem um padrão de "decorador encadeado" —
`const oldShow = window.show; if(typeof oldShow === 'function'){ window.show = function(){
...oldShow.apply...}; }` — pra empilhar comportamento extra (animação de troca de tela,
atualização da carteira ao navegar, etc.) em cima da função original. Como cada elo da
cadeia depende do anterior já ter definido `window.show`, e o elo inicial (a função `show`
em si) nunca tinha essa exportação, a cadeia INTEIRA falhava silenciosamente — sem
lançar erro nenhum (os `if(typeof...)` guardam exatamente pra não quebrar nada visivelmente),
mas **nenhum dos decoradores era aplicado** e `window.show` ficava `undefined` pra sempre,
quebrando todo `onclick="show(...)"` inline.

Outras 6 funções sujeitas ao mesmo padrão de decorador (`cpPerformanceResumo`,
`setCarteiraFiltro`, `abrirVenda`, `marcarPerdido`, `arquivarLead`, `renderCarteiraTabela`,
`carregarDashboard`) já tinham exportação própria (ou, no caso de `carregarDashboard`, um
fallback defensivo pro valor lexical) e continuam funcionando sem qualquer mudança.

**Correção — estritamente aditiva, mesmo padrão já usado 285 vezes no projeto:**
`window.show = show;` logo após a definição de `show` (`app.js`), e
`window.refreshAllSections = refreshAllSections;` logo após a definição de
`refreshAllSections`. Restaura exatamente o comportamento implícito que o script clássico
já dava de graça — não é uma mudança de comportamento visível, é a correção do que a
conversão pra módulo teria quebrado silenciosamente.

## O que NÃO foi mudado (para não corrigir algo fora do escopo)

Existem 5 usos de `window.state?.algumaCoisa` no arquivo (zona de patches, linhas
~12300–13172). Não existe, em nenhum lugar do código, uma linha `window.state = state` —
ou seja, esses acessos **sempre avaliaram `undefined`** mesmo antes desta mudança (eram
código morto que caía no fallback ao lado). Migrar `state` pra `js/state.js` como
`export const state` preserva esse comportamento exatamente, porque `import` também não
cria propriedade em `window`. Verifiquei isso em navegador real após a mudança
(`typeof window.state === "undefined"`, igual a antes) e **não adicionei
`window.state = state`** — seria consertar um bug que não foi pedido nesta fatia.

## Validação

- `npm test`: suíte completa (38 conjuntos + `node --check` de todos os arquivos,
  incluindo os 2 novos) sem erro.
- `node build.js`: build limpo, 13 arquivos publicados, versão 847 confirmada nos
  arquivos (`index.html`, `app.js`, `service-worker.js`, `manifest.json`).
- Smoke test manual em Chromium real (servindo `public/` estaticamente): boot da tela
  Hoje sem erro, navegação por Condução/Inteligência Comercial/Agenda/Propostas/Carteira/
  Desempenho/Vendas/Arquivados, preenchimento de campo + botão "+ Aporte" na tela de
  Propostas refletindo no papel da proposta, Service Worker registrando e ficando `active`.
  Zero erro de módulo (`Failed to resolve module specifier`, `Uncaught SyntaxError`) e
  zero exceção não tratada — os únicos itens em `console --errors` são chamadas
  `/api/*` 404 esperadas (não há backend rodando neste smoke test estático).
- Confirmado em navegador: `typeof window.show === "function"` e
  `typeof window.state === "undefined"` (preservado de propósito, ver acima).

## Próximo passo

Fatia 2 (v848): extrair `js/proposta.js` (bloco "Gerador de proposta", ~283 linhas) como
piloto de extração de feature — a fronteira real dessa seção já foi confirmada por leitura
direta (não é a mesma que o próximo banner de comentário sugere). Roteiro completo das
fatias seguintes documentado no plano em `/root/.claude/plans/cozy-forging-flame.md`.
