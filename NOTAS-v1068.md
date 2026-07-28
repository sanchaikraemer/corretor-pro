# NOTAS v1068 — auditoria completa (segurança, fluxo comercial, código morto) e correções

## Contexto

Pedido do dono: uma análise completa do sistema (técnica, comercial e de produto) com
autonomia pra corrigir o que fosse encontrado. Três auditorias rodaram em paralelo (segurança da
API, fluxo comercial/UX, código morto/duplicado em `app.js`). Esta nota reúne o que foi
encontrado e o que foi corrigido nesta versão.

## 1. Segurança — CRÍTICO: escrita de arquivo fora da pasta temporária (path traversal)

`api/cerebro-config.js` (ação `transcrever-audio`, usada pela nota de voz do Cérebro) repassava
`body.ext` — vindo direto do corpo da requisição, sem nenhuma validação — pra
`transcreverBuffer` (`api/_pipeline.js`), que monta o caminho do arquivo temporário com
`path.join(os.tmpdir(), ...)${ext}`. Um valor como
`../../../../home/user/.ssh/authorized_keys` escapava de `os.tmpdir()` — qualquer corretor
autenticado (não precisa ser admin) podia escrever (e o próprio código em seguida tentava
apagar) um arquivo fora da pasta temporária, com o conteúdo que ele mesmo mandasse como "áudio".

**Correção**: `transcreverBuffer` agora só aceita uma extensão de verdade (um ponto seguido de
1 a 5 letras/números) — qualquer coisa fora disso cai no padrão seguro `.ogg`, nunca vira parte
de um caminho.

## 2. Segurança — ALTO: sem teto diário nas ações de visão/voz avulsas

Diferente da análise principal (que já tem `verificarLimiteDiario` desde a v1013) e do
diagnóstico, três ações de visão em `api/lead-update.js` (`extrair-print`, `detectar-rosto`,
`ler-prints-conversa`) e a transcrição de voz avulsa em `api/cerebro-config.js`
(`transcrever-audio`) chamavam a OpenAI sem NENHUM teto — um script ou uma conta em teste grátis
podia gerar custo real ilimitado.

**Correção**: as quatro ações agora passam por `verificarLimiteDiario`, com tetos generosos (não
são limite de uso normal, só rede de segurança contra script/loop descontrolado): 300/dia
(60/dia em teste) pra visão, 100/dia (20/dia em teste) pra transcrição de voz — configuráveis por
variável de ambiente (`CORRETOR_PRO_LIMITE_VISAO_DIA`, `CORRETOR_PRO_LIMITE_VISAO_DIA_TESTE`,
`CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA`, `CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA_TESTE`).

**Deixado de fora, de propósito**: a ação `aprender-carteira` (aprendizado em lote de toda a
carteira) processa 1 lead por requisição e o front chama de novo até acabar — uma carteira de
500+ leads legitimamente gera 500+ chamadas numa única execução, de um único clique. Um teto
baixo quebraria esse uso normal; um teto alto o bastante pra nunca atrapalhar deixaria de ser uma
proteção real contra abuso. Sem saber o tamanho típico de carteira que o dono quer suportar, não
arrisquei um número — fica registrado como ponto em aberto.

## 3. Segurança — MÉDIO, não corrigido (decisão do dono): `limpar-tudo.js` sem checagem de papel

Hoje qualquer membro autenticado de uma empresa (não só o "dono" daquela empresa,
`memberships.papel`) pode disparar "Apagar tudo" da própria empresa, uma vez que a variável de
ambiente `DIRECIONA_DANGER_LIMPAR_TUDO=ativo` esteja ligada (ela já é global e controlada só pelo
dono da plataforma). Não implementei uma trava adicional por papel porque isso muda quem, dentro
de uma empresa, pode apagar os próprios dados — uma decisão de acesso/produto, não só um bug — e
o teste `v1037-backup-auditoria-limpartudo-isolam-empresa.test.mjs` já cobre deliberadamente o
comportamento atual (login comum, não só o dono, conseguindo limpar a própria empresa). Fica
registrado pra decisão explícita do dono.

## 4. Comercial — ALTO: "Fazer agora" ignorava a recomendação de aguardar da IA

A v1059 criou `recomendacaoContato.aguardar` — quando a IA identifica que o certo é NÃO mandar
mensagem agora (cliente pediu espaço, "vai pensar", recusa clara). Esse sinal só era lido dentro
do lead já aberto (`renderLeadFoco`) — a fila que decide QUEM aparece no topo do "Fazer agora"
(o que o corretor vê e ataca primeiro, sem abrir nada) nunca checava isso. Um lead com
atendimento recente e negociação avançada podia subir ao topo da fila mesmo com a IA
recomendando esperar — o corretor via "atenda este agora" contradizendo o próprio aviso dentro
do lead.

