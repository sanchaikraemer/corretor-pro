# v1194 — faxina fina: o que sobrou de código morto depois da auditoria da v1186

## O pedido

O dono pediu uma varredura no sistema inteiro atrás de linhas e códigos desativados ou sem uso,
pra diminuir o peso — **perguntando antes de apagar**. A varredura foi feita com analisador de
sintaxe (a mesma técnica da auditoria da v1186), cada achado foi conferido um a um no código real
antes de virar pergunta, e os três grupos foram aprovados por ele antes de qualquer remoção.

## Contexto: a faxina grande já tinha acontecido

A v1186 tirou 61 funções mortas, 167 classes de CSS sem dono e 96 KB de download por abertura.
O que esta rodada encontrou é a **poeira fina** que aquela guarda não enxergava — a guarda da
v1186 vigia funções; o que sobrou eram **constantes** (tabelas de texto) e regras de CSS soltas.

## O que saiu (com aprovação do dono, grupo a grupo)

**Grupo 1 — 13 tabelas de etiquetas/frases de telas que não existem mais (~105 linhas do app.js):**
`OBJETIVOS_MSG_LABELS` (lista vazia de um módulo desativado), `TIPO_RETOMADA_LABEL`,
`MATERIAL_LABEL`, `EVOLUIU_LABEL`, `FUNCIONOU_LABEL`, `MATERIAL_TEMPLATE` (as frases prontas de
envio de material — nenhuma tela as desenhava), `CP_JANELA_INTERESSE_DIAS` e as cinco `UI670_*`
(etiquetas da tela de parceiros da atualização #670, substituída há muito). No
`service-worker.js`, a constante `ZIP_KEYS` (declarada e nunca lida). Nenhuma dessas era citada
em lugar nenhum — nem no próprio arquivo, nem no HTML, nem nos módulos.

**Grupo 2 — ~35 linhas de CSS vestindo elementos que não existem (styles.css e contas-estilo.css):**
a barrinha de progresso antiga (`.pbar`, 5 regras), o avatar grande (`.lead-avatar.lg`), o número
grande dos insights (`.ins-item .big`), o bloco inteiro do "modo foco" das atualizações #589–#592
(`.lead590`/`#msgFocoText` — esses elementos não existem em nenhuma tela desde então), regras de
busca apontando pra caixas removidas (`#buscaCarteira`, `#buscaGlobalDesktop`), sobras da tela de
parceiros (`#ui670HistorySlot`, `#ui670NoteSlot`, `#novoAtendimentoPanel`), duas barras de
progresso da Home já escondidas por regra (`#cp697HomeProgress`, `#cp702HomeProgress`) e, no
estilo das telas de conta, os blocos de demonstração/protótipo que nenhuma página mostra
(`.selo-proto`, `.bloco-teste`, `.linha-teste`, `.demo-contas`).

**Grupo 3 — 3 funções do servidor que só testes antigos seguravam (~125 linhas):**
- `transcribeAudio` — a transcrição antiga de áudio. A importação usa
  `transcreverArquivosExtraidos` + `transcreverBuffer` desde a v1141; as duas camadas de proteção
  contra "arquivo bomba" (conferir o tamanho declarado ANTES de descompactar; teto de 24 MB no
  áudio real) continuam nos caminhos vivos, e o teste da v979 foi reescrito pra travar exatamente
  isso — nos caminhos que rodam de verdade.
- `compararEvolucao` — a comparação de evolução por IA da reimportação antiga. Dois testes a
  usavam só como "marcador de fim de bloco" pra ler `analyzeWithBrain`; passaram a usar o vizinho
  atual (`getOpenAIRaw`).
- `ranquearCasosAprendidos` — ranqueamento de casos aprendidos que o prompt não usa desde que
  passou a usar `jeitoAprendidoCompacto` (v1092). Os auxiliares `_tokensRank`/`_simRank` ficam:
  outros pontos vivos os usam.
- E uma linha em `_persistence.js`: `_dedupeIndexadoEstado`, gancho de teste que nem teste usava.

## O achado que confirma a lição da v1186

`MATERIAL_TEMPLATE` estava "protegida" por um assert da v1184 que conferia o TEXTO do arquivo
("o convite de visita continua existindo, só neutro") — três meses de teste verde guardando
frases que **nenhuma tela desenhava**. É exatamente o padrão "teste guardando fantasma" que a
NOTAS-v1186 descreveu. O teste da v1184 foi ajustado: os asserts negativos (texto pronto não pode
presumir lançamento) continuam; o positivo, que cobrava texto morto, saiu com explicação no
próprio arquivo.

## Guarda nova pra isso não voltar

`tests/v1194-constantes-mortas-tambem-quebram.test.mjs`: a partir de agora, **constante de topo
declarada e nunca lida** em `app.js`/`service-worker.js` quebra a suíte, com a mesma regra de
leitura da guarda da v1186 (ou falta ligar na tela, ou apaga). Era o ponto cego que deixou essas
13 sobreviverem à auditoria anterior.

## Prova visual (obrigatória por mexer em CSS)

App publicado servido num Chromium de verdade, 7 fotos antes × depois comparadas **pixel por
pixel**: Hoje no celular, Hoje no computador, Hoje no tema claro, entrar, criar conta,
privacidade e painel administrativo. Resultado: **idênticas** — a única diferença em toda a
comparação foi o próprio número da versão no topo da Home ("Atualização #1193" → "#1194").

## Falsos alarmes descartados na conferência (nada mexido neles)

- Cartões de Ajustes (`estadoIACard`, `lembreteDiarioCard`, `themeSettingsCard`, etc.): o
  "nome" externo do cartão não é citado, mas o conteúdo interno é todo vivo.
- `_colunasInexistentesEstado/Resetar` e `_dedupeIndexadoResetar`: ganchos de teste de verdade
  (v1096, v1144) — ficam.
- A ação fantasma `atualizar-analise-comercial` da auditoria B3: já tinha saído na v1186; hoje só
  existe num comentário histórico.

## Números

| | antes | depois |
|---|---|---|
| `app.js` | 13.652 linhas | 13.552 linhas |
| `styles.css` | 1.940 linhas | 1.917 linhas |
| `contas-estilo.css` | 356 linhas | 330 linhas |
| `api/_pipeline.js` | 3.660 linhas | 3.535 linhas |
| testes | 362 | 363, todos verdes |

## Testes

`npm test` — **363 testes, todos verdes** (24 arquivos checados). Alterados junto com a limpeza:
`v979` (guarda do arquivo bomba apontada pros caminhos vivos), `aprendizado-continuo` (saiu o
trecho da função removida), `v827-18` e `v947` (novo marcador de fim de bloco), `v1184` (assert
positivo de texto morto saiu, negativos ficam). Guarda nova: `v1194-constantes-mortas`.
