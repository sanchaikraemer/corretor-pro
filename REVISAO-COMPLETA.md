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
| api/cerebro-config.js | 378 | concluído | lido por completo, sem fix — ver log |
| api/processar-storage.js | 370 | concluído (v954) | reaproveitamento de transcrição por nome de arquivo — ver NOTAS-v954.md. Segunda leitura completa focada em bugs não achou mais nada de novo |
| api/restaurar-leads.js | 264 | concluído (v958) | 3 fixes reais — ver log |
| api/limpar-tudo.js | 235 | concluído (v959) | paginação de storage — ver log |
| api/criar-upload-url.js | 228 | concluído (v960) | regex de acento corrigido + guarda de regressão nova — ver log |
| api/diagnostico.js | 220 | concluído (v961) | analiseFunciona podia mascarar erro real — ver log |
| api/leads-recentes.js | 188 | concluído (v962) | auditoria subestimava duplicidade + backup sem Cérebro — ver log |
| api/analisar.js | 138 | concluído (v963) | 🔴 faltava requireApiKey — corrigido, ver log |
| app.js | 13169 | em andamento | dividir em blocos — ver sub-checklist logo abaixo desta tabela |
| service-worker.js | 244 | pendente | |
| index.html | 661 | pendente | |
| styles.css | 2325 | pendente | dividir em 2 blocos |
| build.js | 92 | pendente | |
| js/proposta.js | 285 | pendente | |
| js/pwa-install.js | 115 | pendente | |
| js/commercial-schema.js + js/dom.js + js/state.js | 27 | pendente | revisar junto (pequenos) |

Testes (`tests/*.test.mjs`) ficam fora da varredura linha a linha — só são tocados quando uma
correção exige teste de regressão novo (regra do CLAUDE.md).

### Sub-checklist app.js (13169 linhas — grande demais pra 1 bloco só)

Lido/corrigido em blocos sequenciais de ~1800–2000 linhas. Cada bloco concluído é marcado aqui
pra sobreviver a uma possível compactação de contexto no meio do arquivo.

| Bloco | Linhas | Status |
|---|---|---|
| 1 | 1–7750 | concluído (v964) — blocos 1+2+3 lidos juntos nesta passada; ver achados abaixo. Nada de novo achado em 5450–7750 (Agenda, Cérebro/Aprendizado, exportação Excel, fluxo de importação/Share Target — tudo consistente) |
| 4 | 8100–10000 | pendente — continuar a partir da linha ~8100 (linhas 7751–8098 já lidas nesta mesma passada, sem achado novo; v965 corrigiu o regex de acento em 3711/7870/8356, dentro do trecho já concluído) |
| 5 | 8001–10000 | pendente |
| 6 | 10001–12000 | pendente |
| 7 | 12001–13169 | pendente |

Achados já conhecidos ANTES de começar (registrados por outras revisões/achados cruzados neste
mesmo arquivo, conferir ao passar por essas linhas):
- Regex frágil de acento (mesmo padrão de v950/v951/v960): **corrigido na v965** — eram
  exatamente 3 pontos (`normalizarEtapa`, `semAcento`, `_normpc`), não "pelo menos 5" como a
  estimativa inicial sugeria. `app.js` entrou na guarda de regressão `v960-sem-acento-unicode-literal`.
- Nomes de pessoas hardcoded (achado grande da v955, ver seção `_pipeline.js`): confirmado
  presente também aqui, linhas 2053/2076 (`BUSINESS_RE`, `ehMsgDoCliente`) — mesmo achado grande,
  não repetir contagem, já registrado como pendente de decisão do dono.
- Push duplicado de `carregarGeladeira` já corrigido (v952) — mas o mesmo padrão
  (`window.algumNome=function(){}` dentro de IIFE reaproveitando nome já usado como
  `function algumNome(){}`/outra IIFE) se repete em MAIS lugares — **confirmado e detalhado na
  v964** (ver NOTAS-v964.md): `abrirVenda`/`marcarPerdido` (4 gerações cada) e
  `arquivarLead`/`ui683MarcarEtapaRapida` (2 gerações cada). Comportamento ao vivo está correto
  (a última geração de cada um é a que roda), mas fica ~200 linhas de código morto espalhadas —
  limpeza registrada como pendente, não feita ainda (precisa confirmar que nenhum outro nome
  intermediário — `ui683MoverEtapaComEvento`, `abrirModalDesfecho` não-Final — é referenciado em
  mais algum lugar antes de apagar).
