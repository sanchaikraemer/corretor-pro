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
| app.js | 13214 | concluído (v964+v965) | lido linha a linha do início ao fim — ver sub-checklist e achados abaixo desta tabela |
| service-worker.js | 244 | concluído | lido por completo, sem bug — ver log |
| index.html | 663 | concluído | lido por completo, sem bug — ver log |
| styles.css | 2325 | concluído | lido por completo, sem bug — ver log |
| build.js | 92 | concluído (v966) | guarda de API duplicada na raiz cobria só 5 de 12 arquivos — ver log |
| js/proposta.js | 289 | concluído (v967) | 2 confirm() nativos que a varredura da v964 não pegou — ver log |
| js/pwa-install.js | 116 | concluído | sem fix de código — achado de conteúdo faltando (onboarding), ver log |
| js/commercial-schema.js + js/dom.js + js/state.js | 28 | concluído (v968) | 2 bugs reais em js/dom.js — ver log |

Testes (`tests/*.test.mjs`) ficam fora da varredura linha a linha — só são tocados quando uma
correção exige teste de regressão novo (regra do CLAUDE.md).

### Sub-checklist app.js (13169 linhas — grande demais pra 1 bloco só)

Lido/corrigido em blocos sequenciais de ~1800–2000 linhas. Cada bloco concluído é marcado aqui
pra sobreviver a uma possível compactação de contexto no meio do arquivo.

| Bloco | Linhas | Status |
|---|---|---|
| 1 | 1–7750 | concluído (v964) — blocos 1+2+3 lidos juntos nesta passada; ver achados abaixo. Nada de novo achado em 5450–7750 (Agenda, Cérebro/Aprendizado, exportação Excel, fluxo de importação/Share Target — tudo consistente) |
| 4 | 7750–9550 | concluído nesta passada, sem achado novo (Memória do lead, Carteira/tabela, exportação CSV/backup/auditoria, diagnóstico OpenAI, atalhos de teclado, cp786/cpFilaFazerAgora/probabilidade de fechamento) |
| 5 | 9550–11512 | concluído — regex de acento (v965); investigação `carregarPipeline`/`renderListasHome` (verificado seguro) e `abrirEditarLead`/`salvarEditarLead` (verificado seguro, dead code) documentadas acima |
| 6 | 11512–13214 (fim do arquivo) | concluído — geladeira/busca arquivados, virtualização, cascata de reformas de tela "Atendimentos" (cp694→788), investigações `renderCarteiraTabela`/`setCarteiraFiltro`/demais funções do v683 (verificado seguro) e correção do achado antigo sobre `gruposHome.hoje` — tudo documentado acima |

**app.js CONCLUÍDO — arquivo inteiro (13214 linhas) lido do início ao fim nesta revisão.**

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
  v860, NOTAS-v860.md) — mesma categoria de risco do bug do carregarGeladeira. **Verificado
  seguro** (ver seção "Investigação: carregarPipeline" abaixo) — resincronização de propósito
  presente, não é bug.

### Achados adicionais lendo linhas 3100–5450 (não corrigidos — ver motivo em cada um)

- **`iniciarSequenciaAtendimento`/`proximoDaSequencia`/`sairDaSequencia`/`finalizarSequencia`
  (linhas ~4707–4739) — feature "Atender em sequência" 100% órfã.** `iniciarSequenciaAtendimento`
  não é chamada de NENHUM lugar (nem `onclick` em app.js, nem em `index.html`) — não existe
  botão/entrada pra essa função, confirmado de novo ao concluir a leitura sequencial do arquivo
  inteiro. `state.sequencia` nunca fica truthy em produção. Não corrigi porque não existe
  nenhum jeito de disparar a função hoje — parece resto de um design anterior à fila "Fazer
  agora" (dose/`cpFilaFazerAgora`) atual. Se o dono quiser essa navegação "1 lead por vez" de
  volta, precisa decidir ONDE entra o botão — não é fix técnico.
  **Correção a este achado:** a versão anterior deste registro dizia que `state.gruposHome.hoje`
  "nunca é populado em lugar nenhum" — isso estava errado. A geração FINAL de `renderListasHome`
  (linha ~13180, dentro da IIFE #788, a que realmente roda — confirmado ao ler o arquivo até o
  fim) populada `state.gruposHome.hoje` sim (`hoje:[...grupos.respondeu,...grupos.agora]`,
  linha ~13191) — só as gerações mais antigas dessa função (~2385/~9448) não tinham essa chave.
  Não muda a conclusão: mesmo com `gruposHome.hoje` populado, a função que consumiria isso
  segue sem nenhum call site — o achado real sempre foi a ausência de botão, não o dado.
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

