# v865 — ajustes de UI + mensagens distintas + fim do piscar da Home

Versão que agrupa vários ajustes pedidos depois da v864 (barra de progresso em gradiente).

## Mudanças

- **Texto da barra de etapa em peso normal**: o rótulo ("Nome da etapa · passo X de 6")
  estava em negrito pesado (`font-weight:950`) e, sobre o gradiente, ficava com aparência
  borrada. Passou para `font-weight:400` (normal), mantendo o branco e a sombra leve pra
  legibilidade.

- **Linha "Última análise" de volta no cabeçalho do lead**: acima de "Última mensagem —
  data" voltou uma linha no mesmo formato, "Última análise — data", que mostra quando foi
  feita a última análise/reanálise do cliente (existia antes e sumiu num refactor). A data
  vem, em ordem de prioridade, de `reanalisadoEm` → `geradoEm` → última atualização do lead;
  na ausência de qualquer data, a linha simplesmente não aparece (não inventa data).
- **Linhas de meta em negrito**: "Última análise" e "Última mensagem/Último atendimento"
  passaram a `font-weight:700` (aqui o negrito ajuda a destacar — diferente da barra de
  etapa, onde foi removido).

- **Barra de etapa com o gradiente da barra de reanálise (âmbar→coral)**: o gradiente era
  ciano→coral→verde (`#68ff95`) e destoava. A pedido do dono, passou a usar EXATAMENTE o
  mesmo gradiente da barra de progresso da reanálise (`.ui682ProgressBar`):
  `var(--morno)` (âmbar) → `var(--lime)` (coral). Além da cor, o preenchimento passou a ser
  por `width` (fatia X/6), igual à `.ui682ProgressBar`/`.progress-bar` — antes era um
  `clip-path` sobre um gradiente de largura fixa, o que lavava as cores dos passos do meio.
  O conceito de "verde = venda no passo 6" foi abandonado em favor da harmonia visual.

- **3 sugestões de mensagem realmente distintas**: o prompt de análise (`api/_pipeline.js`)
  só pedia `recomendada`/`maisSuave`/`maisDireta` sem dizer que precisam ser abordagens
  diferentes — a IA devolvia a mesma ideia reescrita 3x. Agora o prompt exige três caminhos
  distintos (recomendada = melhor jogada; maisSuave = consultiva, qualifica/destrava;
  maisDireta = CTA concreto) e manda reescrever se as três propuserem a mesma ação.
  Observação: só dá pra confirmar o efeito em produção (IA), reanalisando um lead.

- **Fim do piscar da tela inicial**: existiam dois desenhos de Home. No boot, a versão "rica"
  (`renderBotoesHome`: hero "Prioridade agora", fila de próximos, "Top conversão") era pintada
  a partir do cache; logo depois o `carregarDashboard` chamava `renderListasHome` (override do
  cp788/v788), que substituía tudo pela lista enxuta "Ações prioritárias para hoje" — daí o
  flash. A pedido do dono (ficar com a rica), o `renderListasHome` do cp788 agora chama
  `renderBotoesHome()` em vez de montar a enxuta. Ele reaproveita o mesmo `state.gruposHome`
  que já montava (chaves `acao-hoje`/`retomar-cuidado`/`retomada`/…), então boot e dashboard
  pintam a MESMA tela rica — sem piscar. (Reverte a simplificação visual do v788 por escolha
  do dono; a lógica de condução/atendimentos separados continua intacta.)

## Verificação

- `tests/v864-barra-progresso-etapa` ganhou uma checagem de que o texto da barra fica em
  peso normal (400).
- Novo teste `tests/v865-ultima-analise`: prioridade da data (reanálise > geração >
  atualização), a linha "Última análise" acima de "Última mensagem" e o negrito das metas.
- `tests/v864-barra-progresso-etapa` atualizado: a barra é ciano→coral e o verde `#68ff95`
  não pode mais aparecer nela.
- Novo teste `tests/v865-mensagens-distintas`: trava a instrução de diferenciação das 3
  mensagens no prompt.
- `npm test`: suíte completa verde.