**Correção**: `cpFilaFazerAgora` agora exclui da fila (não da carteira — o lead continua
existindo, só não compete pelo topo) quem tem `recomendacaoContato.aguardar === true` numa
análise atual (mesmo gate `analiseAtualValida752` já usado no aviso dentro do lead, pra nunca
confiar num sinal de análise desatualizada).

## 5. Comercial — MÉDIO: "atendido" divergia entre duas funções

`ultimoAtendimentoTs` (fonte de verdade usada por `emJanelaDeEspera` desde a v1018/v1022)
reconhece atendimento marcado por três caminhos: evento `contato_manual` em
`aprendizado.eventos`, os campos `lastAttendanceAt`/`ultimoAtendimentoEm`, ou uma mensagem manual
na timeline. `temAtendimentoManual` (usada em "Oportunidades esquecidas" e no texto "você já
atendeu" vs. "N msgs do cliente") só olhava a timeline — um lead marcado atendido só pelo botão
de um clique "Marcar atendimento" (o caminho mais comum, não grava nada na timeline) nunca era
reconhecido por essa segunda função. Na prática, esse lead nunca saía de "Oportunidades
esquecidas" mesmo depois de esfriar, e mostrava o texto errado.

**Correção**: `temAtendimentoManual` agora delega pra `ultimoAtendimentoTs(l) > 0` — as duas
funções passam a concordar sobre o mesmo lead.

## 6. Código morto e visual

- **CSS**: `.cp-dashboard-grid` reservava uma célula pro card "Atendidos hoje"
  (`.cp-activities-card`), removido da tela há tempos (só ficou escondido via `display:none`, o
  elemento em si já não existe no HTML) — sobrava um espaço vazio ao lado do card "Atendimentos
  em andamento" em telas ≥1000px. Ajustado o `grid-template-areas` pra esse card ocupar a linha
  inteira, e removidas as 4 regras de CSS que não tinham mais elemento nenhum pra valer.
- `startBusy` (shim de compatibilidade sem nenhuma chamada restante) e
  `analiseComercialPrincipalHTML` (58 linhas, substituída por `diagnosticoClienteHTML` e depois
  pela "IA Comercial 2.0", sem nenhuma chamada restante) removidas — confirmado por busca no
  repositório inteiro antes de apagar.

**Não mexido nesta rodada (maior risco, registrado pra uma sessão dedicada)**:
`abrirVenda`/`marcarPerdido` são redefinidas 3 vezes em `app.js` (só a última, "v685-final",
vale — as ~500 linhas anteriores ficaram inalcançáveis) e `abrirEditarLead`/`salvarEditarLead`
2 vezes — mesmo padrão, achado pela auditoria. Não removi porque validar isso exige testar de
verdade os fluxos de venda/perda/edição de lead num navegador (não só os testes automatizados),
e envolve ~550 linhas — risco real de regressão numa tela crítica sem essa validação manual.
`renderHeroLead` (card antigo "Prioridade agora", substituído pela lista compacta na v942) também
ficou de fora porque dois testes existentes (`v866-hero-acoes`, `v890-hero-texto-completo`)
travam propriedades dela — removê-la exige também aposentar esses dois testes.

## Verificação

- Novos testes: `tests/v1068-transcrever-buffer-sem-path-traversal.test.mjs` (confirma que uma
  extensão maliciosa nunca escapa de `os.tmpdir()`), `tests/v1068-teto-diario-visao-e-transcricao-voz.test.mjs`
  (confirma HTTP 429 nas quatro ações depois do teto).
- Testes existentes atualizados pra acomodar o novo gate `analiseAtualValida752` dentro de
  `cpFilaFazerAgora` (usado em sandboxes `eval()` isolados): `v914`, `v1057`, `v1024`, `v938`.
- `npm test` — suíte inteira verde.
- `npm run build` — build limpo, 27 arquivos publicados.
- `npm install --package-lock-only` — `package-lock.json` sincronizado.

## Arquivos

`api/_pipeline.js` (`transcreverBuffer`, tetos novos de visão/transcrição de voz),
`api/lead-update.js` (3 ações de visão), `api/cerebro-config.js` (`transcrever-audio`), `app.js`
(`cpFilaFazerAgora`, `temAtendimentoManual`, remoção de `startBusy`/`analiseComercialPrincipalHTML`),
`styles.css` (grid do Dashboard), `tests/v1068-*.test.mjs` (novos),
`tests/v914-fazer-agora-dose-e-fds.test.mjs`, `tests/v1057-so-atendidos-entram-prioridade.test.mjs`,
`tests/v1024-lentidao-cache-scores-vermais-ultima-analise-timeout-import.test.mjs`,
`tests/v938-fila-nao-oferece-aguardando-resposta.test.mjs` (ajustados),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1068.md`, versão
**1067 → 1068**.
