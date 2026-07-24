# v963 — api/analisar.js era a única rota sem chave de API (rodava a IA de graça pra qualquer um)

## Contexto

Revisão linha a linha de `api/analisar.js` (138 linhas) — rota de compatibilidade que aceita
ZIP via multipart, ZIP cru ou JSON+base64, roda `processZipBuffer` (pipeline completo: extração,
transcrição de áudio, análise comercial pela OpenAI) e devolve o resultado direto, sem persistir
(`autoSaved:false`). Achado grave: **era a única rota do projeto sem `requireApiKey`.**

## O problema

Toda outra rota (`analisar-lead`, `lead-update`, `restaurar-leads`, `limpar-tudo`,
`criar-upload-url`, `diagnostico`, `leads-recentes`, `processar-storage`, `cerebro-config`) chama
`requireApiKey(req, res)` como primeira linha do handler. `api/analisar.js` nunca chamava —
qualquer POST não autenticado, de qualquer origem, disparava o pipeline completo da IA (o
trabalho mais caro do app: transcrição de áudio + análise comercial via OpenAI).

Isso já tinha sido encontrado e registrado em `NOTAS-v860.md` ("rota pública que gasta crédito")
e adiado a pedido do dono na época. Nesta revisão sistemática o mesmo problema apareceu de novo,
de forma independente — passou tempo suficiente, e o risco é financeiro real (crédito de OpenAI
gasto por qualquer um que descubra a URL), então corrigido agora com o mesmo mecanismo já usado
(e testado) em todo o resto do projeto.

## O que mudou

- `api/analisar.js` importa e chama `requireApiKey(req, res)` como primeira linha do handler —
  mesmo padrão de todas as outras rotas. `requireApiKey` já tem seu próprio fallback seguro (sem
  `CORRETOR_PRO_API_KEY` configurada, libera fora de produção ou com `ALLOW_UNPROTECTED_API=true`
  explícito; bloqueia em produção sem chave configurada) — nenhuma lógica nova, só aplicar a que
  já existe.
- **Novo:** guarda de regressão (`tests/v963-todas-rotas-exigem-api-key.test.mjs`) que varre
  TODO arquivo em `api/` com `export default async function handler`, e falha se qualquer um não
  chamar `requireApiKey`. Não trava só nesse arquivo — protege qualquer rota nova que vier a ser
  criada no futuro sem essa checagem.

## Verificação

- `npm test` verde, incluindo `v963-todas-rotas-exigem-api-key` (10 rotas verificadas, todas com
  a checagem).
- `node --check api/analisar.js` OK.

## Risco de regressão (avaliado, decisão tomada)

Não achei nenhuma chamada a `/api/analisar` em `app.js` (grep no projeto inteiro) — o app atual
não usa essa rota, ela existe só como "rota de compatibilidade" pra algum chamador externo
hipotético (script, automação). Se existir algum chamador externo de fato usando essa rota sem
mandar a chave, ele vai passar a receber 401 depois deste deploy — mas dado o histórico (achado
já uma vez, adiado, resurgindo agora) e o risco financeiro de deixar como está, optei por
corrigir: é o mesmo mecanismo já validado em produção no resto do app, e reverter é trivial
(este commit isolado) se aparecer um chamador legítimo quebrado.

## Resto do arquivo

Lido por completo, incluindo o parser de multipart escrito à mão (`parseMultipart`) — tracing
manual de headers/boundary/CRLF não achou bug (trata corretamente múltiplas partes, boundary
final `--`, e preserva o buffer binário do arquivo sem tocar em texto). Os tetos de tamanho
(80 MB cru, 110 MB pra JSON+base64) são consistentes entre si (110 MB de JSON acomoda ~80 MB de
ZIP depois da inflação de ~33% do base64) — não é descuido, os números batem.

## Arquivos
- `api/analisar.js` (`requireApiKey`), `tests/v963-todas-rotas-exigem-api-key.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v963.md`, versão **962 → 963**.