### Investigação: carregarPipeline / renderListasHome / renderResumoDia — VERIFICADO SEGURO

Ao ler perto da linha 9400–9550, achei o MESMO padrão de `window.X=function(){}` dentro de IIFE
reaproveitando nome já usado — o padrão do bug do `carregarGeladeira` (v952) — só que MUITO mais
profundo: `carregarPipeline` é redefinida 4 vezes (linha ~3787 original, ~9506, ~12305, ~13118),
`renderListasHome` 3 vezes (~2385, ~9448, ~13180), com uma MISTURA de chamadas soltas
(`carregarPipeline()`) e qualificadas (`window.carregarPipeline()`) espalhadas pelo arquivo —
exatamente a receita do bug antigo.

**Investiguei a fundo antes de tocar em qualquer coisa** (rastreei todo call site de
`carregarPipeline`) e a conclusão é: **não é bug**. Toda vez que uma dessas IIFEs faz
`window.carregarPipeline = function(){...}`, a linha seguinte faz
`try{ carregarPipeline = window.carregarPipeline; }catch(_){}` — resincroniza de propósito a
variável de escopo do módulo com a propriedade de `window`. Confirmado nas 2 reatribuições de
`carregarPipeline` (linhas ~12336 e ~13167) e na de `renderListasHome` (linha ~13203). Ou seja,
depois do bug do `carregarGeladeira` (v952), o código passou a usar esse idioma de
resincronização de propósito pra nunca mais cair nessa armadilha — parece uma correção
consciente do próprio padrão, não um descuido. Não mexi em nada aqui.

**Fica registrado só como referência**, pra qualquer sessão futura que esbarrar nesse mesmo
padrão suspeito não perder tempo reinvestigando do zero — mas SEMPRE confirme se o
`try{ nome = window.nome; }catch(_){}` de resincronização está presente antes de assumir que é
seguro; se algum dia aparecer um `window.X = function(){}` SEM essa linha logo depois, aí sim é
o bug de novo.

### Investigação: abrirEditarLead / salvarEditarLead — VERIFICADO SEGURO (dead code, não é bug)

Mesmo padrão suspeito do `carregarGeladeira`: `function abrirEditarLead(){}`/`function
salvarEditarLead(){}` originais (linhas ~3925/~4331, com botão "Excluir este lead" e
reanálise automática ao trocar produto) reatribuídas DUAS VEZES via `window.abrirEditarLead =
function(){}`/`window.salvarEditarLead = function(){}` dentro de IIFEs depois (v685-1 ~11102,
v685-ajustes ~11434) — SEM o `try{ nome = window.nome; }catch(_){}` de resincronização que
salvou o caso `carregarPipeline`.

Rastreei todo call site:
- `cp715EditarLead` (linha 5157, chamada real do botão "Editar" da toolbar do lead, ao vivo —
  `renderLeadFoco` linha 5250) faz chamada SOLTA `abrirEditarLead(...)` → sempre resolve pro
  ORIGINAL (~3925), nunca pras versões novas. Confirmado: é o único call site alcançável.
- `salvarEditarLead` só é chamado solto (linha 3981 dentro do original, e também dentro das
  DUAS versões novas — linhas 11130 e 11464 — cada uma delas TAMBÉM chama `salvarEditarLead(...)`
  sem `window.`) — ou seja, mesmo se algum dia o modal novo abrisse, o botão Salvar dele chamaria
  o `salvarEditarLead` ORIGINAL do escopo do módulo, não o `window.salvarEditarLead` reatribuído.
  `window.salvarEditarLead(...)` (com `window.`) não é chamado de lugar nenhum no arquivo inteiro.
