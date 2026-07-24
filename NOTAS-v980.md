# v980 — observação marca atendido; contagem de "atendidos hoje" parou de divergir entre telas

## Contexto

Dois pedidos do dono, seguidos de um print em produção que revelou uma segunda causa raiz na
mesma área de código.

## 1. Salvar observação não marcava o lead como atendido

Pedido do dono: "quando acrescento e salvo observação no lead, deve marcar como atendido" —
igual já acontecia ao clicar "Marcar atendimento" ou copiar uma mensagem sugerida
(`api/reanalisar-lead.js`, evento `contato_manual` com `detalhes.de` identificando a origem:
`botao_atendido`, `copiar_msg`). Observação nunca escrevia esse evento.

**Fix:**
- `api/lead-update.js` (`acaoObservacaoAdicionar`) agora grava também um evento `contato_manual`
  (`detalhes: { tipo: "Observação", de: "observacao_manual" }`) junto com a observação, mesmo
  padrão já usado pelos outros dois gatilhos.
- `app.js` (`ui667AplicarAtendidoLocal`) ganhou um 5º parâmetro opcional `detalhes` (valor padrão
  `{tipo:"Atendido",de:"botao_atendido"}`, preserva os 4 usos existentes sem mudança) — permite
  reaproveitar a mesma função de patch local para origens diferentes de atendimento, em vez de
  duplicar a lógica.
- `cp7ObsSalvar` (salvar observação) chama `ui667AplicarAtendidoLocal` +
  `ui667ReconciliarAtendimentoLocal` com esses novos `detalhes`, reaproveitando exatamente a
  proteção já validada no v918 (atendimento sobrevive a um fetch atrasado que substitui os
  arrays da Home).

## 2. Print do dono: Home dizia "11 atendidos hoje", tela Atendimentos dizia "12" no mesmo instante

Banner da Home ("Mandou bem! 11 leads atendidos hoje.") e a tela Atendimentos (coluna "Hoje
24/07 — 12/10", listando 12 nomes reais) discordavam ao mesmo tempo. O cartão "Você já atendeu
os 10 de hoje" mostrava um TERCEIRO número — esse não é um bug: `CP_DOSE_DIA` (meta fixa de 10)
é reaproveitado como texto quando a dose chega a zero, não é uma contagem ao vivo; fica sem
sentido só quando o corretor passa da meta, mas não é a causa da divergência.

**Causa raiz:** duas implementações diferentes de "quantos atendi hoje":
- `cp788RenderAtendimentos` (tela Atendimentos) conta em cima de `state.todosLeads`/dado bruto do
  servidor, sem filtrar por etapa — um lead atendido e arquivado (Vendido/Perdido/Geladeira) no
  mesmo dia continua contando. **Este é o número correto** (bate com a intenção documentada desde
  a v907).
- `cpAtendidosHojeTotal` (usada pelo banner da Home via `tratadosHoje` e pela dose de "Fazer
  agora") filtrava por `leadEhAtivo`, excluindo quem foi arquivado no mesmo dia — mesmo a v907 já
  tendo decidido explicitamente que a conta deveria incluir esses casos. A correção da v907 só
  foi aplicada na conta LOCAL de `renderSaudacao` (que nunca teve esse filtro pra começar) — a
  função `cpAtendidosHojeTotal`, usada por outros lugares (dose, `abrirFazerAgora`,
  `renderResumoDia`, tela Condução), nunca recebeu o mesmo tratamento. Duas contas do "mesmo"
  número, uma certa e uma errada, sem nenhum teste conectando as duas — exatamente o tipo de
  duplicação que a auditoria externa (PDF v892) já tinha sinalizado como risco do monólito.

**Fix:**
- `cpAtendidosHojeTotal(items)` não filtra mais por `leadEhAtivo`; conta a partir de
  `state.todosLeads` (base completa) quando ela já estiver carregada, com `items` como
  fallback só pra quando essa base ainda não existe (boot muito cedo, ou uso em teste/sandbox).
- `renderSaudacao` não tem mais sua própria conta local de `tratadosHoje` — chama
  `cpAtendidosHojeTotal(items)`, a mesma função que a dose usa. As duas telas agora são
  fisicamente incapazes de divergir de novo (uma delas não existe mais como implementação
  separada).

## Verificação

- `npm test`: suíte inteira verde (165 checks), incluindo os dois novos
  (`v980-observacao-marca-atendido`, `v980-atendidos-hoje-inclui-arquivados` — este último
  reproduz o cenário exato do print: 2 leads ativos + 1 arquivado, todos atendidos hoje, confirma
  que a contagem agora dá 3, não 2).
- Dois testes existentes ficaram "verdes por engano" com a mudança (regex/eval batendo em texto
  antigo que não existe mais, sem checar o que realmente importava) — corrigidos, não só
  contornados: `v907-contagem-e-botoes` (verificava a ausência do filtro na conta ERRADA, que
  nunca tinha o filtro pra começar) e `v924-fazer-agora-meta-decrescente` (sandbox sem `state`
  declarada, `ReferenceError` ao rodar).
- `npm run build`: build limpo, versão 980.
- Não testado em produção — depende de dado real de carteira com lead atendido e arquivado no
  mesmo dia; a suíte cobre o cenário via dados sintéticos.

## Arquivos

- `api/lead-update.js` (`acaoObservacaoAdicionar`), `app.js` (`ui667AplicarAtendidoLocal`,
  `cp7ObsSalvar`, `cpAtendidosHojeTotal`, `renderSaudacao`),
  `tests/v980-observacao-marca-atendido.test.mjs` (novo),
  `tests/v980-atendidos-hoje-inclui-arquivados.test.mjs` (novo),
  `tests/v907-contagem-e-botoes.test.mjs` (corrigido),
  `tests/v924-fazer-agora-meta-decrescente.test.mjs` (corrigido),
  `tests/v918-atendido-sobrevive-fetch-atrasado.test.mjs` (regex atualizada pro novo parâmetro),
  `package.json`/`package-lock.json`, `NOTAS-v980.md`, versão **979 → 980**.
