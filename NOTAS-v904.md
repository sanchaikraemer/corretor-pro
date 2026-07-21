# v904 — só "Arquivar" existe: fora Vendido, Perdido e Geladeira

## Pedido do dono
"perdidos e vendidos? isso nem existe mais, ou não deveria existir, nem geladeira… somente
arquivar deve existir." O dono usa o app só como follow-up: ele arquiva o lead e pronto. Não
marca venda nem perda. Decisão confirmada: **remover do app inteiro** (botões, menu, Desempenho),
**mantendo o "Excluir definitivamente"** (apagar lixo/teste é outra coisa, não um desfecho).

## O que mudou (nível do que o dono vê)
- **Tela do lead**: saiu o botão "Vendido" (grupo "Encerramento") de `cp704QuickActions`, de
  `cp704ToolsFlat` e da barra rápida do `ui683`. Sobra só **Arquivar** como desfecho (+ Editar,
  Gerar proposta e, no grupo Perigo, Excluir definitivamente).
- **Menu**: removido o card "Vendas registradas". O "Arquivo" já era um único **"Arquivados"**.
- **Desempenho**: removido o tile de receita ("Vendas registradas · valor do mês"). Ficam os
  indicadores de atividade (ativos, fazer agora, compromissos, aguardando).
- **Tela "Vendas registradas"** (`#vendas`): removida — não era mais acessível.
- **Rótulos**: leads antigos já marcados Vendido/Perdido/Geladeira aparecem como **"Arquivado"**
  (em `cp704Jornada` e `cp704StatusResumo`) — sem os rótulos "Vendido"/"Perdido".

## O que ficou por baixo (invisível, de propósito)
- A etapa interna "Geladeira" continua sendo o "armário" do arquivado (o Arquivar move pra lá),
  e os filtros que tiram Vendido/Perdido/Geladeira das listas ativas seguem valendo. Sem isso o
  app não saberia o que está ativo x arquivado.
- A tela "Arquivados" reúne Geladeira + Perdido antigos num lugar só, com "Reativar".
- Funções órfãs (`carregarVendas`, `marcarVendido`, etc.) ficaram sem gatilho na interface —
  não são mais alcançáveis, sem risco. A importação de CSV que trazia "Perdido" não foi mexida
  (é dado de entrada, não um botão); esses leads entram como inativos/arquivados.

## Verificação
- Teste de unidade confirma: nenhum botão Vendido/Perdido na interface; `cp704QuickActions` sem
  "Encerramento" mas com Arquivar e Excluir; `cp704ToolsFlat`/barra `ui683` sem venda;
  `cp704Jornada` manda Vendido/Perdido/Geladeira pra "Arquivado"; sem card/tela/tile de venda no
  index.html; e o Arquivados ainda reúne Geladeira+Perdido.

## Arquivos
- `app.js` — botões de saída removidos; rótulos de Vendido/Perdido/Geladeira → "Arquivado".
- `index.html` — card "Vendas registradas", tile de receita e tela `#vendas` removidos.
- `tests/v904-somente-arquivar.test.mjs` (novo).
- `package.json` — versão 903 → 904.
