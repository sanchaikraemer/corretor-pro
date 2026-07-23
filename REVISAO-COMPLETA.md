# Revisão completa linha a linha — iniciada 2026-07-23

## Regras desta revisão
- Branch `claude/saas-real-estate-expert-q610re` — nunca mexer em `main`, nunca fazer merge/deploy sem pedir antes.
- Cada correção aplicada segue o CLAUDE.md: versão sequencial em `package.json` (`version` + `displayVersion`),
  `npm install --package-lock-only`, `NOTAS-vNNN.md`, `npm test` verde antes de commitar.
- Nunca cravar dado comercial (preço, empreendimento, condição, nome de pessoa) no código.
- Decisão de negócio ambígua (não é bug técnico, é escolha de produto) → registra no log abaixo, não inventa.
- Se `npm test` quebrar numa correção e não for trivial resolver, reverte e registra como "achado, não corrigido".
- Ritmo sequencial (um arquivo/bloco por vez, sem paralelismo) — combinado com o dono do projeto.

## Checklist de arquivos (ordem de prioridade)

| Arquivo | Linhas | Status | Observações |
|---|---|---|---|
| api/_persistence.js | 869 | concluído (v950) | camada de persistência — crítico. 1 fix aplicado + 2 achados registrados no log |
| api/_pipeline.js | 3233 | parcial (v951): linhas 1–950 revisadas, falta ~950–3233 | motor de análise/IA — crítico |
| api/lead-update.js | 1748 | pendente | dividir em 2 blocos |
| api/reanalisar-lead.js | 804 | pendente | |
| api/cerebro-config.js | 378 | pendente | |
| api/processar-storage.js | 370 | tocado pontualmente (v954) | reaproveitamento de transcrição por nome de arquivo — ver NOTAS-v954.md. Ainda não foi lido linha a linha por completo |
| api/restaurar-leads.js | 264 | pendente | |
| api/limpar-tudo.js | 235 | pendente | |
| api/criar-upload-url.js | 228 | pendente | tem o MESMO regex frágil de acento (linha ~105) — aplicar o mesmo fix de v950 |
| api/diagnostico.js | 220 | pendente | |
| api/leads-recentes.js | 188 | pendente | |
| api/analisar.js | 138 | pendente | |
| app.js | 13178 | pendente | dividir em blocos, respeitando limites de função. Tem o MESMO regex frágil de acento em pelo menos 5 pontos (linhas ~3703, ~7822, ~8299, e mais 2) — aplicar o mesmo fix de v950 |
| service-worker.js | 244 | pendente | |
| index.html | 661 | pendente | |
| styles.css | 2325 | pendente | dividir em 2 blocos |
| build.js | 92 | pendente | |
| js/proposta.js | 285 | pendente | |
| js/pwa-install.js | 115 | pendente | |
| js/commercial-schema.js + js/dom.js + js/state.js | 27 | pendente | revisar junto (pequenos) |

Testes (`tests/*.test.mjs`) ficam fora da varredura linha a linha — só são tocados quando uma
correção exige teste de regressão novo (regra do CLAUDE.md).

## Log de achados e correções
_(preenchido conforme a revisão avança — cada entrada aponta arquivo:linha, o problema, e a versão
que corrigiu, ou "achado, não corrigido" com o motivo)_

### api/_persistence.js (v950)

**Corrigido:**
- `_normNome` (linha 160): regex de remoção de acento usava caracteres Unicode combinantes literais
  no código-fonte em vez do escape `̀-ͯ` (que a função `normalizeKey`, no mesmo arquivo,
  já usa). Mesmo comportamento, mas frágil a corrupção silenciosa. Normalizado pro escape.
  Mesmo padrão encontrado em mais 6 pontos do projeto (api/criar-upload-url.js,
  api/_pipeline.js ×2, app.js ×5+) — marcado nas linhas desses arquivos no checklist acima pra
  corrigir quando a revisão chegar neles.

