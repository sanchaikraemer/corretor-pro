# NOTAS v1075 — a tela "Condução" foi DELETADA do sistema (não só escondida)

## Contexto

Na v1074 eu tinha removido só as **portas de menu** pra Condução — e o dono corrigiu na hora,
com print circulando a tela: *"vc só tirou do menu e não deletou no sistema COMO MANDEI"*.
A ordem era deletar a tela inteira, porque ela repetia o painel e as listas da Home.
Esta versão executa isso de verdade.

## O que saiu

A tela `#pipeline` ("Condução") inteira, com as **duas gerações** de código que a desenhavam:

- **index.html**: a seção da tela (título, abas Oportunidades/Últimos/Todos — que já estavam
  escondidas por CSS desde a geração cp788 —, seletor de ordenação, busca própria, botão Excel
  e "Voltar") e o botão **"Abrir Condução"** do painel da Home (o painel "Condução da carteira"
  em si continua — é a referência que o dono quer).
- **app.js — geração antiga** (~115 linhas): variáveis/abas/ordenação (`setPipelineTab`,
  `setPipelineOrdem`, `ordenarLeadsPor`) e o render antigo, além dos escutadores de clique órfãos
  (que depois da remoção teriam QUEBRADO o boot por referenciar função apagada — pego na
  verificação de resquícios).
- **app.js — geração viva (cp788)**: o render atual da tela, os filtros visuais e as funções de
  abertura (`cp786AbrirConducao`, `cp786AbrirPrioridadePrincipal`, `cp788AbrirCarteiraAtiva`,
  `cp788LinhaConducao`), entradas de rota/cache/teclado (`p`), contadores de diagnóstico da tela
  e o CSS injetado que a citava.
- **styles.css**: todos os blocos `.pipe-*`, `.pipeline-page-*`, `.ui-pipeline-*`,
  `.ui-filter-tabs` (órfão), `.cart-export` (o botão Excel escondido era o único usuário) e as
  regras de tema claro da tela.

## Pra onde foi cada função (nada se perdeu)

| O que era na tela deletada | Onde vive agora |
|---|---|
| Visão "Fazer agora" (dose do dia + fila) | Card **"Fazer agora"** da Home (lista que já existia) |
| Visão "Aguardando cliente" | Card **"Aguardando cliente"** da Home → lista nova no mesmo padrão |
| Visão "Carteira ativa" (todos os ativos) | Card **"Total de leads"** da Home → lista nova no mesmo padrão |
| Botão "🖨️ Imprimir lista" (v1064) | Topo da lista **"Carteira ativa"** |
| Botão "⬇ Excel" (estava ESCONDIDO por CSS na tela antiga) | Topo da lista **"Carteira ativa"** — voltou a ser acessível |
| Avisos do sininho ("X atendimentos pedem ação") | Abrem a lista "Fazer agora" da Home |
| "Abrir prioridades de hoje" e link do insight | Abrem a lista "Fazer agora" da Home |

Detalhes técnicos importantes:

- `abrirGrupoHome` ganhou suporte a **botões de ação no cabeçalho** (`options.acoesHtml`) — é
  onde moram o Imprimir e o Excel da Carteira ativa.
- **Rota antiga salva em aparelho**: quem tinha o app aberto na tela deletada (rota gravada no
  celular) cai na **Home** ao voltar — sem isso o boot restaurava uma tela inexistente e ficava
  em branco (`show()` ganhou a guarda `pipeline → home`).
- A tecla de atalho `p` saiu do mapa de teclado.

## Testes

- Novo: `tests/v1075-tela-conducao-deletada.test.mjs` — trava que nenhuma das duas gerações
  volte (HTML, app.js e CSS), que a rota antiga caia na Home, que os 3 cards da Home apontem
  pras listas substitutas e que Imprimir/Excel continuem vivos na Carteira ativa.
- Atualizados (miravam a tela deletada): `v826-atendimentos`, `v860-sem-termometro`,
  `v885-prioridade-por-fatos`, `v931-sem-porta-redundante`, `v1010-central-atencao-respeita-fds`,
  `v1012-meta-atendimentos-por-corretor`, `v1064-imprimir-lista-clientes-ativos`,
  `v1073-faxina-geracoes-mortas`, `v1074-sem-foto-avatar-e-sem-conducao-no-menu`.

## Pendente (combinado com o dono)

O dono pediu **4 modelos de layout** pra padronizar TODAS as listas abertas pelos cards da Home
(achou a apresentação atual ruim). Os modelos foram enviados fora do repositório pra ele
escolher; a aplicação do escolhido será uma próxima versão.

## Verificação

- Suíte inteira (`npm test`) verde.
- `npm run build` limpo.

## Arquivos

`app.js`, `index.html`, `styles.css`, `tests/v1075-*.test.mjs` (novo), 9 testes atualizados,
`package.json`/`package-lock.json` (versão **1074 → 1075**), `NOTAS-v1075.md` (este arquivo).
