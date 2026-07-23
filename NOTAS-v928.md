# v928 — remove de vez todo o resto de "vendas fechadas"

## O pedido (repetido)

O dono já tinha deixado isso decidido lá na v904 ("perdidos e vendidos? isso nem existe mais...
somente arquivar deve existir" — ele usa o app só como follow-up, não marca Vendido/Perdido).
Quando sugeri um tile de "vendas fechadas no mês" pro Desempenho, ele reagiu: **"Nós não temos
vendas fechadas no mês, nem valor e quantidade quantas vezes eu preciso repetir isso?"**

Investigando o código, achei o motivo de eu ter escorregado nisso: a v904 removeu os BOTÕES e o
tile do Desempenho, mas boa parte do CÁLCULO por trás ficou pra trás, morta — inclusive uma
fatia "Vendas" que continuava viva (sempre mostrando 0) numa tela que o dono nem tinha reclamado
ainda.

## O que foi removido

**Código morto (nunca renderizava nada — alvos de DOM que não existem desde a v904):**
- `carregarVendas` (tela "Vendas registradas", alvo `#vendasList`) + a 2ª definição
  (`window.carregarVendas`, com paginação) + `cp6862MaisVendas` + o listener
  `qs("#vendasRefresh")` (esse, inclusive, quebraria o carregamento do app se algum dia o
  elemento existisse de novo — passava a função direto, sem closure).
- `carregarRelatorio` + `renderDesempenhoDash` + `FUNIL_ETAPAS` (versão antiga da tela
  Desempenho, "Ritmo comercial" — alvo `#relatorioBody`, substituída faz tempo por
  `renderCorretorProDashboard`/`#cpDashboard`, mas nunca apagada).
- `cpSaleValue`/`cpSetText("cpRevenue", ...)` dentro do `renderCorretorProDashboard` atual —
  calculava e tentava escrever num elemento (`#cpRevenue`) que nunca existiu no HTML.
- O bloco de "vendas do mês"/"vendas da semana" (`vendasDoMes`, `totalVendasMes`, `vendasSemana`,
  `valorVendasSemana`) dentro do carregamento principal do dashboard — alimentava só
  `#kpiVendas`/`#kpiVendasValor` (não existem) e `state.resumoSemana` (nunca lido em lugar
  nenhum).
- `parseValorVenda`/`formatBRL`: sem mais nenhum call site depois de tudo isso, removidas.
- As 2-3 linhas de dispatch que chamavam essas funções mortas (`t === "vendas"`,
  `t === "relatorio"` → `carregarRelatorio`).

**Código VIVO que foi ajustado (isso sim aparecia na tela):**
- Card "Esta semana" (aba Inteligência Comercial → Aprendizado): tinha um tile **"Vendas"**
  (contagem + valor) que sempre mostrava 0/vazio, porque a base de "Vendido" nunca é populada.
  Removido — ficam só as métricas que refletem uso real: Novos leads, WhatsApp, Copiadas,
  Contatos manuais, Materiais enviados.

Nada do que ficou foi tocado: "Vendido" como etapa legada continua sendo normalizado pra
"Arquivado" nos lugares que já faziam isso (decisão da v904, intacta); não mexi em
`abrirVenda`/`marcarPerdido`/`arquivarLead` (ações do menu "Arquivar", que são outra história e já
funcionam).

## Verificação

- `tests/v928-sem-vendas-fechadas.test.mjs` (novo): confirma que as funções/telas de vendas não
  existem mais, que nenhum alvo de DOM relacionado é mais escrito, que o dispatcher não tenta
  mais chamá-las, que o tile "Vendas" saiu do card "Esta semana" (mantendo as outras métricas),
  e que o HTML não tem mais nenhum id órfão de vendas/relatório morto.
- Suíte inteira verde (`npm test`); `node --check app.js` e `node build.js` OK.

## Arquivos
- `app.js` (remoções listadas acima), `tests/v928-sem-vendas-fechadas.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v928.md`, versão **927 → 928**.