**Achado, não corrigido (precisa decisão, não é bug simples):**
- `_buscarProcessamentoExistenteV681`/`buscarAvatarAnterior`: varrem até 5000/500 registros em
  memória pra achar duplicata por telefone/nome, ordenados por data. Acima desse volume de leads
  processados, registros mais antigos ficam invisíveis pra deduplicação (import duplicado em vez de
  atualizar o existente). Precisa de busca indexada no banco, não é fix de uma linha.
- `persistProcessingResult`: retorna `ok:true` mesmo se o upsert nas tabelas legadas
  `leads`/`direciona_leads` falhar (só fica em `warnings`). A carteira do app lê só de
  `whatsapp_processamentos` (confirmado em `listRecentProcessings`), então não parece afetar o que o
  corretor vê — mas precisa confirmar se algo mais depende dessas tabelas antes de mudar isso.

### api/_pipeline.js (v951) — linhas 1–950 de 3233, resto pendente

**Corrigido:**
- 11 linhas de comentário (474–527, ao redor de `filtrarCompromissosReais`) estavam com escapes
  Unicode gravados como texto literal (`é`, `ç` etc.) em vez dos caracteres reais — comentário
  ilegível, zero impacto em runtime. Decodificado.
- Mesmo regex frágil de acento da v950, 2 ocorrências — trocado pro escape padrão.

**Achado, não corrigido (precisa confirmar com o dono, não é bug óbvio):**
- `normalizarModeloComercial`: exportada, zero chamadas no projeto inteiro — código morto do
  reset "v724-2". Limpeza, não bug.
- `finalizarAnaliseComercial`: chamada em 4 lugares como se transformasse o resultado
  (`api/reanalisar-lead.js` ×3, `api/lead-update.js` ×1), mas só devolve o input sem alterar
  desde o mesmo reset. Provavelmente inofensivo (o conceito que ela aplicava — teto de
  probabilidade — foi removido depois em `_semScoreComercial`), mas os call-sites enganam.

**Pendente:** linhas ~950–3233 do arquivo (o grosso da lógica de análise/prompt da IA) ainda não
foram lidas nesta revisão — continuar daqui no próximo ciclo.

### Pausa pra feature ao vivo (v952) — acrescenta contexto útil pra quando a revisão chegar em app.js

O dono pediu ao vivo busca dentro de Arquivados + trocar `confirm()` nativo por modal em-app no
Reativar/Reabrir (ver `NOTAS-v952.md`). No caminho, achei e corrigi um bug real e não-óbvio,
relevante pro resto da revisão de app.js:

- **app.js tinha função duplicada por nome** (`carregarGeladeira`): uma antiga (função nomeada,
  sem paginação) e uma nova (só em `window.carregarGeladeira`, dentro de IIFE). Chamada solta
  (sem `window.`) dentro do próprio módulo sempre resolve pro nome de função do ESCOPO DO
  MÓDULO, nunca pega a versão reatribuída via `window.X = ...` de dentro de uma IIFE depois.
  Isso silenciosamente quebrava a paginação "carregar mais" da tela Arquivados desde a
  Atualização #724-2. Corrigido (removida a duplicada, call site ajustado pra `window.*`).
- **Vale procurar esse MESMO padrão em outras IIFEs "Atualização #NNN" do arquivo** (há várias:
  #685, #724-2, #6862, #6863 nos comentários) — qualquer `window.algumNome = function(){...}`
  dentro de uma IIFE que reaproveita um nome já usado como `function algumNome(){}` no escopo do
  módulo tem o mesmo risco. Não fiz essa varredura ainda — fica pro ciclo que revisar app.js.
- Teste antigo `v904-somente-arquivar.test.mjs` mirava sem querer na função morta (regex com
  aspas duplas). Corrigido pra mirar a versão real (aspas simples). Vale desconfiar de outros
  testes antigos que usam `app.match(/.../)`: se o regex não for específico o bastante, pode
  estar validando código morto em vez do código que realmente roda.