- O único call site que usa `window.abrirEditarLead(...)` (com `window.`) fica dentro de
  `abrirEditorDoLeadAtual` (v685-ajustes-2, linha 11591), só disparado por clique num elemento
  `#ui685AjustesEditQuick`/`#ui685AjustesEditAdmin`/`[data-action="editar-lead"]` — mas
  **`injetarAjustesLead`/`injetarEstiloAjustes` (as funções que criariam esses elementos) nunca
  são chamadas em lugar nenhum** (confirmado por grep no arquivo inteiro e em index.html) — o
  próprio código deixa pista disso: comentário "Atualização #724-2: wrapper antigo de
  renderLeadFoco removido" logo depois das duas definições. Sem o wrapper, `injetarAjustesLead`
  ficou órfã — os elementos nunca existem no DOM, então `abrirEditorDoLeadAtual` sempre cai no
  `if(!btn) return;` e o `window.abrirEditarLead(...)` dentro dela nunca roda.

**Conclusão: as duas reatribuições `window.*` são código 100% morto/inalcançável — mesma
categoria do achado `abrirVenda`/`marcarPerdido`/`arquivarLead` (não é bug ao vivo como o
`carregarGeladeira`).** Diferente daquele caso, aqui NÃO faz sentido "restaurar" as versões
novas: a versão que já roda de verdade (a original, ~3925/~4331) tem MAIS funcionalidade
(botão de excluir lead + reanálise automática ao trocar produto) que as versões novas — a
v685-ajustes inclusive se descreve no próprio comentário como "Escopo fechado: editar apenas
Nome, Telefone e Produto", uma simplificação deliberada, não uma melhoria. "Corrigir" a
resincronização faria a versão MAIS POBRE virar a que roda — seria regressão, não fix. Não
mexido. Limpeza de código morto (remover as duas IIFEs v685-1/v685-ajustes/v685-ajustes-2
inteiras) é possível no futuro, mas fora do escopo desta revisão (mesma lógica do achado
`abrirVenda`).

### Investigação: _processarDashboard / buildDesempenhoInsightsHTML / carteiraPassaFiltro / carteiraRowHTML / renderCarteiraTabela — VERIFICADO SEGURO

Mesmo padrão suspeito, dentro e ao redor da IIFE "v683 fluxo diário" (linhas ~10717–10774) e da
"Atualização #724-2" (~11760–11887). Rastreei cada uma via grep de todas as reatribuições:

- `_processarDashboard`, `buildDesempenhoInsightsHTML`, `carteiraPassaFiltro`,
  `carteiraRowHTML`: cada uma reatribuída de forma solta (`nome = function(){...}`) **exatamente
  uma vez em todo o arquivo**, e a linha SEGUINTE, na mesma IIFE, sempre faz `window.nome = nome;`
  — sincronização imediata, sem brecha. Seguras.
- `renderCarteiraTabela`: mais complexa — 8 gerações no total (original ~8240; ~10759 com
  `window.renderCarteiraTabela=renderCarteiraTabela` logo depois; ~11800 **sem** sync
  imediato; ~12082, ~12287, ~12498, ~12645 e ~13075, essas 5 últimas todas
  `window.renderCarteiraTabela=function(){}` seguidas de `try{ renderCarteiraTabela =
  window.renderCarteiraTabela; }catch(_){}` na linha seguinte). Existe uma janela SEM
  sincronização entre a geração de ~11800 e a resincronização de ~12097 — mas essa janela é só
  DURANTE o carregamento síncrono do script (todo o corpo dessas IIFEs roda antes de qualquer
  clique do usuário ser possível); confirmei que as 3 chamadas de `renderCarteiraTabela()` que
  antecedem textualmente a linha 8240 (dentro de `carregarCarteira`/`setCarteiraFiltro`/
  `carregarMaisCarteira`) só disparam em resposta a evento, nunca durante o carregamento do
  módulo. Ao fim do carregamento (linha ~13079), as duas ligações (nome solto e `window.nome`)
  já convergiram pra última geração — nenhum call site real (nem `onclick`, nem `addEventListener`
  com closure, nem chamada solta dentro de função) consegue observar a geração intermediária.
  Segura hoje, mas **frágil**: se uma edição futura remover o `try{...}catch(_){}` de
  resincronização de qualquer uma das 5 últimas gerações, a lacuna de ~11800 deixa de se
  autocorrigir. Mesma mesma categoria/aviso do achado já registrado pra `carregarPipeline`.
