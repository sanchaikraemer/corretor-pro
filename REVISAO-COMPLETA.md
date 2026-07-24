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
| api/_pipeline.js | 3233 | concluído (v951 + v955) | motor de análise/IA — crítico. **Achado grande pendente de decisão: nomes de pessoas cravados no código, ver log** |
| api/lead-update.js | 1722 | concluído (v956) | ver log — 1 fix grande (v900 faltando no caminho principal) + achados |
| api/reanalisar-lead.js | 804 | concluído (v957) | fix de fuso horário em lembrete a partir de mensagem — ver log |
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

### api/_pipeline.js (v955) — linhas 950–3233, arquivo CONCLUÍDO

**Corrigido:**
- `assinaturaTimelineIncremental` (dedupe de item de timeline numa reimportação) não baixava a
  caixa do nome do arquivo de áudio, diferente da assinatura irmã em `_persistence.js`.
  Alinhado — mesma normalização (minúsculo) nos dois lugares.

**🔴 ACHADO GRANDE, PRIORIDADE ALTA — precisa decisão do dono, não é fix de uma linha:**

Nomes de pessoas e de empresa parceira **cravados no código**, contrariando a regra
não-negociável do CLAUDE.md ("nenhuma informação comercial — preço, empreendimento, condição,
nome de pessoa — pode ser cravada no código"). Usados como heurística pra decidir "esse autor
da mensagem é o CORRETOR ou o CLIENTE":
- `api/_pipeline.js` linhas 128, 232, 862, 1906 — `sanchai`, `miguel kirinus`,
  `senger`/`construtora senger` (empresa parceira) hardcoded em regex.
- `api/_pipeline.js` linha 1836 — **lista de 28 primeiros nomes** (jamil, isabela, amiel,
  victor, paty, taiany, laura, jean, thuane, jessica, rafael, gilmar, alison, emerson,
  gabriele, joel, daniele, julia, henrique, karoliny, ricardo, alberto, marcia, monique,
  sanchai, cristian, fabio, douglas, zuleica) — muito provavelmente nomes reais de
  clientes/contatos usados como "stopwords" de similaridade de texto.
- `app.js` linhas 2053, 2076 — mesmo padrão.
- `api/lead-update.js` linha 1300 — mesmo padrão.

O próprio código PROVA que esse problema já foi identificado e corrigido uma vez, só que em
outro lugar: comentário na linha 2489 de `_pipeline.js` diz literalmente "o nome do corretor
vem SEMPRE da configuração do Cérebro... Sem nome fixo no código" (fix da v827 §7.4). E
`mcAutorEhContato` já recebe `corretorNome` dinâmico como parâmetro e usa ele — mas roda o
regex hardcoded LOGO DEPOIS, como checagem redundante. O mecanismo certo já existe; só não foi
usado pra substituir de vez o hardcode nessas funções de classificação de autor.

Não corrigido agora porque: essa heurística decide "negócio vs cliente" em CADA análise —
núcleo da classificação de mensagem. Errar aqui quebra silenciosamente em produção, sem teste
automatizado pegar (é heurística de linguagem natural). `autorPareceNegocioPipeline` nem
recebe `corretorNome` hoje — precisaria virar parâmetro e propagar por vários call-sites, mais
que um ciclo automatizado deveria decidir sozinho. Ver `NOTAS-v955.md` pra recomendação
detalhada de como migrar isso pro Cérebro configurado.

**Achados menores:**
- Mais 2 pontos com limite fixo de leitura no Supabase (`loadMemoriaComercialV2`: 10.000 linhas;
  `aprenderRespostasDaCarteira`: 3.000 linhas) — mesma classe do achado de escala da v950
  (limite 5000 em `_buscarProcessamentoExistenteV681`). Terceiro lugar com esse padrão.
- Duas implementações paralelas de "assinatura de item de timeline pra dedupe"
  (`assinaturaTimelineIncremental` vs `_assinaturaTimelineV681`) em arquivos diferentes — agora
  alinhadas pro caso de áudio, mas continuam duplicadas. Não unificado (mexeria em lógica
  central de merge dos dois lados do pipeline).

### api/lead-update.js (v956) — arquivo CONCLUÍDO (1722 linhas)

**Corrigido (v956, ver seção própria acima):** `acaoAtualizarComEvolucao` (o caminho mais comum
de reimportação de lead já existente) não tinha a proteção da v900 (mensagem real substitui
cópia da sugestão enviada) — agora usa a mesma função já testada de `_persistence.js`. Nessa
mesma limpeza, uma TERCEIRA implementação de assinatura/mescla de timeline foi encontrada
(`assinaturaMsg`/`mesclarTimelines`, agora removida) — ou seja, existiam 3 versões paralelas do
mesmo conceito em 3 arquivos diferentes (`_persistence.js`, `_pipeline.js`, `lead-update.js`).
Ficam 2 (a de `_pipeline.js`, usada só na etapa de análise pra decidir "mensagem nova", e a de
`_persistence.js`, agora reaproveitada também aqui) — reforça o achado já registrado de que
esse conceito devia ser unificado num só lugar algum dia.

**Achado — informativo, não é bug, mas interage com a mudança da v954 desta mesma noite:**
`acaoApagar` → `apagarStorageDosLeads` (linha ~1561): ao apagar um lead, se ele não tiver
`_storageRefs.transcriptionCachePaths` registrado (leads de antes da v911, e TODO lead criado
manualmente via `acaoCriarManual`/`acaoNovaOportunidadeParceiro`, que nunca passa pelo import
de ZIP), o código **apaga a pasta inteira `transcription-cache/` do Storage** — compartilhada
entre TODOS os clientes — não só os arquivos daquele lead. É proposital e documentado no
próprio código (privacidade: sem rastro hash→lead nesses casos, a única forma seguve de
garantir que não sobra transcrição com dado pessoal é limpar tudo). Efeito colateral: como
praticamente todo lead manual dispara essa limpeza total, o cache de reaproveitamento de
transcrição que a v954 (desta mesma noite) passou a depender tende a ser esvaziado com
frequência sempre que o corretor apagar QUALQUER lead manual — mesmo um que nunca teve áudio.
Não mexi nisso: é lógica de exclusão de dado pessoal, risco alto de mexer sem revisão humana.
Se o dono quiser, dá pra restringir esse gatilho só a leads que realmente têm chance de ter
áudio (ex.: pular quando `analysis?.origem` for `"manual"` ou `"oportunidade-parceiro"`), mas
isso precisa de decisão consciente, não de um ciclo automatizado.

**Achados menores:**
- `removerVinculosComLeadsApagados` (linha ~1639): mais um `.limit(5000)` — quarto lugar com
  esse padrão de teto fixo de leitura (ver achados da v950/v955).
- Mais ocorrências do padrão de nomes hardcoded já registrado (linha ~1274, dentro de
  `contarContatosV685`) — já contabilizado no achado grande da v955, sem repetir aqui.

### api/reanalisar-lead.js (v957) — arquivo CONCLUÍDO (804 linhas)

**Corrigido:** `diasAteDiaSemana` (usada por `lembreteDoTexto`/`lembreteDaTimeline` — "te chamo
sábado" vira lembrete) usava `d.getUTCDay()` quando calculava a partir da data de uma mensagem
específica (`baseDate`), diferente de `diaSemanaBR()` (usada pra "agora"), que já era consciente
do fuso de Brasília de propósito. Mensagem enviada entre 21h e meia-noite em Brasília cai na
madrugada do dia seguinte em UTC — nesse intervalo, o cálculo do dia da semana saía errado por
1 dia, e o lembrete podia nascer no dia certo da semana errado por 24h. Extraída
`diaSemanaBRDe(date)` (mesma lógica de `diaSemanaBR`, pra qualquer data) e usada nos dois
lugares.

**Achado, não corrigido (comportamento intencional):** `podeReusar6863` travado em `false`
desde a v752 — bloco de reuso de análise por assinatura de timeline fica morto de propósito.
Mesma categoria do achado da v951 (`finalizarAnaliseComercial`/`normalizarModeloComercial`).
