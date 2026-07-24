# v964 — mais 10 confirm() nativos viram modal do app + botão "Apagar tudo" nunca funcionou

## Contexto

Durante a revisão linha a linha de `app.js` (bloco 1, linhas 1–~3100 e leitura complementar dos
demais `confirm()` do arquivo), achei mais 10 usos do `confirm()` nativo do navegador — o mesmo
"fora de padrão" que o dono já tinha pedido pra trocar no botão Reativar (v903/sessão anterior).
E, rastreando esses call sites, um bug real e concreto: o botão "Apagar tudo" nunca funcionava.

## 1. Mais 10 confirm() nativos convertidos pro modal cp903Confirm

Mesmo padrão já usado no resto do app (`(typeof cp903Confirm === "function") ? await
cp903Confirm({...}) : confirm(msg)`), aplicado em:

`importarTelefonesCSV`, `apagarLead`, `excluirLeadDefinitivo`, `removerLembrete`,
`apagarItemAprendizado`, `limparAprendizadoTudo`, `zerarCerebroTudo`, `#btnDescartarUpload`,
`descartarLeadPendente`, `#wipeAll` (as duas confirmações em sequência).

Duas mensagens (`excluirLeadDefinitivo`, `zerarCerebroTudo`) tinham quebra de linha (`\n\n`) no
texto — o `confirm()` nativo respeita isso, mas o `<p>` do modal `cp903-modal` não (colapsava
tudo numa linha só). Adicionado `white-space:pre-line` em `.cp903-modal p` no `styles.css` pra
preservar a formatação original nesses casos, sem afetar as mensagens de uma linha só.

## 2. Bug real: botão "Apagar tudo" (Diagnóstico) sempre falhava

`#wipeAll` mandava `body: JSON.stringify({ confirmacao: "APAGAR TUDO" })` — mas
`api/limpar-tudo.js` (revisado nesta mesma noite, v959) exige literalmente `body.confirm ===
"APAGAR TUDO"` (chave em inglês, sem o "ação"). Como a chave nunca batia, TODA tentativa de usar
esse botão devolvia 400 "Confirmação inválida" — mesmo depois de passar pelas duas confirmações.
O botão nunca funcionou. Corrigido pra mandar a chave certa (`confirm`).

## 3. Achado (NÃO corrigido nesta versão) — cascata de código morto em abrirVenda/marcarPerdido/arquivarLead

Rastreando esses `confirm()`, encontrei o MESMO padrão do bug do `carregarGeladeira` (v952) —
só que bem maior. `window.abrirVenda`, `window.marcarPerdido` e `window.arquivarLead` são
reatribuídos VÁRIAS vezes ao longo do arquivo (cada "Atualização #NNN" reaproveitando o nome
dentro de uma IIFE nova). Como todo `onclick="...arquivarLead(...)"` do HTML resolve por
`window.*` no momento do clique, só a ÚLTIMA atribuição importa — as anteriores são código
100% morto (nunca rodam), incluindo as que ainda tinham `confirm()` nativo:

- `abrirVenda`: 4 gerações (linha 5287 confirm() nativo → 10905 v683/cp903Confirm →
  11190 abrirModalDesfecho → **11340 abrirModalDesfechoFinal, a que roda de verdade**).
- `marcarPerdido`: mesmas 4 gerações (5306→10910→11191→**11341**).
- `arquivarLead`: 2 gerações (8630 confirm() nativo → **10915 v683/cp903Confirm, a que roda**).
- `ui683MarcarEtapaRapida`: 2 gerações (10732 confirm() nativo → **10899, delega pra
  ui683MoverEtapaComEvento/cp903Confirm**).

A versão que roda de verdade (`abrirModalDesfechoFinal`) já é um modal próprio completo (pede
produto/valor/comissão na venda, motivo na perda) — melhor que um simples confirm(). Ou seja: **o
comportamento ao vivo já está correto**, o problema é só a poluição de código morto (arriscado
pra manutenção futura — é fácil editar a cópia errada sem perceber, como quase aconteceu aqui).
Confirmei que NENHUM lugar chama essas funções como identificador solto (só via
`onclick="...(...)"`, que sempre resolve por `window.*`), então apagar as gerações mortas seria
seguro — mas é uma limpeza maior (4 funções, ~200 linhas espalhadas, precisa confirmar que nada
mais referencia os nomes intermediários como `ui683MoverEtapaComEvento`/`abrirModalDesfecho`
antes de apagar) — fica registrado pra um ciclo dedicado a isso, não misturado com o resto da
revisão de hoje.

## Verificação

- `npm test` verde, incluindo `v964-confirmacoes-usam-modal-em-app` — confirma que as 8 funções
  nomeadas e os 2 handlers inline usam `cp903Confirm`, que `#wipeAll` manda a chave certa
  (`confirm`, não `confirmacao`), e que o CSS preserva quebra de linha.
- `node --check app.js` OK.

## Arquivos
- `app.js` (10 conversões de confirm() + fix da chave do #wipeAll), `styles.css`
  (`.cp903-modal p` — `white-space:pre-line`), `tests/v964-confirmacoes-usam-modal-em-app.test.mjs`
  (novo), `package.json`/`package-lock.json`, `NOTAS-v964.md`, versão **963 → 964**.
