# v961 — diagnóstico da OpenAI podia dizer "análise funciona" com a análise quebrada

## Contexto

Revisão linha a linha de `api/diagnostico.js` (220 linhas) — endpoint de bastidor
(`?mode=status|openai|bucket`) que consolida os antigos `status.js`, `diagnostico-openai.js` e
`configurar-bucket.js`. Achado em `modoOpenAI` (mode=openai).

## O problema

Com a chave da OpenAI configurada, `modoOpenAI` roda 2 testes:
1. `models.list()` — só prova que a CHAVE é válida e alcançável.
2. `chat.completions.create({model: analysisModel, ...})` — chama EXATAMENTE como o pipeline
   real de análise chama. O próprio comentário do código já contava a história: antes esse teste
   usava outra API e dava falso negativo, escondendo o erro de verdade — foi trocado de propósito
   pra pegar esse tipo de problema.

Só que `analiseFunciona` (e o status HTTP 200/500 da resposta) vinham de
`testes.some(t => t.ok)` — "algum teste passou". Se `models.list` passasse mas o teste de
análise falhasse (ex.: o modelo configurado em `DIRECIONA_MAIN_MODEL` está indisponível pra essa
conta, ou sem quota especificamente pra esse modelo — bem plausível, é o cenário mais comum de
"a chave funciona mas a análise não"), o diagnóstico dizia `analiseFunciona:true` e devolvia
200. Ou seja: o EXATO problema que o comentário do código diz já ter corrigido uma vez, estava
de volta por outro caminho — o teste "bom" existia, mas o resultado dele podia ser mascarado
pelo teste mais fraco.

## O que mudou

`analiseFunciona` (e o status HTTP da resposta) agora vêm só do resultado do teste de análise
(`testeAnalise.ok`), não de um agregado "algum teste passou". `models.list` continua rodando e
aparecendo em `testes`/`ok` (a checagem geral `allOk` não mudou), só não decide mais sozinho que
"a análise funciona".

## Verificação

- `npm test` verde, incluindo o teste novo `v961-diagnostico-analise-funciona` — checagem
  estática do código-fonte (não dá pra chamar a OpenAI de verdade nesta sessão, sem OPENAI_API_KEY
  configurada aqui), confirma que `analiseFunciona`/status HTTP não usam mais `.some(...)`/
  `algumaIaOk`.
- `node --check api/diagnostico.js` OK.

## Achado, não corrigido — precisa decisão do dono (conflito entre 2 endpoints)

`modoBucket` (mode=bucket, ex-`configurar-bucket.js`) e `ensureBucketReady` em
`api/criar-upload-url.js` configuram o MESMO bucket do Supabase com valores diferentes e se
sobrescrevem:
- `criar-upload-url.js`: `fileSizeLimit` = `SUPABASE_ZIP_MAX_BYTES`, com teto de 300 MB
  (default 150 MB), `allowedMimeTypes` restrito a ZIP. Roda automaticamente (uma vez por
  instância "fria" do servidor) toda vez que alguém pede uma URL de upload.
- `diagnostico.js?mode=bucket`: `fileSizeLimit` = `SUPABASE_ZIP_MAX_BYTES`, **sem teto** (default
  2 GB se a env var não estiver definida), `allowedMimeTypes: null` (qualquer tipo). É uma ação
  manual (o corretor/admin chama pra resolver "arquivo grande demais").

Se alguém usar `mode=bucket` pra liberar um limite maior (ex.: 1 GB), a PRÓXIMA vez que o
servidor reiniciar uma instância "fria" e alguém importar um ZIP, `criar-upload-url.js` vai
rodar `updateBucket` de novo com o SEU PRÓPRIO teto (300 MB) e derrubar o limite que tinha sido
liberado manualmente — silenciosamente. Pior: mesmo que os dois leiam a MESMA env var
`SUPABASE_ZIP_MAX_BYTES`, o teto de 300 MB só existe do lado de `criar-upload-url.js` — então
`diagnostico.js` pode configurar o bucket real do Supabase pra aceitar até 2 GB, mas
`criar-upload-url.js` continua recusando (HTTP 413) qualquer arquivo acima de 300 MB antes
mesmo de gerar a URL.

Não mexi porque é decisão de produto (qual dos dois valores é o "certo": manter o teto de 300 MB
em todo lugar, ou tirar o teto e confiar só no plano do Supabase?), não bug técnico — mudar isso
sem confirmar pode quebrar upload de gente que hoje depende de um dos dois comportamentos.

## Arquivos
- `api/diagnostico.js` (`modoOpenAI` — `analiseFunciona`),
  `tests/v961-diagnostico-analise-funciona.test.mjs` (novo), `package.json`/`package-lock.json`,
  `NOTAS-v961.md`, versão **960 → 961**.