- Dois `carregarPipeline` no arquivo, o de baixo (~linha 11874) sobrescreve o de cima (achado da
  v860, NOTAS-v860.md) — mesma categoria de risco do bug do carregarGeladeira. Ainda não
  verificado se o de cima é 100% morto ou se algum call site bare-identifier ainda o alcança —
  conferir quando a leitura sequencial chegar perto dessa linha.

### Achados adicionais lendo linhas 3100–5450 (não corrigidos — ver motivo em cada um)

- **`iniciarSequenciaAtendimento`/`proximoDaSequencia`/`sairDaSequencia`/`finalizarSequencia`
  (linhas ~4707–4739) — feature "Atender em sequência" 100% órfã.** `state.gruposHome.hoje`
  (usado pra montar a fila) nunca é populado em lugar nenhum — os grupos reais são
  `"acao-hoje"`, `"retomar-cuidado"` etc. (ver `renderListasHome`), não `"hoje"`. MAS, mais
  importante: `iniciarSequenciaAtendimento` não é chamada de NENHUM lugar (nem `onclick` em
  app.js, nem em `index.html`) — não existe botão/entrada pra essa função. `state.sequencia`
  nunca fica truthy em produção. Não corrigi porque consertar o `gruposHome.hoje` não
  restauraria funcionalidade nenhuma (nada chama a função de qualquer forma) — parece resto de
  um design anterior à fila "Fazer agora" (dose/`cpFilaFazerAgora`) atual. Se o dono quiser essa
  navegação "1 lead por vez" de volta, precisa decidir ONDE entra o botão — não é fix técnico.
