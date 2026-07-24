# v966 — guarda de "API duplicada na raiz" em build.js cobria só 5 de 12 arquivos

## Contexto

Continuação da revisão linha a linha, agora em `build.js`. O arquivo tem uma proteção
estrutural documentada no próprio comentário: se algum arquivo de `api/` for duplicado na raiz
do projeto, o build deve falhar — porque o Vercel publica o front a partir da raiz/`public/` mas
as funções serverless reais rodam a partir de `api/`, e uma duplicata na raiz faz o front
"vazar" código que não é o que está realmente rodando no backend.

## O problema

A lista de nomes protegidos estava cravada no código:

```js
const apiDuplicadosNaRaiz = [
  "_persistence.js", "_pipeline.js", "lead-update.js",
  "processar-storage.js", "reanalisar-lead.js"
].filter((file) => fs.existsSync(path.join(__dirname, file)));
```

Isso cobre só 5 arquivos. `api/` hoje tem 12: os 5 acima **mais** `analisar.js`,
`cerebro-config.js`, `criar-upload-url.js`, `diagnostico.js`, `leads-recentes.js`,
`limpar-tudo.js` e `restaurar-leads.js` — todos adicionados em versões posteriores sem que
ninguém atualizasse essa lista. Ou seja: 7 das 12 rotas reais do projeto (a maioria) não tinham
NENHUMA proteção contra esse tipo de duplicata — exatamente o cenário "front atualizado,
função serverless real desatualizada" que o comentário do próprio código diz querer evitar,
furado por atualização silenciosa de lista.

## O que mudou

A lista passa a vir de `fs.readdirSync("api/")` (filtrando `.js`) em vez de nomes escritos à
mão — cobre automaticamente qualquer rota nova de `api/`, sem precisar lembrar de atualizar essa
lista de novo no futuro.

```js
const apiDir = path.join(__dirname, "api");
const apiFiles = fs.existsSync(apiDir)
  ? fs.readdirSync(apiDir).filter((file) => file.endsWith(".js"))
  : [];
const apiDuplicadosNaRaiz = apiFiles.filter((file) => fs.existsSync(path.join(__dirname, file)));
```

## Verificação

- `npm test` verde, incluindo o teste novo.
- Novo teste `tests/v966-build-guarda-api-raiz-dinamica.test.mjs`: confirma que a lista vem de
  `readdirSync`, e EXERCITA a guarda de verdade — duplica `api/restaurar-leads.js` (um dos 7 que
  ficavam sem proteção) na raiz, roda `build.js` como processo filho, confirma que falha com a
  mensagem certa, e remove o arquivo de teste no `finally` (mesmo se a asserção falhar).
- `node --check build.js` OK.

## Arquivos
- `build.js` (guarda de API duplicada na raiz),
  `tests/v966-build-guarda-api-raiz-dinamica.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v966.md`, versão **965 → 966**.