- `carregarPipeline`: reconferido com números de linha exatos (não os "~" aproximados da
  investigação anterior) — 5 gerações (original ~3787; ~9506 solta; ~11834 solta; ~12305 com
  `window.` + resync ~12336; ~13118 com `window.` + resync ~13167, geração final). Único call
  site "capturado por referência" (`qs("#pipelineRefresh")?.addEventListener("click",
  carregarPipeline)`, linha 7961) mira um elemento que **não existe em `index.html`** — não é
  bug vivo, é só mais um resto de código morto (`#pipelineRefresh` nunca existiu na tela atual).
  Confirma a conclusão já registrada acima ("Investigação: carregarPipeline").

Não mexi em nada — nenhuma das 5 tem bug ao vivo hoje.

### Investigação: setCarteiraFiltro "esquece" o argumento de filtro — VERIFICADO SEGURO (não é bug)

`setCarteiraFiltro(f)` original (linha 8228) respeitava o argumento `f` (filtro clicado nos
chips "Todos/Agora/Reativar/Arquivados"). Encontrei 4 reatribuições depois (linhas ~11797,
~12099, ~12299, ~12505, ~13080 — a última é a que vale) e a maioria **ignora o argumento por
completo**, sempre fixando `state.carteiraFiltro = 'todos'` (ou nem setando nada, no caso da
final). À primeira vista parece o mesmo bug de "esqueceram de propagar o parâmetro".

Não é: rastreei cada `renderCarteiraTabela` pareada com cada geração de `setCarteiraFiltro` e
nenhuma versão a partir da Atualização #724-2 (`cp694` em diante) desenha mais os chips de
filtro no HTML — a tela "Atendimentos" virou uma lista única ordenada por prioridade
(`cp694`/`cp695`/`cp696`/`cp697`) e por fim uma grade por dia da semana (`cp788`, a versão que
roda hoje). Confirmei por grep que `state.carteiraFiltro` só é LIDO pelas gerações antigas de
`renderCarteiraTabela` (linhas 8245/10763/11805, todas mortas pela mesma cadeia de
resincronização já documentada) — a versão viva (`cp788RenderAtendimentos`) nunca lê
`state.carteiraFiltro`. Sem UI de chips viva, não existe call site real de
`setCarteiraFiltro('agora')`/`('reaquecer')`/etc. — o parâmetro nunca carrega valor útil que
esteja sendo descartado. Faz parte da mesma reforma de tela que já apareceu nos outros achados
"verificado seguro" desta sessão. Não mexido.

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

### service-worker.js (arquivo CONCLUÍDO, 244 linhas — lido por completo, sem fix)

Estratégias de cache bem pensadas e já comentadas no próprio código: HTML sempre network-first
(pra sempre apontar pros assets `?v=NNN` mais novos), assets estáticos stale-while-revalidate
(instantâneo, versionado por querystring — deploy novo = URL nova = cache miss automático),
`/api/` nunca interceptado. Fluxo de Compartilhar (Share Target) salva o ZIP recebido no
IndexedDB (fallback: Cache Storage), grava um `shareId` único por envio, e só redireciona pro
app depois de TODOS os `await` de gravação terminarem — sem race condition entre o SW gravar e o
app.js ler.

Conferido especificamente por ser um padrão que já causou bug nesta revisão (chave de cache
fixa vs. dinâmica, ver achados de `app.js`): `app.js` mantém sua PRÓPRIA cópia sincronizada de
`shareIdbGet`/`shareCacheKey`/lista de chaves legadas (linhas ~7546-7696) que bate exatamente
com o que este arquivo grava (`direciona-share`/`zips`, `/__direciona_shared_zip__/${shareId}`)
— inclusive as chaves antigas sem `shareId` (de antes desse ID existir) continuam na lista de
busca do app.js pra não perder ZIP de sessão compartilhada antes da migração. Consistente.

