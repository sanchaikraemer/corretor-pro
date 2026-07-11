# v778 — "Perdido" e "Geladeira" viraram uma coisa só

## O pedido

Depois de apontar que "perdido, geladeira, arquivar" era nomenclatura e lugar demais pra mesma finalidade, o corretor pediu: **"eu gostaria que fosse uma coisa só."** Escolheu manter o nome **Geladeira**.

## O que mudou

Antes havia dois destinos de saída do pipeline (Perdido e Geladeira), cada um com seu botão, sua aba e seu fluxo de volta. Agora é **um só**:

- **Um lugar:** a seção "Arquivo" deixou de ter as duas abas (Perdidos/Geladeira). Sobrou só a **Geladeira**. Na barra lateral e no menu, o item também virou "Geladeira" (o card duplicado "Leads perdidos" foi removido).
- **Um botão pra sair:** na tela do lead ficou só **"Colocar na geladeira"**. O botão **"Perdido"** foi removido dos dois lugares onde aparecia.
- **Um botão pra voltar:** **"Reativar"** (manda pra Atendimento) — vale pra qualquer lead da Geladeira.
- **Os leads que já estavam como "Perdido"** continuam aparecendo: a lista da Geladeira agora inclui tanto `Geladeira` quanto `Perdido`, então nada some. Reativar um deles funciona igual.

## Detalhes técnicos (`app.js` + `index.html`)

- `carregarGeladeira` (as duas definições) passou a filtrar `["Geladeira","Perdido"]` em vez de só `"Geladeira"`.
- Removidos os botões "Perdido" (`cp704QuickActions` e a barra de ações rápida `ui683`).
- Seção `#perdidos`: removidas as abas internas e a lista `#perdidosList`; ficou só o card da Geladeira (`#arqGeladeira` sempre visível).
- `show()` e `carregarTelaAtiva`: "perdidos" e "geladeira" agora apontam pro mesmo lugar (a Geladeira única); as chamadas de `arqTab` saíram.
- Menu/lateral: rótulos e destino unificados em "Geladeira" (`data-nav-key="arquivo"` mantém o realce consistente).

Nenhuma etapa foi migrada no banco (sem risco de dado): a unificação é de interface e de listagem. `marcarPerdido`/`carregarPerdidos` continuam definidos mas sem botão que os acione.

## Observação

A etapa "Perdido" ainda existe internamente (relatórios/analytics antigos podem contá-la à parte). Se você quiser que a Geladeira seja também a única forma de contar isso nos relatórios, dá pra fazer num passo seguinte.

## Testes

- `npm test` e `npm run build` passaram.
- Falta validar em produção: abrir um lead, mandar pra Geladeira, conferir que aparece na lista única (junto com os antigos "Perdidos") e que "Reativar" devolve pro pipeline.