- **`cp704Insights` (linha ~5066) — `const obsFact=null;` hardcoded, nunca chama
  `cp707ObservationFacts(lead)`.** `cp704Situacao` (linha 4903) chama `cp707ObservationFacts`
  de verdade e usa `obsFact.situacao` quando bate o caso especial ("a esposa não aprovou a
  compra"). `cp704Insights` deveria (pelo padrão do resto da função) usar os
  `obsFact.insight1/2/3` correspondentes nesse mesmo caso, mas está travado em `null` — cai
  sempre no caminho genérico. Resultado: nesse caso raro e específico, a "Situação" do card
  mostra "Em decisão" (correto) mas os "Insights" mostram texto genérico em vez do insight
  específico do caso. Não corrigi: não dá pra saber se foi um `null` esquecido de um debug ou
  uma escolha consciente (ex.: o dono achou o insight script demais pra aparecer ali) — impacto
  baixo (caso raro, é cosmético, não perde dado nem informa errado), fica registrado.

### v964 — 10 confirm() nativos → cp903Confirm + bug real no botão "Apagar tudo"

Ver `NOTAS-v964.md` pro detalhe completo. Resumo: mais 10 usos do `confirm()` nativo (fora do
padrão visual do app, mesmo problema já reportado pelo dono no botão Reativar) convertidos pro
modal `cp903Confirm`, em `importarTelefonesCSV`, `apagarLead`, `excluirLeadDefinitivo`,
`removerLembrete`, `apagarItemAprendizado`, `limparAprendizadoTudo`, `zerarCerebroTudo`,
`#btnDescartarUpload`, `descartarLeadPendente`, `#wipeAll`. Achado um bug real no caminho: o
botão "Apagar tudo" mandava `{ confirmacao: "APAGAR TUDO" }` mas a API exige `{ confirm: "..." }`
— o botão NUNCA funcionava (sempre 400). Corrigido. `.cp903-modal p` ganhou
`white-space:pre-line` pra mensagens multi-linha não perderem a quebra visual.

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

### api/cerebro-config.js (arquivo CONCLUÍDO, 378 linhas — lido por completo, sem fix)

Nenhum bug de segurança/dado encontrado. Um achado menor, não corrigido:
- Fila de aprendizado pendente (`processar-aprendizado-pendente`) não tem limite de tentativas
  — um item que falha sempre (ex.: lead com dado incompatível) fica retentando pra sempre. Na
  prática não trava a fila (o item que falha ganha `atualizado_em` novo e vai pro fim da ordem
  de processamento, então outros itens seguem sendo processados no meio tempo), mas o item
  problemático nunca é descartado nem sinalizado como "definitivamente falho". Baixa
  severidade — não é urgente, registrado só pra não perder de vista.
- `salvarCerebro()` (app.js) sempre manda o formulário inteiro no save, então a assimetria entre
  campos que usam `hasOwnProperty` (regrasTexto/objecoesTexto) e campos que não usam
  (corretorNome/metodo/tom/diferenciais/evitar, que caem pro default vazio se ausentes) não é
  alcançável hoje — só viraria problema se um chamador futuro fizesse update parcial. Não mexi
  (não é bug reproduzível com o único chamador existente).

### api/restaurar-leads.js (v958) — arquivo CONCLUÍDO (264 linhas)

**Corrigido — 3 bugs reais (ver NOTAS-v958.md pro detalhe):**
- `iso()`: bloco de data serial do Excel (`45383` → 2024-04-01) nunca rodava de verdade, porque
  todo call site já chega com o valor stringificado (`str(...)`) e o bloco só disparava com
  `typeof value === "number"`. `new Date("45383")` não dá `Invalid Date` — o JS lê como ANO
  45383 e persiste essa data lixo silenciosamente. Corrigido pra detectar o número mesmo vindo
  como string.
- `normalizarLeadLegado`: `dedupeKey` usava o NOME de exibição já com o fallback "Cliente
  restaurado" aplicado — toda linha legada sem nome e sem telefone virava a mesma chave
  `nome:cliente restaurado`, e o filtro `seenKeys` de `restaurarLeadsLegados` descartava a
  segunda/terceira/etc. como se fossem duplicata da primeira, mesmo com `id` de origem
  diferente. Corrigido: dedupeKey usa o nome real (sem o placeholder); sem telefone e sem nome
  real, fica `""` (o código já tratava dedupeKey vazio como "não aplica" — passa a filtrar só
  pelo `id` de origem).
- `stage()`: tratava `"geladeira"` e `"standby"/"pausado"` como a mesma etapa (`"Standby"`), mas
  `normalizarEtapa()` em app.js — a autoridade real desse vocabulário no resto do app — trata
  como duas etapas diferentes (`"Geladeira"` some da busca ativa via `foraDaBusca()`;
  `"Standby"` continua no pipeline ativo). Lead que já estava arquivado na base antiga voltava
  pra fila ativa do corretor depois de restaurado. Corrigido pra separar os dois casos na mesma
  ordem/critério de `normalizarEtapa()`.

**Achado, não corrigido (mesmo padrão recorrente, fora de escopo seguro):**
- `lerTabela`/`currentKeys`: mais dois `.limit(5000)` — quinto/sexto lugar com o padrão de
  escala já registrado em `_persistence.js`, `_pipeline.js` (×2) e `lead-update.js`.

### api/limpar-tudo.js (v959) — arquivo CONCLUÍDO (235 linhas)

Rota destrutiva de reset total, já com 3 camadas de proteção contra disparo acidental (API key +
env var explícita + confirmação literal "APAGAR TUDO") — não mexi em nenhuma delas.

**Corrigido:** `emptyBucket` listava cada pasta do bucket UMA vez com `limit:1000` — `list()` do
Supabase Storage nunca pagina sozinho. Pasta com mais de 1000 arquivos (plausível em
`transcription-cache/`, compartilhada entre todos os leads) fazia "limpar tudo" apagar só o
primeiro lote e reportar `ok:true` como se tivesse esvaziado tudo. Corrigido com paginação por
offset até a página vir incompleta, e `remove()` passou a rodar em lotes de 1000 (precaução,
mesmo sem confirmar um teto documentado). Ver `NOTAS-v959.md`.

**Não é bug, registrado por completude:** a lista de tabelas apagadas não inclui
`direciona_config` (Cérebro) — reseta dados/leads, preserva a configuração do corretor. Parece
intencional; só fica registrado caso o dono espere um reset totalmente completo.

### api/criar-upload-url.js (v960) — arquivo CONCLUÍDO (228 linhas)

**Corrigido:** mesmo regex frágil de acento (`sanitizeFileName`, linha ~105) da v950/v951 —
caracteres Unicode combinantes literais no código-fonte em vez do escape. Terceira ocorrência
desse padrão nesta revisão; desta vez também entrou uma guarda de regressão
(`tests/v960-sem-acento-unicode-literal.test.mjs`) que falha se QUALQUER arquivo já corrigido
voltar a ter o caractere literal — `app.js` ainda tem o mesmo padrão em ~5 pontos e entra nessa
lista quando a revisão chegar lá (tarefa app.js, pendente). Ver `NOTAS-v960.md`.

Resto do arquivo lido por completo, sem outro bug: sem risco de path traversal no
`storagePath` (sanitizers não permitem `/`), limite de tamanho declarado é só pré-check de UX
(garantia real é o `fileSizeLimit` do bucket, já com fallback/aviso tratados).

### api/diagnostico.js (v961) — arquivo CONCLUÍDO (220 linhas)

**Corrigido:** `modoOpenAI` (mode=openai) calculava `analiseFunciona` (e o status HTTP da
resposta) com `testes.some(t => t.ok)` — "algum teste passou". Com a chave configurada rodam 2
testes: `models.list` (só prova que a chave é válida) e uma chamada de chat completion idêntica
à do pipeline real, com o `analysisModel` configurado. Se só o `models.list` passasse (chave
válida mas o MODELO de análise específico indisponível/sem quota pra essa conta — cenário comum
de "chave ok mas análise quebrada"), o diagnóstico dizia `analiseFunciona:true` e devolvia 200.
Corrigido pra usar só o resultado do teste de análise. Ver `NOTAS-v961.md`.

**🟡 Achado, não corrigido — precisa decisão do dono (conflito entre dois endpoints):**
`modoBucket` (mode=bucket) e `ensureBucketReady` de `api/criar-upload-url.js` configuram o MESMO
bucket do Supabase com regras diferentes (um sem teto de tamanho e sem restrição de MIME type,
o outro com teto de 300 MB e só ZIP) e se sobrescrevem — o próximo cold start de
`criar-upload-url.js` derruba silenciosamente qualquer limite maior liberado manualmente via
`mode=bucket`. Detalhe completo em `NOTAS-v961.md`.

### api/leads-recentes.js (v962) — arquivo CONCLUÍDO (188 linhas)

**Corrigido — 2 bugs reais (ver NOTAS-v962.md):**
- `gerarAuditoriaDados` (`?audit=1`): contador de "possíveis duplicados" por telefone/nome vinha
  da lista já cortada em 50 exemplos — com mais de 50 grupos duplicados de verdade, o relatório
  subestimava o total (dizia 50 quando era mais). Contador agora vem da lista completa; só os
  exemplos exibidos continuam limitados a 50.
- `exportarTudo` (`?export=full`, "backup completo"): não incluía `direciona_config` (tabela do
  Cérebro — persona/regras/conhecimento do corretor, ver CLAUDE.md). Um restore desse "backup
  completo" recuperava os leads mas perdia toda a configuração da IA. Tabela adicionada à lista
  de export (mudança aditiva, sem risco pro que já era exportado).

**Achado, não corrigido (mesmo padrão recorrente, versão mais branda):** `readTable` pagina de
verdade via `.range()` em loop (mais cuidadoso que os outros arquivos revisados), mas ainda tem
teto fixo de 20.000 linhas por tabela — mesma classe de achado de escala já registrada em vários
outros arquivos, só que com teto mais alto e paginação real por baixo.

### api/analisar.js (v963) — arquivo CONCLUÍDO (138 linhas)

**🔴 Corrigido — segurança/custo real:** era a ÚNICA rota do projeto sem `requireApiKey`. Rodava
o pipeline completo da OpenAI (transcrição + análise) pra qualquer POST não autenticado — já
tinha sido achado e registrado em `NOTAS-v860.md` ("rota pública que gasta crédito") e adiado a
pedido do dono na época; reapareceu de forma independente nesta revisão sistemática. Corrigido
com o mesmo `requireApiKey` de todo o resto do projeto. Avaliei o risco de quebrar algum chamador
externo (não achei nenhum uso de `/api/analisar` em `app.js`) — optei por corrigir dado o
histórico (2ª vez encontrado) e o risco financeiro de deixar aberto; reverter é trivial se
aparecer um chamador legítimo. Ver `NOTAS-v963.md`.

**Novo:** guarda de regressão (`tests/v963-todas-rotas-exigem-api-key.test.mjs`) que varre TODO
handler de rota em `api/` e falha se algum não chamar `requireApiKey` — protege qualquer rota
nova no futuro, não só este arquivo.

Resto do arquivo (parser de multipart escrito à mão, decodificação de base64, validação de
"análise completa") lido por completo, sem outro bug.