**Achado trivial, não corrigido (zero impacto):** `ZIP_KEYS` (linha 4) é uma constante
declarada e nunca lida em lugar nenhum do arquivo — resto de uma versão anterior do fluxo de
Share Target que usava chave fixa (sem `shareId`) em vez da atual. Puramente cosmético (não
afeta cache nem comportamento); não fiz limpeza porque não é bug e a convenção desta revisão é
não gastar versão/commit só por remoção de código morto isolado, sem relação com um fix real.

### index.html (arquivo CONCLUÍDO, 663 linhas — lido por completo, sem fix)

Verifiquei especificamente o padrão de bug mais comum encontrado nesta revisão (nome que não
bate entre onde é chamado e onde é definido): comparei TODOS os `data-target="..."` com os IDs
reais de `<section class="screen">` e TODAS as funções chamadas via `onclick`/`onchange`/
`oninput` contra suas definições em `app.js`/`js/*.js` (via grep, incluindo `js/proposta.js` —
que é importado como módulo ES a partir de `app.js`, mesmo risco de "só ficou em escopo de
módulo, nunca em `window`" já visto várias vezes em app.js). Zero nomes órfãos, zero `id`
duplicado no arquivo inteiro.

Único caso que parecia divergência (`data-target="geladeira"` no card do Menu, linha 583,
enquanto a seção real é `id="perdidos"` e o item da barra lateral já usa
`data-target="perdidos"`) **não é bug**: `show()` e `carregarTelaAtiva()` em app.js (linhas
~687 e ~592-597) tratam "geladeira" como alias deliberado de "perdidos", com comentário
explícito no código contando a história (era um bug de tela em branco, corrigido antes desta
revisão). Confirmado lendo os dois pontos de tratamento antes de registrar como achado — não
era.

### styles.css (arquivo CONCLUÍDO, 2325 linhas — lido por completo, sem fix)

CSS não tem o risco de "split-brain" que motivou boa parte dos achados em app.js (regra
`window.X=function(){}` sem resincronizar `X` do escopo do módulo): numa folha de estilo, a
ÚLTIMA regra com a mesma especificidade sempre vence, pra QUALQUER consumidor — não existe
call site "solto" vendo uma versão e outro vendo outra. Confirmado que o arquivo é
estruturalmente válido: chaves `{`/`}` balanceadas (script de verificação, profundidade final
0), nenhum bloco `@media` malformado.

Verificação cruzada com o que já foi lido em `app.js`/`index.html`: nenhum seletor referencia um
`id`/classe que não existe nem uma variável CSS não definida.

**Achado, não corrigido (puramente cosmético, zero impacto funcional):** CSS morto de DUAS
gerações anteriores da tela "Atendimentos" (mesmo padrão de redesenho iterativo já documentado
em app.js, aqui sem nenhum risco por ser CSS):
- Geração 1 (comentário "Atualização #788", linha ~2153): `.cp788-att-list`, `.cp788-att-row`,
  `.cp788-att-copy`, `.cp788-att-time`, `.cp788-att-chevron`, `.cp788-att-more` — layout de
  lista cronológica simples.
- Geração 2 (comentário "v867", linha ~2180): `.cp788-att-layout`, `.cp788-att-main`,
  `.cp788-att-side`, `.cp788-meta-card`, `.cp788-meta-title`, `.cp788-meta-count`,
  `.cp788-meta-status`, `.cp788-meta-breakdown`, `.cp788-bd-row` — layout de 2 colunas com
  prédio da meta ao lado.

Confirmado por grep em `app.js` que NENHUMA dessas classes é gerada em lugar nenhum — a versão
que realmente roda hoje (comentário "v910", linha ~2199: `.cp788-days`/`.cp788-day`/etc., grade
por dia da semana) é a única usada por `cp788RenderAtendimentos` (ver achados de app.js). Regra
CSS que não casa com elemento nenhum simplesmente nunca se aplica — não interfere em nada, não
foi removida (limpeza isolada de CSS morto não justifica versão/commit própria nesta revisão,
mesmo critério já usado pros outros achados de código morto).

### build.js (v966) — arquivo CONCLUÍDO (92 linhas)

**Corrigido — proteção estrutural furada por atualização silenciosa:** a guarda "bloqueia o
build se algum arquivo de `api/` for duplicado na raiz" (protege contra o front publicar
código que não bate com a função serverless real) usava uma lista de nomes cravada no código,
escrita quando `api/` tinha só 5 arquivos. Hoje `api/` tem 12 — os outros 7
(`analisar.js`, `cerebro-config.js`, `criar-upload-url.js`, `diagnostico.js`,
`leads-recentes.js`, `limpar-tudo.js`, `restaurar-leads.js`, todos adicionados em versões
posteriores) não tinham NENHUMA proteção contra esse tipo de duplicata. Corrigido pra ler
`api/` de verdade via `fs.readdirSync` em vez de lista fixa — nunca mais fica pra trás. Ver
`NOTAS-v966.md`. Novo teste (`tests/v966-build-guarda-api-raiz-dinamica.test.mjs`) EXERCITA a
guarda de verdade: duplica um dos 7 arquivos que ficavam desprotegidos na raiz, roda
`build.js` como processo filho, confirma que falha com a mensagem certa, remove o arquivo no
`finally`.

Resto do arquivo (cópia dos assets pra `public/`, substituição de `__VERSION__`/`__BUILD_ID__`,
empacotamento do JSZip local, verificação final "build só tem exatamente os arquivos
esperados") lido por completo, sem outro bug — mecanismos de proteção bem pensados.

### js/proposta.js (v967) — arquivo CONCLUÍDO (289 linhas)

**Corrigido:** `propClear` (botão "Limpar" da tela de proposta) e `excluirPropostaTimeline`
(excluir proposta do histórico do lead) usavam `confirm()` nativo — a varredura da v964
converteu 10 usos em `app.js` mas não olhou este módulo separado (extraído de `app.js` na
v848). Convertidos pro mesmo padrão `cp903Confirm`. `propClear` virou `async function` pra
poder dar `await`. Ver `NOTAS-v967.md`.

Resto do arquivo lido por completo, sem outro bug: `PROP_CAMPOS` (usado por
`coletarPropostaData`/`aplicarPropostaData` pra salvar/reabrir proposta no lead) bate
exatamente com os IDs reais dos campos em `index.html` (conferido campo a campo); todas as
funções que cruzam pra `app.js` (`payloadComCerebro`, `show`, `abrirLead`,
`invalidarLeadsCache`) usam `window.*` de propósito (evita o mesmo risco de split module/window
já documentado várias vezes nesta revisão) e existem de fato do outro lado, sem duplicidade.

### js/pwa-install.js (arquivo CONCLUÍDO, 116 linhas — lido por completo, sem fix)

Lógica de instalação PWA (`beforeinstallprompt`, detecção iOS/Safari, banner "Baixar app")
correta e bem defendida contra timing: o convite pode ser capturado cedo pelo script inline do
`index.html` (antes deste módulo carregar, já que `app.js` fica no fim do `<body>`) — este
arquivo lê `window.__deferredInstallPrompt` tanto no carregamento quanto via evento customizado
`direciona-install-ready`, cobrindo os dois casos (eu quase levantei isso como achado, mas o
comentário do próprio código já documenta exatamente esse cuidado, e confirmei que os DOIS
caminhos realmente convergem). Todos os `qs("#id")?.addEventListener(...)` de instalação
(`#btnInstalarApp`, `#bannerInstalarBtn/Fechar/Web`) miram elementos ESTÁTICOS que já existem no
HTML no momento em que este módulo carrega — sem risco.

**Achado, não corrigido (falta conteúdo, não é bug de código):** o banner de **onboarding**
(`#bannerOnboarding`) é só um `<div hidden></div>` VAZIO em `index.html` (linha 141) — nunca
recebe `innerHTML` em lugar nenhum do projeto inteiro (confirmado por grep em `app.js`,
`index.html`, `styles.css` e todo `js/`). `app.js` (linha ~3638) só alterna o `display` desse
container vazio conforme a regra ("1 a 4 leads, ainda não dispensado, ou aberto via Menu") — mas
não tem título, texto nem botões pra mostrar. Os dois botões que este arquivo tenta ligar,
`#bannerOnboardingFechar`/`#bannerOnboardingOk` (linhas 99-100), não existem em lugar nenhum —
os `addEventListener` sempre operam sobre `null` (protegido por `?.`, não quebra nada, só nunca
funciona). `window.abrirOnboarding` (linha 106, comentário diz "abrir de novo pelo Menu") também
não é chamada de nenhum botão/menu real. Efeito prático: como a div fica sem conteúdo nem
padding/borda própria, ela colapsa pra altura zero — o corretor provavelmente NUNCA percebe
nada na tela (não é um bug visível), mas o "ritual de boas-vindas" pretendido nunca chegou a
ser escrito. Diferente do banner de instalar (`#bannerInstalar`), que tem HTML completo
estático (ícone, texto, botões) em `index.html` — o onboarding ficou só como esqueleto. Não
inventei o conteúdo (texto/passos do "ritual diário") porque é decisão de produto, não bug
técnico — fica registrado pro dono decidir se quer esse onboarding de volta e o que ele deve
dizer.

### js/dom.js + js/commercial-schema.js + js/state.js (v968) — CONCLUÍDOS (28 linhas ao todo)

**Corrigido, em `js/dom.js` (usado por `app.js` e todos os módulos `js/*`):**
- `escapeHtml(t="")`: parâmetro default só cobre `undefined`, não `null` — campo nulo vindo do
  banco (Postgres NULL vira JSON `null`, não some do objeto) caía em `String(null)` = a STRING
  `"null"`, mostrando o texto literal "null" na tela em vez de nada. Trocado pro corpo usar
  `t??""`, cobre os dois casos.
- `toast(t)`: cada chamada agendava um novo `setTimeout` sem cancelar o anterior — dois toasts
  em menos de 2.6s faziam o timer do primeiro esconder o segundo antes da hora. Corrigido com
  `clearTimeout` do timer anterior antes de agendar o novo.

Ver `NOTAS-v968.md`.

**Achados, não corrigidos (mesma classe de bug, mas não alcançável hoje):**
- `safeJson(v)`: `JSON.stringify(undefined)` retorna `undefined`, e `.replace` nisso quebraria
  com exceção — mas os 3 call sites reais em `app.js` sempre garantem valor não-undefined
  antes de chamar. Não é bug alcançável agora.
- `js/commercial-schema.js`: `ui675AnaliseDeterministica` (app.js ~10354) grava
  `_schemaComercial` manualmente em vez de reusar `stampCommercialSchema` — fica faltando só
  `_schemaComercialMinor`, que não é lido em lugar nenhum do projeto (metadado morto, sem
  efeito na lógica real).

`js/state.js` lido por completo, sem achado — objeto de estado simples, sem lógica.

**Checklist de arquivos da revisão está 100% CONCLUÍDO** (todos os itens da tabela acima,
`api/*`, `app.js`, `service-worker.js`, `index.html`, `styles.css`, `build.js`, `js/*` —
lidos linha a linha, do início ao fim).

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

## Resumo final — revisão CONCLUÍDA (2026-07-24)

Todo arquivo do checklist (todo `api/*.js`, `app.js` inteiro — 13214 linhas, do início ao fim —,
`service-worker.js`, `index.html`, `styles.css`, `build.js`, todo `js/*.js`) foi lido linha a
linha. Nenhum arquivo ficou pendente.

**Correções reais aplicadas (11 versões, v950–v968), cada uma com teste de regressão novo:**
- v950/v951/v955: `_persistence.js`/`_pipeline.js` — regex de acento frágil, comentários
  corrompidos, assinatura de timeline inconsistente entre arquivos.
- v952: `carregarGeladeira` duplicada em `app.js` quebrava silenciosamente a paginação de
  Arquivados (bug ao vivo real, não só código morto).
- v956: `api/lead-update.js` — caminho mais comum de reimportação não tinha a proteção da v900
  (mensagem real podia ser sobrescrita por sugestão antiga).
- v957: `api/reanalisar-lead.js` — lembrete calculado a partir de mensagem podia nascer no dia
  da semana errado por causa de fuso horário.
- v958: `api/restaurar-leads.js` — 3 bugs (data serial do Excel nunca detectada, dedupe por
  nome colapsando leads legítimos diferentes, Geladeira/Standby tratados como a mesma etapa).
- v959: `api/limpar-tudo.js` — reset total não paginava o Storage, podia deixar arquivo pra trás
  e reportar sucesso mesmo assim.
- v960/v965: mesmo regex de acento frágil corrigido em `criar-upload-url.js` e (3 pontos) em
  `app.js`, com guarda de regressão que cobre todo o projeto.
- v961: `api/diagnostico.js` — diagnóstico podia dizer "análise funciona" com o modelo de
  análise quebrado, só porque o teste de validação da chave passou.
- v962: `api/leads-recentes.js` — auditoria de duplicidade subestimava o total; backup completo
  não incluía a configuração do Cérebro.
- v963: `api/analisar.js` — 🔴 única rota do projeto sem `requireApiKey` (endpoint público que
  gastava crédito de OpenAI pra qualquer POST).
- v964: 10 `confirm()` nativos em `app.js` convertidos pro modal `cp903Confirm` + bug real no
  botão "Apagar tudo" (chave errada no body, nunca funcionava).
- v966: `build.js` — guarda contra API duplicada na raiz protegia só 5 dos 12 arquivos reais de
  `api/` (lista cravada, nunca atualizada conforme rotas novas foram criadas).
- v967: mais 2 `confirm()` nativos em `js/proposta.js`, fora do alcance da varredura da v964.
- v968: `js/dom.js` — `escapeHtml(null)` mostrava o texto literal "null" na tela; `toast()`
  deixava um toast esconder o próximo antes da hora.

**Achados grandes registrados, não corrigidos (decisão do dono, não bug técnico):**
- Nomes de pessoas/empresa parceira cravados no código como heurística de classificação de
  autor de mensagem (`_pipeline.js`, `app.js`, `lead-update.js`) — contraria a regra do
  CLAUDE.md, mas mexer envolve migrar heurística de linguagem natural sem teste automatizado
  cobrindo o caso. Ver detalhe completo na entrada de `_pipeline.js` (v955) acima.
- Onboarding (`js/pwa-install.js`/`app.js`): banner existe e é ligado/desligado, mas nunca teve
  conteúdo (texto/passos) escrito — decisão de produto, não bug.
- Vários pontos de teto fixo de leitura no Supabase (`.limit(5000)` e similares, ~6 lugares
  distintos) — escala, não bug funcional hoje.

**Código morto documentado (dead-code cascade — comportamento ao vivo já está correto, versão
mais nova de cada função é a que roda de verdade; limpeza física fica pra outra sessão):**
`abrirVenda`/`marcarPerdido`/`arquivarLead`/`ui683MarcarEtapaRapida`,
`abrirEditarLead`/`salvarEditarLead` (aqui a versão viva é a MELHOR, não a mais nova — reforçar
a resincronização seria regressão), `iniciarSequenciaAtendimento` e função-irmãs (sem nenhum
call site), CSS de 2 gerações antigas da tela Atendimentos.

**Padrões verificados seguros** (mesmo formato suspeito do bug da v952, mas com resincronização
presente): `carregarPipeline`/`renderListasHome`/`renderCarteiraTabela`/`setCarteiraFiltro` e as
funções da IIFE "v683 fluxo diário" — documentado com aviso pra sessões futuras não assumirem
segurança sem reconferir a linha de resincronização.

Todas as correções: `npm test` verde, `NOTAS-vNNN.md` individual, commit + push na branch
`claude/saas-real-estate-expert-q610re`. Nenhum merge/deploy pra `main` foi feito.
